import uuid

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class VenueImage(Base):
    __tablename__ = "venue_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    venue_id = Column(
        UUID(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    image_url = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_cover = Column(Boolean, nullable=False, default=False)

    venue = relationship("Venue", back_populates="images")