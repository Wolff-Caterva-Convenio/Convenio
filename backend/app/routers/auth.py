from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User
from app.db.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.dependencies.auth_dependencies import get_current_user
from app.services.email_service import send_email  # Added email service

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

    return UserResponse(id=user.id, email=user.email)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email)


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

    return UserResponse(id=user.id, email=user.email)