from __future__ import annotations

import os
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException
from app.services.email_service import (
    send_booking_confirmation_email,
    send_host_notification_email,
)

# Configurable in dev/test to avoid "15 min hold" pain during local onboarding flows.
PENDING_PAYMENT_EXPIRY_MINUTES = int(os.getenv("BOOKING_PENDING_PAYMENT_EXPIRY_MINUTES", "15"))


def expire_old_pending_payment_bookings(db: Session, minutes: int = PENDING_PAYMENT_EXPIRY_MINUTES) -> None:
    """
    Lazy expiration: any PENDING_PAYMENT booking older than N minutes becomes EXPIRED.
    This prevents unpaid holds from blocking inventory forever.
    """
    db.execute(
        text(
            """
            UPDATE bookings
            SET status = 'EXPIRED'
            WHERE status = 'PENDING_PAYMENT'
              AND created_at < (now() - make_interval(mins => :mins))
            """
        ),
        {"mins": minutes},
    )
    db.commit()


def complete_past_confirmed_bookings(db: Session) -> None:
    """
    Lazy completion: any CONFIRMED booking whose check_out date has passed becomes COMPLETED.
    """
    db.execute(
        text(
            """
            UPDATE bookings
            SET status = 'COMPLETED'
            WHERE status = 'CONFIRMED'
              AND check_out <= CURRENT_DATE
            """
        )
    )
    db.commit()

    # IMPORTANT:
    # Payout processing must never break unrelated endpoints like "create booking".
    # So we run payouts in a best-effort, non-fatal way.
    try:
        from app.services.payout_service import process_due_payouts
        process_due_payouts(db)
    except Exception as e:
        print("WARN: process_due_payouts failed (non-fatal):", str(e))


def _check_guest_rating_allowed(db, venue, guest) -> None:
    """Raises 403 if venue enforces a minimum guest rating and guest is below it."""
    from app.services.reviews_service import get_guest_average_rating

    threshold = getattr(venue, "guest_rating_minimum", None)
    if threshold is None:
        return

    rating = get_guest_average_rating(db, guest.id)
    if rating is None:
        return

    if rating < threshold:
        raise HTTPException(status_code=403, detail="This venue’s booking requirements are not met.")


# Overlap monitoring (should be rare because DB exclusion constraint prevents overlaps)
from app.db.models.booking import Booking
from app.db.models.host_overlap_event import HostOverlapEvent


def log_overlap_event(db: Session, venue, new_booking: Booking) -> None:
    """
    Defensive monitoring: if (due to bad data / schema drift) a confirmed booking overlaps
    another active booking for the same venue, record an overlap event.

    Note: overlap across different venues is allowed by product rules; we only monitor within venue.
    """
    overlap_count = (
        db.query(Booking)
        .filter(
            Booking.venue_id == venue.id,
            Booking.status.in_(["PENDING_PAYMENT", "CONFIRMED"]),
            Booking.check_in < new_booking.check_out,
            Booking.check_out > new_booking.check_in,
        )
        .count()
    )

    # If everything is correct, overlap_count should never exceed 1.
    if overlap_count > 1:
        db.add(
            HostOverlapEvent(
                venue_id=venue.id,
                booking_id=new_booking.id,
                overlap_count=overlap_count,
            )
        )
        db.commit()
