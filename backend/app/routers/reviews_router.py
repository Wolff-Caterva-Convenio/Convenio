from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.review import Review
from app.db.models.user import User
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.reviews import ReviewCreateIn, ReviewOut
from app.services import reviews_service

router = APIRouter(tags=["reviews"])


# ✅ CREATE REVIEW
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


# ✅ LIST REVIEWS FOR VENUE
@router.get("/venues/{venue_id}/reviews", response_model=list[ReviewOut])
def list_venue_reviews_endpoint(
    venue_id: UUID,
    db: Session = Depends(get_db),
):
    return reviews_service.list_reviews_for_venue(db, venue_id=venue_id)


# ✅ GET REVIEW FOR CURRENT USER BY BOOKING
@router.get("/reviews/by-booking/{booking_id}")
def get_review_by_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = (
        db.query(Review)  # ✅ CORRECT MODEL
        .filter(
            Review.booking_id == booking_id,
            Review.reviewer_user_id == current_user.id,
        )
        .first()
    )

    if not review:
        return {}

    return {"rating": review.rating}