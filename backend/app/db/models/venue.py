import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Venue(Base):
    __tablename__ = "venues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    host_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)

    city = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False)

    payout_net_per_night = Column(Integer, nullable=False, default=0)
    minimum_nights = Column(Integer, nullable=False, default=1)

    status = Column(String, nullable=False, default="draft")

    rules_and_restrictions = Column(Text, nullable=True)
    guest_rating_minimum = Column(Integer, nullable=True)

    venue_category = Column(String, nullable=True)
    venue_type = Column(String, nullable=True)

    # Legacy single-image field (keep for backward compatibility)
    image_url = Column(String, nullable=True)

    host = relationship("User", back_populates="venues")

    images = relationship(
        "VenueImage",
        back_populates="venue",
        cascade="all, delete-orphan",
        order_by="VenueImage.sort_order.asc(), VenueImage.id.asc()",
    )

    @property
    def cover_image_url(self):
        """
        Determines the cover image for the venue.
        Priority:
        1) image marked as cover
        2) first gallery image
        3) legacy image_url
        """
        if self.images:
            for img in self.images:
                if img.is_cover:
                    return img.image_url
            return self.images[0].image_url

        return self.image_url