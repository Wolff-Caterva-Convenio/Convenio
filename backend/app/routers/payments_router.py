import os
from datetime import datetime, time as dtime
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.auth_dependencies import get_current_user
from app.db.models.booking import Booking
from app.db.models.payment import Payment
from app.db.models.stripe_connected_account import StripeConnectedAccount
from app.db.models.user import User
from app.db.models.venue import Venue
from app.services.stripe_event_lock import reserve_stripe_event

from app.services import cancellation_service

router = APIRouter(prefix="/payments", tags=["payments"])


# -----------------------------
# Helpers
# -----------------------------
def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _stripe_init() -> None:
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


def _webhook_secret() -> str:
    return _require_env("STRIPE_WEBHOOK_SECRET")


def _ceil_div(n: int, d: int) -> int:
    return (n + d - 1) // d


def _compute_amounts(host_net_total_cents: int) -> tuple[int, int, int]:
    """
    Net-first pricing model:
      guest_total = ceil(host_net * 100 / 90)
      platform_fee = guest_total - host_net
      host_payout = host_net
    """
    if host_net_total_cents < 0:
        raise ValueError("host_net_total_cents must be >= 0")

    guest_total = _ceil_div(host_net_total_cents * 100, 90)
    platform_fee = guest_total - host_net_total_cents
    host_payout = host_net_total_cents
    return guest_total, platform_fee, host_payout


def _as_checkin_dt(check_in_value) -> datetime:
    """
    Booking.check_in is typically a date. cancellation_policy expects a datetime.
    Convert date -> datetime at 15:00 (naive). If already datetime, pass through.
    """
    if isinstance(check_in_value, datetime):
        return check_in_value
    return datetime.combine(check_in_value, dtime(15, 0))


# -----------------------------
# Stripe: Checkout session
# -----------------------------
class CreateCheckoutSessionRequest(BaseModel):
    booking_id: UUID
    accept_rules_and_gtc: bool = False


class CreateCheckoutSessionResponse(BaseModel):
    checkout_url: str


@router.post("/stripe/checkout-session", response_model=CreateCheckoutSessionResponse)
def create_checkout_session(
    payload: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _stripe_init()

    booking = db.query(Booking).filter(Booking.id == payload.booking_id).one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.guest_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status == "CONFIRMED":
        raise HTTPException(status_code=409, detail="Booking already confirmed")

    if booking.status == "CANCELLED":
        raise HTTPException(status_code=409, detail="Booking cancelled")

    if booking.status != "PENDING_PAYMENT":
        raise HTTPException(status_code=409, detail=f"Booking not payable in state {booking.status}")

    if not payload.accept_rules_and_gtc:
        raise HTTPException(status_code=400, detail="Rules and GTC must be accepted")

    venue = db.query(Venue).filter(Venue.id == booking.venue_id).one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    currency = booking.currency or "eur"

    nights = (booking.check_out - booking.check_in).days
    if nights <= 0:
        raise HTTPException(status_code=400, detail="Invalid booking dates (check_out must be after check_in)")

    host_net_total = nights * int(getattr(venue, "payout_net_per_night", 0))
    if host_net_total <= 0:
        raise HTTPException(status_code=409, detail="Venue price is not set")

    amount_guest_total, amount_platform_fee, amount_host_payout = _compute_amounts(host_net_total)

    # Defensive guards: these values must be ints (cents) and never None
    if amount_guest_total is None or amount_platform_fee is None or amount_host_payout is None:
        raise HTTPException(status_code=500, detail="Pricing calculation failed")
    amount_guest_total = int(amount_guest_total)
    amount_platform_fee = int(amount_platform_fee)
    amount_host_payout = int(amount_host_payout)

    payment = db.query(Payment).filter(Payment.booking_id == booking.id).one_or_none()
    if payment and payment.status == "succeeded":
        raise HTTPException(status_code=409, detail="Booking is already paid")

    # Snapshot pricing onto booking
    booking.currency = currency
    booking.amount_guest_total = amount_guest_total
    booking.amount_platform_fee = amount_platform_fee
    booking.amount_host_payout = amount_host_payout
    db.add(booking)

    # If a Payment row already exists (e.g. prior attempt), refresh its snapshot values
    if payment is not None:
        payment.amount_guest_total = amount_guest_total
        payment.amount_platform_fee = amount_platform_fee
        payment.amount_host_payout = amount_host_payout
        payment.currency = currency

    now = datetime.utcnow()

    if payment is None:
        payment = Payment(
            booking_id=booking.id,
            provider="stripe",
            status="processing",
            amount_guest_total=amount_guest_total,
            amount_platform_fee=amount_platform_fee,
            amount_host_payout=amount_host_payout,
            currency=currency,
            refunded_amount_total=0,
            updated_at=now,
        )
        db.add(payment)
    else:
        # keep provider as-is; refresh status to allow checkout retry
        if payment.status in ("failed", "processing", "pending"):
            payment.status = "processing"
        payment.updated_at = now
        db.add(payment)

    # Require connected account for host payout routing
    acct = (
        db.query(StripeConnectedAccount)
        .filter(StripeConnectedAccount.user_id == venue.host_user_id)
        .one_or_none()
    )
    if not acct or not acct.stripe_account_id:
        raise HTTPException(status_code=409, detail="Host is not connected to Stripe")

    success_url = _require_env("CHECKOUT_SUCCESS_URL")
    cancel_url = _require_env("CHECKOUT_CANCEL_URL")

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=current_user.email,
            line_items=[
                {
                    "price_data": {
                        "currency": currency,
                        "product_data": {"name": f"Booking {venue.title}"},
                        "unit_amount": amount_guest_total,
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "booking_id": str(booking.id),
                "venue_id": str(venue.id),
                "guest_user_id": str(current_user.id),
                "host_user_id": str(venue.host_user_id),
            },
            payment_intent_data={
                "metadata": {"booking_id": str(booking.id)},
            },
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)}")

    payment.stripe_checkout_session_id = session.id
    payment.status = "pending"
    payment.updated_at = datetime.utcnow()
    db.add(payment)

    db.commit()
    return CreateCheckoutSessionResponse(checkout_url=session.url)


# -----------------------------
# Stripe: Webhook
# -----------------------------
@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    _stripe_init()

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, _webhook_secret())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Idempotency lock by event id
    if not reserve_stripe_event(db, event.id):
        return {"status": "ignored"}

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        booking_id = session.get("metadata", {}).get("booking_id")

        if not booking_id:
            return {"status": "ignored"}

        booking = db.query(Booking).filter(Booking.id == booking_id).one_or_none()
        if booking:
            if booking.status == "PENDING_PAYMENT":
                booking.status = "CONFIRMED"
                db.add(booking)

                payment = db.query(Payment).filter(Payment.booking_id == booking.id).one_or_none()
                if payment:
                    payment.status = "succeeded"
                    payment.stripe_payment_intent_id = session.get("payment_intent")
                    payment.updated_at = datetime.utcnow()
                    db.add(payment)

                db.commit()

    return {"status": "ok"}


# -----------------------------
# Cancellation + refund (2-step)
# -----------------------------
class CancelBookingResponse(BaseModel):
    booking_id: UUID
    refund_ratio: float
    new_status: str


class ConfirmCancelResponse(BaseModel):
    booking_id: UUID
    refund_ratio: float
    refund_amount: int
    currency: str
    new_status: str


@router.post("/bookings/{booking_id}/cancel", response_model=CancelBookingResponse)
def cancel_booking_request(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = cancellation_service.request_cancel(db, current_user, booking_id=booking_id)
    booking = res["booking"]
    return CancelBookingResponse(
        booking_id=booking.id,
        refund_ratio=float(res["refund_ratio"]),
        new_status=str(res["new_status"]),
    )


@router.post("/bookings/{booking_id}/cancel/confirm", response_model=ConfirmCancelResponse)
def cancel_booking_confirm(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = cancellation_service.confirm_cancel(db, current_user, booking_id=booking_id)
    booking = res["booking"]
    return ConfirmCancelResponse(
        booking_id=booking.id,
        refund_ratio=float(res["refund_ratio"]),
        refund_amount=int(res["refund_amount"]),
        currency=str(res["currency"]),
        new_status=str(res["new_status"]),
    )


# -----------------------------
# checkout session -> booking lookup (safe, read-only)
# -----------------------------
@router.get("/stripe/session/{session_id}")
def get_booking_from_session(session_id: str, db: Session = Depends(get_db)):
    payment = (
        db.query(Payment)
        .filter(Payment.stripe_checkout_session_id == session_id)
        .one_or_none()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Session not found")

    booking = db.query(Booking).filter(Booking.id == payment.booking_id).one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    return {
        "booking_id": str(booking.id),
        "status": booking.status,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "guest_total": booking.amount_guest_total,
        "currency": booking.currency,
    }