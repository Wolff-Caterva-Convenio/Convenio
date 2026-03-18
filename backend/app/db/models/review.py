import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Review(Base):
    """
    Reviews are anchored to bookings.

    A single booking can yield up to 2 reviews:
      - guest -> host (public rating only; no text)
      - host -> guest (private review; hosts only)

    Visibility rule (agreed in Process_Management_Refinement):
      - Ratings become visible only after BOTH parties have submitted,
        and only after a 24h delay (anti-retaliation / pressure).

    Enforced via UNIQUE(booking_id, reviewer_user_id).
    """

    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    reviewer_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    reviewed_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "guest_to_host" | "host_to_guest"
    role: Mapped[str] = mapped_column(String(32), nullable=False)

    # Public means it can be shown on venue pages (guest->host only).
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 1..10 scale (display can be e.g. 8.7/10 when averaged on the UI).
    rating: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional. Guests do not provide public text reviews (stars only).
    text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # When this review becomes visible to the other party / public.
    # Set once BOTH reviews exist, to "now + 1 day".
    visible_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("booking_id", "reviewer_user_id", name="uq_reviews_booking_reviewer"),
        CheckConstraint("rating >= 1 AND rating <= 10", name="ck_reviews_rating_1_10"),
        CheckConstraint("role IN ('guest_to_host','host_to_guest')", name="ck_reviews_role"),
    )
