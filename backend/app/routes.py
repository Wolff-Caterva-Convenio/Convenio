from fastapi import APIRouter, Depends, HTTPException, Header
from .auth import hash_password, verify_password, create_access_token, decode_token
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .db import SessionLocal
from . import models

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RegisterIn(BaseModel):
    email: str
    full_name: str
    password: str = Field(min_length=8, max_length=72)
    role: str = "host"

class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=72)

def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/auth/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}

@router.post("/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
def me(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}

class VenueCreate(BaseModel):
    title: str
    city: str = ""
    capacity: int = 1
    payout_net_per_night: int = 10000  # cents

@router.get("/venues")
def list_venues(db: Session = Depends(get_db)):
    venues = db.query(models.Venue).order_by(models.Venue.created_at.desc()).all()
    return [
        {
            "id": str(v.id),
            "title": v.title,
            "city": v.city,
            "capacity": v.capacity,
            "payout_net_per_night": v.payout_net_per_night,
        }
        for v in venues
    ]

@router.post("/venues")
def create_venue(payload: VenueCreate, db: Session = Depends(get_db)):
    v = models.Venue(
        title=payload.title,
        city=payload.city,
        capacity=payload.capacity,
        payout_net_per_night=payload.payout_net_per_night,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {
        "id": str(v.id),
        "title": v.title,
        "city": v.city,
        "capacity": v.capacity,
        "payout_net_per_night": v.payout_net_per_night,
    }

# -----------------------------
# AVAILABILITY BLOCKS
# -----------------------------

@router.get("/venues/{venue_id}/availability-blocks")
def list_availability_blocks(
    venue_id: str,
    db: Session = Depends(get_db),
):
    blocks = (
        db.query(models.AvailabilityBlock)
        .filter(models.AvailabilityBlock.venue_id == venue_id)
        .order_by(models.AvailabilityBlock.start_date.asc())
        .all()
    )

    return [
        {
            "id": str(b.id),
            "start_date": b.start_date,
            "end_date": b.end_date,
        }
        for b in blocks
    ]


@router.delete("/availability-blocks/{block_id}")
def delete_availability_block(
    block_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    block = db.get(models.AvailabilityBlock, block_id)

    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    venue = db.get(models.Venue, block.venue_id)

    # Only host can delete
    if str(venue.host_user_id) != user_id:
        raise HTTPException(status_code=403, detail="Not your venue")

    db.delete(block)
    db.commit()

    return {"success": True}
