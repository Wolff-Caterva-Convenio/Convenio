from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.messaging import ThreadCreateIn, ThreadOut, MessageCreateIn, MessageOut
from app.services import messaging_service

router = APIRouter(prefix="/threads", tags=["messaging"])


@router.post("", response_model=ThreadOut, status_code=status.HTTP_201_CREATED)
def create_thread_endpoint(
    payload: ThreadCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = messaging_service.create_thread(
        db,
        current_user,
        booking_id=payload.booking_id,
        venue_id=payload.venue_id,
    )
    return thread


@router.get("", response_model=list[ThreadOut])
def list_threads_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return messaging_service.list_threads(db, current_user)


@router.get("/{thread_id}/messages", response_model=list[MessageOut])
def list_messages_endpoint(
    thread_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return messaging_service.list_messages(db, current_user, thread_id=thread_id)


@router.post("/{thread_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message_endpoint(
    thread_id: UUID,
    payload: MessageCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return messaging_service.send_message(db, current_user, thread_id=thread_id, body=payload.body)