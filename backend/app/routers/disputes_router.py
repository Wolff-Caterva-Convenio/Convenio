from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.disputes import DisputeCreateIn, DisputeOut, DisputeResolveIn
from app.services.disputes_service import create_dispute, list_disputes_for_user, resolve_dispute

router = APIRouter(prefix="", tags=["disputes"])


@router.post("/bookings/{booking_id}/disputes", response_model=DisputeOut, status_code=201)
def open_dispute(
    booking_id: UUID,
    body: DisputeCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_dispute(
        db=db,
        booking_id=booking_id,
        current_user=current_user,
        dispute_type=body.dispute_type,
        description=body.description,
        evidence_urls=body.evidence_urls,
    )


@router.get("/disputes/me", response_model=list[DisputeOut])
def my_disputes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_disputes_for_user(db=db, current_user=current_user)


@router.post("/disputes/{dispute_id}/resolve", response_model=DisputeOut)
def admin_resolve(
    dispute_id: UUID,
    body: DisputeResolveIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resolve_dispute(db=db, dispute_id=dispute_id, current_user=current_user, outcome=body.outcome, notes=body.notes, tier=body.tier)
