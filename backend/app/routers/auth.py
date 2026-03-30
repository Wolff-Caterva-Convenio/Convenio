from uuid import UUID
from fastapi import UploadFile, File
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User
from app.db.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.dependencies.auth_dependencies import get_current_user
from app.services.email_service import send_email
from app.db.models import Booking, Venue
from app.db.schemas import UserUpdateRequest

router = APIRouter()


# -------------------------
# REGISTER
# -------------------------
@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # -------------------------
    # EMAIL VERIFICATION SETUP
    # -------------------------
    verification_token = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(hours=24)

    user.email_verification_token = verification_token
    user.email_verification_expires_at = expiry

    db.commit()
    db.refresh(user)

    # -------------------------
    # SEND VERIFICATION EMAIL
    # -------------------------
    verification_url = f"http://localhost:9000/auth/verify-email?token={verification_token}"

    send_email(
        to=user.email,
        subject="Verify your Convenio account",
        html=f"""
        <h2>Verify your email</h2>
        <p>Thanks for registering.</p>
        <p>Please confirm your email by clicking below:</p>
        <p><a href="{verification_url}">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
        """
    )

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        company_name=user.company_name,
        avatar_url=user.avatar_url,
    )


# -------------------------
# VERIFY EMAIL (STEP 1)
# -------------------------
@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    if (
        user.email_verification_expires_at is None
        or user.email_verification_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Token expired")

    # -------------------------
    # MARK VERIFIED
    # -------------------------
    user.is_verified = True
    db.commit()

    # -------------------------
    # SEND CONFIRMATION EMAIL ✅
    # -------------------------
    send_email(
        to=user.email,
        subject="Your Convenio account is verified 🎉",
        html=f"""
        <h2>You're all set!</h2>
        <p>Your email has been successfully verified.</p>
        <p>You can now log in and start using Convenio.</p>
        """
    )

    # -------------------------
    # REDIRECT TO FRONTEND
    # -------------------------
    return RedirectResponse(
        url=f"http://localhost:3000/verified?token={token}"
    )


# -------------------------
# COMPLETE VERIFICATION (STEP 2 → AUTO LOGIN)
# -------------------------
@router.post("/verify-email/complete", response_model=TokenResponse)
def complete_email_verification(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified")

    # cleanup token AFTER login
    user.email_verification_token = None
    user.email_verification_expires_at = None

    db.commit()

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)


# -------------------------
# LOGIN
# -------------------------
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 🔒 BLOCK UNVERIFIED USERS
    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


# -------------------------
# FORGOT PASSWORD
# -------------------------
@router.post("/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()

    # Always return success (security)
    if not user:
        return {"message": "If the email exists, a reset link has been sent."}

    token = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    user.password_reset_token = token
    user.password_reset_expires_at = expiry

    db.commit()

    reset_url = f"http://localhost:3000/reset-password?token={token}"

    send_email(
        to=user.email,
        subject="Reset your password",
        html=f"""
        <h2>Password Reset</h2>
        <p>Click below to reset your password:</p>
        <p><a href="{reset_url}">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        """
    )

    return {"message": "If the email exists, a reset link has been sent."}


# -------------------------
# RESET PASSWORD
# -------------------------
@router.post("/reset-password")
def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    if (
        user.password_reset_expires_at is None
        or user.password_reset_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Token expired")

    # update password
    user.password_hash = hash_password(new_password)

    # cleanup
    user.password_reset_token = None
    user.password_reset_expires_at = None

    db.commit()

    return {"message": "Password successfully reset"}


# -------------------------
# CURRENT USER
# -------------------------
@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        company_name=current_user.company_name,
        avatar_url=current_user.avatar_url,
    )


# -------------------------
# DELETE ACCOUNT
# -------------------------
@router.delete("/me", status_code=204)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    BLOCKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"]

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

    db.delete(current_user)
    db.commit()
    return None


# -------------------------
# GET USER BY ID
# -------------------------
@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
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


# -------------------------
# UPDATE USER
# -------------------------
@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


# -------------------------
# AVATAR UPLOAD
# -------------------------
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