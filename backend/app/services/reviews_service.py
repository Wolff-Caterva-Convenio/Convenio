from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.booking import Booking
from app.db.models.review import Review
from app.db.models.user import User
from app.db.models.venue import Venue
from app.services.booking_service import complete_past_confirmed_bookings

VISIBILITY_DELAY = timedelta(days=1)


def has_user_reviewed_booking(db, booking_id, current_user):
    review = (
        db.query(Review)
        .filter(
            Review.booking_id == booking_id,
            Review.reviewer_user_id == current_user.id
        )
        .first()
    )
    return review is not None


def _maybe_unlock_visibility(db: Session, *, booking_id: UUID) -> None:
    """
    If BOTH sides have reviewed the booking, set visible_at on both reviews to now + 24h.
    """
    reviews = db.query(Review).filter(Review.booking_id == booking_id).all()
    if len(reviews) < 2:
        return

    # Only set once
    if all(r.visible_at is not None for r in reviews):
        return

    visible_at = datetime.utcnow() + VISIBILITY_DELAY
    for r in reviews:
        r.visible_at = visible_at

    db.commit()


def create_review(
    db: Session,
    current_user: User,
    *,
    booking_id: UUID,
    rating: int,
    text: str | None
) -> Review:
    # Ensure completed bookings are up to date
    complete_past_confirmed_bookings(db)

    booking = db.query(Booking).filter(Booking.id == booking_id).one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    venue = db.query(Venue).filter(Venue.id == booking.venue_id).one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    is_guest = booking.guest_user_id == current_user.id
    is_host = venue.host_user_id == current_user.id

    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status != "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail=f"Booking is {booking.status}; reviews allowed only after COMPLETED"
        )

    reviewed_user_id = venue.host_user_id if is_guest else booking.guest_user_id

    # Role-specific policy
    if is_guest:
        role = "guest_to_host"
        is_public = True
        cleaned_text = None
    else:
        role = "host_to_guest"
        is_public = False
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            raise HTTPException(
                status_code=422,
                detail="Hosts must provide a short private review text"
            )

    review = Review(
        booking_id=booking.id,
        reviewer_user_id=current_user.id,
        reviewed_user_id=reviewed_user_id,
        role=role,
        is_public=is_public,
        rating=rating,
        text=cleaned_text,
        visible_at=None,
    )

    db.add(review)

    try:
        db.commit()

    except IntegrityError as e:
        db.rollback()

        error_msg = str(e)

        # Only treat UNIQUE constraint as "already reviewed"
        if "unique" in error_msg.lower():
            raise HTTPException(
                status_code=409,
                detail="You have already reviewed this booking"
            )

        # Otherwise expose real DB error (critical for debugging)
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {error_msg}"
        )

    db.refresh(review)

    _maybe_unlock_visibility(db, booking_id=booking.id)

    db.refresh(review)
    return review


def list_reviews_for_venue(db: Session, *, venue_id: UUID) -> list[Review]:
    """Public venue reviews = guest->host ratings only, visible after delay."""
    now = datetime.utcnow()

    return (
        db.query(Review)
        .join(Booking, Booking.id == Review.booking_id)
        .filter(Booking.venue_id == venue_id)
        .filter(Review.is_public.is_(True))
        .filter(Review.visible_at.isnot(None))
        .filter(Review.visible_at <= now)
        .order_by(Review.created_at.desc())
        .all()
    )


def get_guest_average_rating(db, guest_user_id):
    ratings = (
        db.query(Review.rating)
        .filter(
            Review.reviewed_user_id == guest_user_id,
            Review.role == "host_to_guest"
        )
        .all()
    )

    if not ratings:
        return None

    values = [r[0] for r in ratings if r[0] is not None]

    if not values:
        return None

    return sum(values) / len(values)