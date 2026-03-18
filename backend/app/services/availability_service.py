from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.models.availability_block import AvailabilityBlock
from app.schemas.availability import AvailabilityBlockCreate
import psycopg.errors


class AvailabilityOverlapError(Exception):
    pass


def create_availability_block(db: Session, venue_id, data: AvailabilityBlockCreate) -> AvailabilityBlock:
    block = AvailabilityBlock(
        venue_id=venue_id,
        start_date=data.start_date,
        end_date=data.end_date,
    )

    db.add(block)

    try:
        db.commit()

    except IntegrityError as e:
        db.rollback()

        # PostgreSQL exclusion constraint (overlap)
        if isinstance(e.orig, psycopg.errors.ExclusionViolation):
            raise AvailabilityOverlapError(
                "This venue already has availability during these dates."
            ) from e

        # Any other DB integrity error → rethrow
        raise

    db.refresh(block)
    return block