from sqlalchemy.orm import Session
from app.db.models.venue import Venue
from app.schemas.venues import VenueCreate


def create_venue(db: Session, host_user_id, data: VenueCreate) -> Venue:
    venue = Venue(
        host_user_id=host_user_id,
        title=data.title,
        description=data.description,
        city=data.city,
        capacity=data.capacity,
        payout_net_per_night=data.payout_net_per_night,
        minimum_nights=data.minimum_nights,
        rules_and_restrictions=getattr(data, "rules_and_restrictions", None),
        venue_category=data.venue_category,
        venue_type=data.venue_type,
        image_url=data.image_url,
        status="draft",
    )
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue