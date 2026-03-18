from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.database import Base


class Venue(Base):
    __tablename__ = "venues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    host_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)

    description = Column(Text, nullable=False)

    city = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False)

    payout_net_per_night = Column(Integer, nullable=False, default=0)

    minimum_nights = Column(Integer, nullable=False, default=1)

    status = Column(String, nullable=False, default="draft")

    rules_and_restrictions = Column(Text, nullable=True)
    guest_rating_minimum = Column(Integer, nullable=True)

    # NEW
    venue_category = Column(String, nullable=True)
    venue_type = Column(String, nullable=True)

    host = relationship("User", back_populates="venues")