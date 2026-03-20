from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db import models
from app.db.models.booking import Booking
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.availability import AvailabilityBlockCreate, AvailabilityBlockOut
from app.services.availability_service import create_availability_block, AvailabilityOverlapError
from app.services.booking_service import expire_old_pending_payment_bookings

router = APIRouter(prefix="/venues", tags=["availability"])

ACTIVE_BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED"]


# -----------------------------
# CREATE AVAILABILITY BLOCK
# -----------------------------
@router.post(
    "/{venue_id}/availability-blocks",
    response_model=AvailabilityBlockOut,
    status_code=status.HTTP_201_CREATED,
)
def create_block_endpoint(
    venue_id: str,
    payload: AvailabilityBlockCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    venue = db.query(models.Venue).filter(models.Venue.id == venue_id).one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if venue.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the venue host can manage availability")

    try:
        return create_availability_block(db, venue_id, payload)
    except AvailabilityOverlapError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Availability block overlaps an existing block for this venue.",
        )


# -----------------------------
# LIST AVAILABILITY BLOCKS
# -----------------------------
@router.get("/{venue_id}/availability-blocks", response_model=List[AvailabilityBlockOut])
def list_blocks(venue_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.AvailabilityBlock)
        .filter(models.AvailabilityBlock.venue_id == venue_id)
        .order_by(models.AvailabilityBlock.start_date.asc())
        .all()
    )


# -----------------------------
# DELETE AVAILABILITY BLOCK
# -----------------------------
@router.delete("/availability-blocks/{block_id}")
def delete_block(
    block_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expire_old_pending_payment_bookings(db)

    block = db.get(models.AvailabilityBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    venue = db.get(models.Venue, block.venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if venue.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your venue")

    overlapping_booking = (
        db.query(Booking)
        .filter(
            Booking.venue_id == block.venue_id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.check_in < block.end_date,
            Booking.check_out > block.start_date,
        )
        .first()
    )

    if overlapping_booking is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete this availability block because there is an active booking overlapping it.",
        )

    db.delete(block)
    db.commit()
    return {"success": True}


# -----------------------------
# CHECK IF DATES ARE BOOKABLE
# -----------------------------
@router.get("/{venue_id}/availability-check")
def check_availability(
    venue_id: str,
    check_in: date,
    check_out: date,
    db: Session = Depends(get_db),
):
    expire_old_pending_payment_bookings(db)

    if check_in >= check_out:
        raise HTTPException(status_code=400, detail="Invalid date range")

    # Check blocks
    overlapping_block = (
        db.query(models.AvailabilityBlock)
        .filter(
            models.AvailabilityBlock.venue_id == venue_id,
            models.AvailabilityBlock.start_date < check_out,
            models.AvailabilityBlock.end_date > check_in,
        )
        .first()
    )

    if overlapping_block:
        return {"available": False, "reason": "BLOCKED"}

    # Check bookings
    overlapping_booking = (
        db.query(Booking)
        .filter(
            Booking.venue_id == venue_id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )
        .first()
    )

    if overlapping_booking:
        return {"available": False, "reason": "BOOKED"}

    return {"available": True}


# -----------------------------
# PUBLIC UNAVAILABLE RANGES
# -----------------------------
@router.get("/{venue_id}/availability")
def get_public_availability(
    venue_id: str,
    start: date = Query(..., description="Start of window (YYYY-MM-DD)"),
    end: date = Query(..., description="End of window (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """
    Public endpoint used by the frontend booking page.

    Returns ALL unavailable date ranges:
      - Host availability blocks
      - Active bookings (PENDING_PAYMENT + CONFIRMED)

    Response format:
    {
      "unavailable": [
        { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
      ]
    }
    """

    if start >= end:
        raise HTTPException(status_code=400, detail="start must be before end")

    # Clean expired holds
    expire_old_pending_payment_bookings(db)

    venue = db.query(models.Venue).filter(models.Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Blocks
    blocks = (
        db.query(models.AvailabilityBlock)
        .filter(
            models.AvailabilityBlock.venue_id == venue_id,
            models.AvailabilityBlock.end_date > start,
            models.AvailabilityBlock.start_date < end,
        )
        .all()
    )

    # Bookings
    bookings = (
        db.query(Booking)
        .filter(
            Booking.venue_id == venue_id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.check_out > start,
            Booking.check_in < end,
        )
        .all()
    )

    unavailable = []

    for b in bookings:
        unavailable.append({
            "start": b.check_in.isoformat(),
            "end": b.check_out.isoformat(),
        })

    for b in blocks:
        unavailable.append({
            "start": b.start_date.isoformat(),
            "end": b.end_date.isoformat(),
        })

    return {"unavailable": unavailable}