from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Integer, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)

    complainant_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    respondent_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    dispute_type = Column(String(50), nullable=False, server_default=text("'MISREPRESENTATION'"))
    description = Column(Text, nullable=True)

    evidence_urls = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))

    status = Column(String(30), nullable=False, server_default=text("'OPEN'"))  # OPEN | UNDER_REVIEW | RESOLVED
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    enforcement_tier = Column(Integer, nullable=True)  # 1,2,3

    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_outcome = Column(String(30), nullable=True)  # APPROVED | DENIED

    booking = relationship("Booking")
    complainant = relationship("User", foreign_keys=[complainant_user_id])
    respondent = relationship("User", foreign_keys=[respondent_user_id])
