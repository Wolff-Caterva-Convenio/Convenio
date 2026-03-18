from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.reviews import ReviewCreateIn, ReviewOut
from app.services import reviews_service

router = APIRouter(tags=["reviews"])


@router.post("/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review_endpoint(
    payload: ReviewCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reviews_service.create_review(
        db,
        current_user,
        booking_id=payload.booking_id,
        rating=payload.rating,
        text=payload.text,
    )


@router.get("/venues/{venue_id}/reviews", response_model=list[ReviewOut])
def list_venue_reviews_endpoint(
    venue_id: UUID,
    db: Session = Depends(get_db),
):
    return reviews_service.list_reviews_for_venue(db, venue_id=venue_id)