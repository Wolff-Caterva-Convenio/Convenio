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
from app.services.booking_service import (
    expire_old_pending_payment_bookings,
    complete_past_confirmed_bookings,
)
from app.services.email_service import send_booking_confirmation_email, send_host_notification_email

# NEW: canonical cancellation service
from app.services import cancellation_service

router = APIRouter(prefix="/venues", tags=["bookings"])

ACTIVE_STATUSES = ["PENDING_PAYMENT", "CONFIRMED"]


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

    from app.services.email_service import send_booking_confirmation_email, send_host_notification_email

    send_booking_confirmation_email(
        guest_email=current_user.email,
        venue_title=venue.title,
        check_in=str(booking.check_in),
        check_out=str(booking.check_out),
        total_price=booking.total_price if hasattr(booking, "total_price") else 0
    )

    # resolve host email safely
    host_email = None
    if hasattr(venue, "owner") and venue.owner:
        host_email = venue.owner.email
    elif hasattr(venue, "owner_id"):
        host = db.query(User).filter(User.id == venue.owner_id).first()
        if host:
            host_email = host.email

    if host_email:
        send_host_notification_email(
            host_email=host_email,
            guest_email=current_user.email,
            venue_title=venue.title,
            check_in=str(booking.check_in),
            check_out=str(booking.check_out)
        )

    return booking

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


@router.get("/my-bookings", response_model=list[BookingOut])
def list_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_old_pending_payment_bookings(db)
    complete_past_confirmed_bookings(db)

    return (
        db.query(Booking)
        .filter(Booking.guest_user_id == current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )


@router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compatibility endpoint.

    Behavior:
      - If PENDING_PAYMENT: cancel locally (no payment/refund exists yet).
      - If CONFIRMED: delegate to canonical cancellation service (CANCEL_REQUESTED).
      - If already CANCELLED/EXPIRED: no-op (return booking).
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

    is_guest = booking.guest_user_id == current_user.id
    is_host = venue.host_user_id == current_user.id
    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status in ("CANCELLED", "EXPIRED"):
        return booking

    if booking.status == "PENDING_PAYMENT":
        booking.status = "CANCELLED"
        db.commit()
        db.refresh(booking)
        return booking

    if booking.status == "CONFIRMED":
        cancellation_service.request_cancel(db, current_user, booking_id=booking_id)
        db.refresh(booking)
        return booking

    raise HTTPException(status_code=409, detail=f"Cannot cancel booking in state {booking.status}")


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

@router.get("/{venue_id}/availability")
def get_public_availability(
    venue_id: UUID,
    start: date,
    end: date,
    db: Session = Depends(get_db),
):
    """
    Public endpoint used by the frontend booking page.

    Returns all unavailable date ranges for a venue
    (both confirmed bookings and host availability blocks).

    No authentication required.
    """

    if start > end:
        raise HTTPException(status_code=400, detail="start must be before end")

    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Active bookings that overlap the requested range
    bookings = (
        db.query(Booking)
        .filter(
            Booking.venue_id == venue_id,
            Booking.status.in_(["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"]),
            Booking.check_out > start,
            Booking.check_in < end,
        )
        .all()
    )

    # Host availability blocks
    blocks = (
        db.query(AvailabilityBlock)
        .filter(
            AvailabilityBlock.venue_id == venue_id,
            AvailabilityBlock.end_date > start,
            AvailabilityBlock.start_date < end,
        )
        .all()
    )

    unavailable = []

    for b in bookings:
        unavailable.append(
            {
                "type": "booking",
                "start": b.check_in,
                "end": b.check_out,
            }
        )

    for b in blocks:
        unavailable.append(
            {
                "type": "block",
                "start": b.start_date,
                "end": b.end_date,
            }
        )

    return {
        "venue_id": venue_id,
        "unavailable": unavailable,
    }