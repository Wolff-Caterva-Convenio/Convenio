from uuid import UUID
from fastapi import UploadFile, File
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User
from app.db.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.dependencies.auth_dependencies import get_current_user
from app.services.email_service import send_email  # Added email service
from app.db.models import Booking, Venue
from app.db.schemas import UserUpdateRequest

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    # -------------------------
    # SEND WELCOME EMAIL
    # -------------------------
    send_email(
        to=user.email,
        subject="Welcome to Convenio",
        html=f"""
        <h2>Welcome to Convenio 🎉</h2>
        <p>Your account has been successfully created.</p>
        <p>You can now start booking venues.</p>
        """
    )


    return UserResponse(
        id=user.id, 
        email=user.email,
        name=user.name,
        company_name=user.company_name,
        avatar_url=user.avatar_url,
    )

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
    id=current_user.id,
    email=current_user.email,
    name=current_user.name,
    company_name=current_user.company_name,
    avatar_url=current_user.avatar_url,
)


@router.delete("/me", status_code=204)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -------------------------
    # BLOCKING STATUSES
    # -------------------------
    BLOCKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"]

    # -------------------------
    # 1. Check guest bookings
    # -------------------------
    guest_booking = db.scalar(
        select(Booking).where(
            Booking.guest_user_id == current_user.id,
            Booking.status.in_(BLOCKING_STATUSES),
        )
    )

    if guest_booking:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete account: you have active or completed bookings.",
        )

    # -------------------------
    # 2. Check host bookings
    # -------------------------
    host_booking = db.scalar(
        select(Booking)
        .join(Venue, Booking.venue_id == Venue.id)
        .where(
            Venue.host_user_id == current_user.id,
            Booking.status.in_(BLOCKING_STATUSES),
        )
    )

    if host_booking:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete account: your venues have active or completed bookings.",
        )

    # -------------------------
    # 3. Delete user
    # -------------------------
    db.delete(current_user)
    db.commit()

    return None


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    MVP helper endpoint:
    Resolve a user UUID to {id, email}.
    Used by host booking UIs to show guest emails instead of IDs.
    """
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")


    return UserResponse(
        id=user.id, 
        email=user.email,
        name=user.name,
        company_name=user.company_name,
        avatar_url=user.avatar_url,
    )

@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -------------------------
    # Update fields safely
    # -------------------------
    if body.email is not None:
        existing = db.scalar(
            select(User).where(User.email == body.email, User.id != current_user.id)
        )
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        current_user.email = body.email

    if body.name is not None:
        current_user.name = body.name

    if body.company_name is not None:
        current_user.company_name = body.company_name

    db.commit()
    db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        company_name=current_user.company_name,
        avatar_url=current_user.avatar_url,
    )

UPLOAD_DIR = "uploads/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/me/avatar", response_model=UserResponse)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as buffer:
        buffer.write(file.file.read())

    current_user.avatar_url = f"/uploads/avatars/{filename}"

    db.commit()
    db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        company_name=current_user.company_name,
        avatar_url=current_user.avatar_url,
    )