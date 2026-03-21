import os
from datetime import datetime, time as dtime
from uuid import UUID

import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models.booking import Booking
from app.db.models.payment import Payment
from app.db.models.user import User
from app.db.models.venue import Venue
from app.db.models.cancellation_event import CancellationEvent
from app.services.cancellation_policy import calculate_refund_ratio
from app.services.payout_service import create_host_transfer
from app.services.email_service import send_cancellation_email


def _log_cancellation_event_and_enforce_policies(
    db: Session,
    *,
    booking: Booking,
    venue: Venue,
    actor: User,
    is_guest: bool,
    is_host: bool,
    refund_ratio: float,
    refund_amount: int,
) -> None:
    """Persist cancellation event and apply abuse / host-penalty policies.

    Designed to be safe/idempotent for a given (booking_id, actor_user_id).
    """
    # Avoid double-logging for the same actor + booking
    existing = (
        db.query(CancellationEvent)
        .filter(CancellationEvent.booking_id == booking.id)
        .filter(CancellationEvent.actor_user_id == actor.id)
        .one_or_none()
    )
    if not existing:
        evt = CancellationEvent(
            booking_id=booking.id,
            actor_user_id=actor.id,
            actor_role="host" if is_host else "guest",
            refund_ratio=int(round(refund_ratio * 100)),
            refund_amount=int(refund_amount or 0),
        )
        db.add(evt)

    # Host cancellation penalty: 30% debt (deducted from future payouts; no automatic locking).
    if is_host:
        base = int(booking.amount_guest_total or 0)
        penalty = int(round(base * 0.30))
        if penalty > 0:
            actor.penalty_debt_cents = int(actor.penalty_debt_cents or 0) + penalty
            db.add(actor)

    # NOTE: We intentionally do NOT auto-ban/lock guests for cancellations.


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _stripe_init() -> None:
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


def _as_checkin_dt(check_in_value) -> datetime:
    """
    Booking.check_in is a date; cancellation_policy expects a datetime.
    Convert date -> datetime at 15:00 (naive). If already datetime, pass through.
    """
    if isinstance(check_in_value, datetime):
        return check_in_value
    return datetime.combine(check_in_value, dtime(15, 0))


def _require_booking_and_venue(db: Session, booking_id: UUID) -> tuple[Booking, Venue]:
    booking = db.query(Booking).filter(Booking.id == booking_id).one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    venue = db.query(Venue).filter(Venue.id == booking.venue_id).one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    return booking, venue


def _require_actor_is_guest_or_host(current_user: User, booking: Booking, venue: Venue) -> tuple[bool, bool]:
    is_guest = booking.guest_user_id == current_user.id
    is_host = venue.host_user_id == current_user.id
    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="Not allowed")
    return is_guest, is_host


def request_cancel(db: Session, current_user: User, *, booking_id: UUID) -> dict:
    """
    Canonical cancel request:
      - Requires booking.status == CONFIRMED
      - Sets status -> CANCEL_REQUESTED
      - Returns refund_ratio and new_status

    Idempotent-ish:
      - If already CANCEL_REQUESTED or CANCELLED: returns current status + ratio
    """
    booking, venue = _require_booking_and_venue(db, booking_id)
    is_guest, is_host = _require_actor_is_guest_or_host(current_user, booking, venue)

    ratio = calculate_refund_ratio(check_in=_as_checkin_dt(booking.check_in), now=datetime.utcnow())

    # If the host is cancelling, guest is always refunded 100%.
    if is_host:
        ratio = 1.0

    if booking.status in ("CANCEL_REQUESTED", "CANCELLED"):
        return {"booking": booking, "refund_ratio": ratio, "new_status": booking.status}

    if booking.status != "CONFIRMED":
        raise HTTPException(status_code=409, detail=f"Cannot cancel booking in state {booking.status}")

    booking.status = "CANCEL_REQUESTED"
    db.commit()
    db.refresh(booking)

    return {"booking": booking, "refund_ratio": ratio, "new_status": booking.status}


def confirm_cancel(db: Session, current_user: User, *, booking_id: UUID) -> dict:
    """
    Canonical cancel confirm:
      - Requires booking.status == CANCEL_REQUESTED (or idempotent if already CANCELLED)
      - Creates/refines Stripe refund (idempotency key)
      - Pays host remainder on guest cancellations (per policy)
      - Updates Payment + Booking -> CANCELLED

    Returns:
      refund_ratio, refund_amount, currency, new_status
    """
    _stripe_init()

    booking, venue = _require_booking_and_venue(db, booking_id)
    is_guest, is_host = _require_actor_is_guest_or_host(current_user, booking, venue)

    ratio = calculate_refund_ratio(check_in=_as_checkin_dt(booking.check_in), now=datetime.utcnow())

    # Host cancel -> guest always 100% refund
    if is_host:
        ratio = 1.0

    if not booking.currency or booking.amount_guest_total is None:
        raise HTTPException(status_code=409, detail="Missing booking pricing snapshot")

    G = int(booking.amount_guest_total)

    # If already cancelled, return idempotent response (best-effort info)
    if booking.status == "CANCELLED":
        refund_amount = int(round(G * ratio)) if G else 0
        return {
            "booking": booking,
            "refund_ratio": ratio,
            "refund_amount": refund_amount,
            "currency": booking.currency or "eur",
            "new_status": booking.status,
        }

    if booking.status != "CANCEL_REQUESTED":
        raise HTTPException(status_code=409, detail=f"Cannot confirm cancel in state {booking.status}")

    payment = db.query(Payment).filter(Payment.booking_id == booking.id).one_or_none()
    if not payment or payment.status not in ("succeeded", "partially_refunded", "refunded"):
        raise HTTPException(status_code=409, detail="Booking has no successful payment to refund")

    if not payment.stripe_payment_intent_id:
        raise HTTPException(status_code=409, detail="Missing stripe payment_intent id")

    # Refund amount based on ratio (applies to guest total paid)
    refund_amount = int(round(G * ratio))

    # Compute kept amount
    kept_amount = max(0, G - refund_amount)

    # Platform + host split rules
    if is_host:
        # Host cancel: full refund, platform keeps 0, host gets 0
        platform_keep = 0
        host_payout = 0
    else:
        if ratio >= 0.95:
            # Guest cancels >72h: platform keeps minimum 5% deposit, host gets 0
            platform_keep = int(round(G * 0.05))
            host_payout = 0
        else:
            # Guest cancels <72h:
            # Platform keeps 17% of the kept amount, host gets the rest of kept amount
            platform_keep = int(round(kept_amount * 0.17))
            host_payout = max(0, kept_amount - platform_keep)

    already_refunded = int(payment.refunded_amount_total or 0)

    # If already refunded at/above desired amount, finalize cancellation idempotently,
    # AND still do the host payout if needed and not done yet.
    if already_refunded >= refund_amount:
        if (not is_host) and host_payout > 0 and not getattr(payment, "stripe_transfer_id", None):
            try:
                create_host_transfer(
                    db,
                    booking=booking,
                    payment=payment,
                    amount=host_payout,
                    reason="guest_cancellation",
                )
            except Exception as e:
                print("WARN: host cancellation payout failed (non-fatal):", str(e))

        booking.status = "CANCELLED"

        _log_cancellation_event_and_enforce_policies(
            db,
            booking=booking,
            venue=venue,
            actor=current_user,
            is_guest=is_guest,
            is_host=is_host,
            refund_ratio=ratio,
            refund_amount=refund_amount,
        )

        db.commit()
        db.refresh(booking)

        # SEND CANCELLATION EMAIL
        user = db.query(User).filter(User.id == booking.guest_user_id).first()
        if user:
            send_cancellation_email(
                user_email=user.email,
                venue_title=venue.title,
                check_in=str(booking.check_in),
                check_out=str(booking.check_out),
                refund_amount=refund_amount / 100
            )

        return {
            "booking": booking,
            "refund_ratio": ratio,
            "refund_amount": refund_amount,
            "host_payout": host_payout,
            "platform_keep": platform_keep,
            "currency": booking.currency,
            "new_status": booking.status,
        }

    # ---- Stripe Refund (if needed) ----
    if refund_amount > 0:
        try:
            stripe.Refund.create(
                payment_intent=payment.stripe_payment_intent_id,
                amount=refund_amount,
                metadata={"booking_id": str(booking.id)},
                idempotency_key=f"refund:{booking.id}:{refund_amount}",
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)}")

        payment.refund_requested_amount = refund_amount
        payment.refund_origin = "api"

        payment.refunded_amount_total = refund_amount
        if refund_amount >= G:
            payment.status = "refunded"
        else:
            payment.status = "partially_refunded"

    # ---- Host remainder payout on guest cancellation (best-effort) ----
    if (not is_host) and host_payout > 0 and not getattr(payment, "stripe_transfer_id", None):
        try:
            create_host_transfer(
                db,
                booking=booking,
                payment=payment,
                amount=host_payout,
                reason="guest_cancellation",
            )
        except Exception as e:
            # Do not fail cancellation if payout fails; leave it for later retry/manual reconciliation.
            print("WARN: host cancellation payout failed (non-fatal):", str(e))

    payment.updated_at = datetime.utcnow()

    booking.status = "CANCELLED"

    _log_cancellation_event_and_enforce_policies(
        db,
        booking=booking,
        venue=venue,
        actor=current_user,
        is_guest=is_guest,
        is_host=is_host,
        refund_ratio=ratio,
        refund_amount=refund_amount,
    )

    db.commit()
    db.refresh(booking)

    # SEND CANCELLATION EMAIL
    user = db.query(User).filter(User.id == booking.guest_user_id).first()
    if user:
        send_cancellation_email(
            user_email=user.email,
            venue_title=venue.title,
            check_in=str(booking.check_in),
            check_out=str(booking.check_out),
            refund_amount=refund_amount / 100
        )

    return {
        "booking": booking,
        "refund_ratio": ratio,
        "refund_amount": refund_amount,
        "host_payout": host_payout,
        "platform_keep": platform_keep,
        "currency": booking.currency,
        "new_status": booking.status,
    }