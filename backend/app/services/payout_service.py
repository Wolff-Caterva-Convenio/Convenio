import os
from datetime import datetime
import stripe
from sqlalchemy.orm import Session

from app.db.models.booking import Booking
from app.db.models.payment import Payment
from app.db.models.stripe_connected_account import StripeConnectedAccount
from app.db.models.user import User
from app.db.models.dispute import Dispute


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _stripe_init() -> None:
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


def create_host_transfer(db: Session, *, booking: Booking, payment: Payment, amount: int, reason: str) -> str | None:
    """Create a Stripe transfer to the host connected account.

    Idempotent at the Payment level via payment.stripe_transfer_id and Stripe idempotency_key.
    """
    _stripe_init()
    if amount <= 0:
        return None

    # Hard idempotency guard
    if getattr(payment, "stripe_transfer_id", None):
        return payment.stripe_transfer_id

    venue = booking.venue
    host_id = venue.host_user_id
    host_connect = (
        db.query(StripeConnectedAccount)
        .filter(StripeConnectedAccount.user_id == host_id)
        .one_or_none()
    )
    if not host_connect or not host_connect.stripe_account_id:
        raise RuntimeError("Host has no connected Stripe account")

    try:
        transfer = stripe.Transfer.create(
            amount=int(amount),
            currency=payment.currency,
            destination=host_connect.stripe_account_id,
            idempotency_key=f"transfer:{payment.id}:{reason}",
            metadata={
                "booking_id": str(booking.id),
                "payment_id": str(payment.id),
                "reason": reason,
            },
        )
    except stripe.error.StripeError as e:
        # IMPORTANT: Do not crash callers (booking creation, list endpoints, etc.)
        print("WARN: Stripe transfer failed (non-fatal):", str(e))
        return None

    transfer_id = transfer.get("id")
    payment.stripe_transfer_id = transfer_id
    payment.payout_status = "PAID"
    payment.transferred_amount = int(amount)
    payment.payout_processed_at = datetime.utcnow()
    db.add(payment)
    db.commit()
    return transfer_id


def process_due_payouts(db: Session) -> int:
    """Process Stripe transfers for completed bookings that haven't been paid out yet.

    Must be non-fatal: Stripe errors should not take down unrelated requests.
    """
    _stripe_init()

    due = (
        db.query(Payment, Booking)
        .join(Booking, Payment.booking_id == Booking.id)
        .filter(Booking.status == "COMPLETED")
        .filter(Payment.status.in_(["succeeded", "partially_refunded", "refunded"]))
        .filter(Payment.payout_status == "PENDING")
        .all()
    )

    processed = 0
    changed = False

    for payment, booking in due:
        # Hard idempotency guard
        if getattr(payment, "stripe_transfer_id", None):
            payment.payout_status = payment.payout_status or "PAID"
            changed = True
            continue

        # Pause payout if there's an open dispute
        open_dispute = (
            db.query(Dispute)
            .filter(Dispute.booking_id == booking.id)
            .filter(Dispute.status.in_(["OPEN", "UNDER_REVIEW"]))
            .count()
        )
        if open_dispute:
            continue

        venue = booking.venue
        host_id = venue.host_user_id

        host_connect = (
            db.query(StripeConnectedAccount)
            .filter(StripeConnectedAccount.user_id == host_id)
            .one_or_none()
        )
        if not host_connect or not host_connect.stripe_account_id:
            continue

        host = db.query(User).filter(User.id == host_id).one_or_none()
        if not host:
            continue

        gross = int(payment.amount_host_payout or 0)
        debt = int(host.penalty_debt_cents or 0)
        deduct = min(gross, debt) if debt > 0 else 0
        net = gross - deduct

        try:
            transfer_id = None
            if net > 0:
                transfer = stripe.Transfer.create(
                    amount=net,
                    currency=payment.currency,
                    destination=host_connect.stripe_account_id,
                    idempotency_key=f"transfer:{payment.id}",
                    metadata={
                        "booking_id": str(booking.id),
                        "payment_id": str(payment.id),
                        "gross_payout": str(gross),
                        "debt_deducted": str(deduct),
                    },
                )
                transfer_id = transfer.get("id")

            host.penalty_debt_cents = max(0, debt - deduct)

            payment.payout_status = "PAID" if net > 0 else "SKIPPED_ZERO_NET"
            payment.stripe_transfer_id = transfer_id
            payment.transferred_amount = net
            payment.payout_processed_at = datetime.utcnow()

            db.add(payment)
            db.add(host)
            processed += 1
            changed = True

        except stripe.error.StripeError as e:
            # Do not crash. Leave payout PENDING so it can be retried later.
            print("WARN: Stripe payout failed (will retry later):", str(e))
            continue

    if changed:
        db.commit()

    return processed