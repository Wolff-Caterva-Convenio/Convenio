from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.availability_block import AvailabilityBlock
from app.db.models.booking import Booking
from app.db.models.user import User
from app.db.models.venue import Venue
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.bookings import BookingCreate, BookingOut
from app.schemas.calendar import CalendarEventOut
from app.services import cancellation_service
from app.services.reviews_service import has_user_reviewed_booking
from app.services.booking_service import (
    expire_old_pending_payment_bookings,
    complete_past_confirmed_bookings,
)

from pydantic import BaseModel

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

# NEW: canonical cancellation service

router = APIRouter(prefix="/bookings", tags=["bookings"])

ACTIVE_STATUSES = ["PENDING_PAYMENT", "CONFIRMED"]


@router.get("/{booking_id}/review-status")
def review_status(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.guest_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    already_reviewed = has_user_reviewed_booking(
        db, booking_id, current_user
    )

    return {"already_reviewed": already_reviewed}

@router.post("/{venue_id}/bookings", response_model=BookingOut, status_code=201)
def create_booking(
    venue_id: UUID,
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    if payload.check_in >= payload.check_out:
        raise HTTPException(status_code=400, detail="Invalid date range")

    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if getattr(venue, 'status', '') == 'suspended':
        raise HTTPException(status_code=409, detail='Venue is suspended')

    overlapping_block = (
        db.query(AvailabilityBlock)
        .filter(
            AvailabilityBlock.venue_id == venue_id,
            AvailabilityBlock.start_date < payload.check_out,
            AvailabilityBlock.end_date > payload.check_in,
        )
        .first()
    )
    if overlapping_block is not None:
        raise HTTPException(status_code=409, detail="Dates are blocked by the host")

    booking = Booking(
        venue_id=venue_id,
        guest_user_id=current_user.id,
        check_in=payload.check_in,
        check_out=payload.check_out,
    )

    db.add(booking)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Dates already booked")

    db.refresh(booking)

    return booking

@router.post("/bookings/{booking_id}/cancel/confirm", response_model=ConfirmCancelResponse)
def confirm_cancel_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = cancellation_service.confirm_cancel(
        db, current_user, booking_id=booking_id
    )

    return ConfirmCancelResponse(
        booking_id=res["booking"].id,
        refund_ratio=float(res["refund_ratio"]),
        refund_amount=int(res["refund_amount"]),
        currency=res["currency"],
        new_status=res["new_status"],
    )

@router.get("/{venue_id}/bookings", response_model=list[BookingOut])
def list_bookings_for_venue(
    venue_id: UUID,
    status: Optional[str] = Query(default=None, description="Filter by exact status, e.g. CONFIRMED"),
    active: Optional[bool] = Query(
        default=None,
        description="If true, only PENDING_PAYMENT + CONFIRMED. If false, only non-active statuses.",
    ),
    from_date: Optional[date] = Query(
        default=None,
        alias="from",
        description="Start of date window (YYYY-MM-DD). Returns bookings overlapping this window.",
    ),
    to_date: Optional[date] = Query(
        default=None,
        alias="to",
        description="End of date window (YYYY-MM-DD). Returns bookings overlapping this window.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if getattr(venue, 'status', '') == 'suspended':
        raise HTTPException(status_code=409, detail='Venue is suspended')

    if venue.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    q = db.query(Booking).filter(Booking.venue_id == venue_id)

    if status is not None:
        q = q.filter(Booking.status == status)

    if active is True:
        q = q.filter(Booking.status.in_(ACTIVE_STATUSES))
    elif active is False:
        q = q.filter(~Booking.status.in_(ACTIVE_STATUSES))

    if from_date is not None and to_date is not None:
        if from_date >= to_date:
            raise HTTPException(status_code=400, detail="Invalid date window: 'from' must be before 'to'")
        q = q.filter(Booking.check_in < to_date, Booking.check_out > from_date)
    elif from_date is not None:
        q = q.filter(Booking.check_out > from_date)
    elif to_date is not None:
        q = q.filter(Booking.check_in < to_date)

    return q.order_by(Booking.created_at.desc()).all()


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    venue = db.query(Venue).filter(Venue.id == booking.venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    is_guest = booking.guest_user_id == current_user.id
    is_host = venue.host_user_id == current_user.id
    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="Not allowed")

    # -----------------------------
    # CASE 1: Already terminal
    # -----------------------------
    if booking.status in ("CANCELLED", "EXPIRED"):
        return booking

    # -----------------------------
    # CASE 2: PENDING_PAYMENT (NO STRIPE)
    # -----------------------------
    if booking.status == "PENDING_PAYMENT":
        booking.status = "CANCELLED"
        db.commit()
        db.refresh(booking)
        return booking

    # -----------------------------
    # CASE 3: CONFIRMED → canonical flow
    # -----------------------------
    if booking.status == "CONFIRMED":
        res = cancellation_service.request_cancel(
            db, current_user, booking_id=booking_id
        )
        return CancelBookingResponse(
            booking_id=res["booking"].id,
            refund_ratio=float(res["refund_ratio"]),
            new_status=res["new_status"],
        )

    raise HTTPException(
        status_code=409,
        detail=f"Cannot cancel booking in state {booking.status}",
    )


@router.post("/bookings/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compatibility endpoint.

    Stripe webhook is the source of truth for CONFIRMED.
    """
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    venue = db.query(Venue).filter(Venue.id == booking.venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if getattr(venue, 'status', '') == 'suspended':
        raise HTTPException(status_code=409, detail='Venue is suspended')

    if venue.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status == "CONFIRMED":
        return booking

    raise HTTPException(
        status_code=409,
        detail="Booking confirmation is handled by Stripe webhook after successful payment",
    )


@router.get("/{venue_id}/calendar", response_model=list[CalendarEventOut])
def get_venue_calendar(
    venue_id: UUID,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if from_date >= to_date:
        raise HTTPException(status_code=400, detail="'from' must be before 'to'")

    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if getattr(venue, 'status', '') == 'suspended':
        raise HTTPException(status_code=409, detail='Venue is suspended')
    if venue.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    bookings = (
        db.query(Booking)
        .filter(
            Booking.venue_id == venue_id,
            Booking.status.in_(ACTIVE_STATUSES),
            Booking.check_in < to_date,
            Booking.check_out > from_date,
        )
        .all()
    )

    blocks = (
        db.query(AvailabilityBlock)
        .filter(
            AvailabilityBlock.venue_id == venue_id,
            AvailabilityBlock.start_date < to_date,
            AvailabilityBlock.end_date > from_date,
        )
        .all()
    )

    events: list[CalendarEventOut] = []

    for b in bookings:
        events.append(
            CalendarEventOut(
                type="booking",
                booking_id=b.id,
                start=b.check_in,
                end=b.check_out,
                booking_status=b.status,
            )
        )

    for bl in blocks:
        events.append(
            CalendarEventOut(
                type="blocked",
                block_id=bl.id,
                start=bl.start_date,
                end=bl.end_date,
            )
        )

    events.sort(key=lambda e: (e.start, e.end, e.type))
    return events

@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    venue = db.query(Venue).filter(Venue.id == booking.venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Authorization: only guest or host can access
    is_guest = booking.guest_user_id == current_user.id
    is_host = venue.host_user_id == current_user.id
    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="Not allowed")

    return booking

@router.get("/me", response_model=list[BookingOut])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    bookings = (
        db.query(Booking)
        .filter(Booking.guest_user_id == current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )

    return bookings