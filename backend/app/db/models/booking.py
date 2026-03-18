from sqlalchemy import Column, Date, DateTime, ForeignKey, String, CheckConstraint, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    venue_id = Column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"), nullable=False)
    guest_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)

    status = Column(String(50), nullable=False, server_default=text("'PENDING_PAYMENT'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    # --- NEW: pricing snapshot (cents) ---
    currency = Column(String(10), nullable=True)
    amount_guest_total = Column(Integer, nullable=True)
    amount_platform_fee = Column(Integer, nullable=True)
    amount_host_payout = Column(Integer, nullable=True)

    # --- NEW: rules snapshot + acceptance ---
    rules_snapshot = Column(Text, nullable=True)
    gtc_version = Column(String(50), nullable=True)
    rules_accepted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("check_in < check_out", name="ck_bookings_checkin_before_checkout"),
    )

    venue = relationship("Venue")
    guest = relationship("User")