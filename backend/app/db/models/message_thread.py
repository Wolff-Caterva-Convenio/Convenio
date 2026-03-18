import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class MessageThread(Base):
    """
    A 1:1 conversation between host and renter (guest).

    Anchors:
      - venue_id: always present (supports pre-booking inquiries)
      - booking_id: optional (post-booking thread)

    Constraint:
      - one thread per booking (UNIQUE booking_id). Postgres UNIQUE allows
        multiple NULL values, so venue-only threads remain possible.
    """

    __tablename__ = "message_threads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    venue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    host_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    renter_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("booking_id", name="uq_message_threads_booking_id"),
    )