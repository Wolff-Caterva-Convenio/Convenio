from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class CancellationEvent(Base):
    __tablename__ = "cancellation_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    actor_role = Column(String(20), nullable=False)  # 'guest' | 'host'
    refund_ratio = Column(Integer, nullable=False, server_default=text("0"))  # ratio * 100 (e.g., 95)
    refund_amount = Column(Integer, nullable=False, server_default=text("0"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    booking = relationship("Booking")
    actor = relationship("User")
