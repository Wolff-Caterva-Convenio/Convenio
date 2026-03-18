from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models.stripe_webhook_event import StripeWebhookEvent


def reserve_stripe_event(db: Session, event_id: str) -> bool:
    """
    Try to reserve a Stripe event for processing.

    Returns:
        True  -> this worker is allowed to process the event
        False -> event was already processed
    """

    stmt = (
        insert(StripeWebhookEvent)
        .values(event_id=event_id)
        .on_conflict_do_nothing(index_elements=["event_id"])
        .returning(StripeWebhookEvent.event_id)
    )

    inserted = db.execute(stmt).scalar_one_or_none()
    return inserted is not None