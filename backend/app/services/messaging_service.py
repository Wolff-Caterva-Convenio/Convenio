from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models.booking import Booking
from app.db.models.message import Message
from app.db.models.message_thread import MessageThread
from app.db.models.user import User
from app.db.models.venue import Venue


def create_thread(db: Session, current_user: User, *, booking_id: UUID | None, venue_id: UUID | None) -> MessageThread:
    if not booking_id and not venue_id:
        raise HTTPException(status_code=400, detail="Either booking_id or venue_id is required")

    # --- Booking anchored thread (one per booking) ---
    if booking_id is not None:
        booking = db.query(Booking).filter(Booking.id == booking_id).one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        venue = db.query(Venue).filter(Venue.id == booking.venue_id).one_or_none()
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")

        # membership check
        is_guest = booking.guest_user_id == current_user.id
        is_host = venue.host_user_id == current_user.id
        if not (is_guest or is_host):
            raise HTTPException(status_code=403, detail="Not allowed")

        existing = db.query(MessageThread).filter(MessageThread.booking_id == booking_id).one_or_none()
        if existing:
            return existing

        host_id = venue.host_user_id
        renter_id = booking.guest_user_id

        thread = MessageThread(
            venue_id=venue.id,
            booking_id=booking.id,
            host_user_id=host_id,
            renter_user_id=renter_id,
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
        return thread

    # --- Venue inquiry thread (pre-booking) ---
    venue = db.query(Venue).filter(Venue.id == venue_id).one_or_none()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if venue.host_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Host cannot create an inquiry thread for own venue")

    thread = MessageThread(
        venue_id=venue.id,
        booking_id=None,
        host_user_id=venue.host_user_id,
        renter_user_id=current_user.id,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def list_threads(db: Session, current_user: User) -> list[MessageThread]:
    return (
        db.query(MessageThread)
        .filter((MessageThread.host_user_id == current_user.id) | (MessageThread.renter_user_id == current_user.id))
        .order_by(MessageThread.created_at.desc())
        .all()
    )


def list_messages(db: Session, current_user: User, *, thread_id: UUID) -> list[Message]:
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user.id not in (thread.host_user_id, thread.renter_user_id):
        raise HTTPException(status_code=403, detail="Not allowed")

    return (
        db.query(Message)
        .filter(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc())
        .all()
    )


def send_message(db: Session, current_user: User, *, thread_id: UUID, body: str) -> Message:
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user.id not in (thread.host_user_id, thread.renter_user_id):
        raise HTTPException(status_code=403, detail="Not allowed")

    msg = Message(
        thread_id=thread_id,
        sender_user_id=current_user.id,
        body=body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg