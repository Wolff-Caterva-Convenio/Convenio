from pathlib import Path
from uuid import UUID
from datetime import date
from fastapi import Query
import uuid

from fastapi import APIRouter, Depends, status, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, selectinload

from app.db.database import get_db
from app.db.models import User, Venue
from app.db.models.booking import Booking
from app.db.models.venue_image import VenueImage
from app.db.models.availability_block import AvailabilityBlock
from app.db.models.booking import Booking
from app.dependencies.auth_dependencies import get_current_user
from app.schemas.venues import (
    VenueCreate,
    VenueOut,
    VenueBasicUpdate,
    VenueSettingsUpdate,
)
from app.services.venues_service import create_venue

router = APIRouter(prefix="/venues", tags=["venues"])

FILTER_MAP = {"allow_all": None, "exclude_3": 4, "exclude_5": 6}

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def _get_venue_or_404(db: Session, venue_id: UUID) -> Venue:
    venue = (
        db.query(Venue)
        .options(selectinload(Venue.images))
        .filter(Venue.id == venue_id)
        .one_or_none()
    )
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


def _get_owned_venue_or_403(
    db: Session,
    venue_id: UUID,
    current_user: User,
) -> Venue:
    venue = _get_venue_or_404(db, venue_id)

    if venue.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    return venue


def _delete_uploaded_file(image_url: str | None) -> None:
    if not image_url:
        return

    filename = image_url.replace("/uploads/", "").strip()
    if not filename:
        return

    path = UPLOADS_DIR / filename

    if path.exists():
        try:
            path.unlink()
        except Exception:
            pass


@router.post("", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
def create_venue_endpoint(
    payload: VenueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = create_venue(db, current_user.id, payload)
    return venue


@router.get("", response_model=list[VenueOut])
def list_venues(db: Session = Depends(get_db)):
    venues = (
        db.query(Venue)
        .options(selectinload(Venue.images))
        .all()
    )
    return venues


@router.get("/mine", response_model=list[VenueOut])
def list_my_venues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Venue)
        .options(selectinload(Venue.images))
        .filter(Venue.host_user_id == current_user.id)
        .all()
    )


@router.get("/search")
def search_venues(
    city: str | None = None,
    min_capacity: int | None = None,
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    # ✅ KEEP THIS (your existing filters)
    query = (
        db.query(Venue)
        .options(selectinload(Venue.images))
        .filter(Venue.status == "published")
    )

    if city:
        query = query.filter(Venue.city == city)

    if min_capacity:
        query = query.filter(Venue.capacity >= min_capacity)

    venues = query.all()  # 👈 instead of returning immediately

    # ✅ NEW: only apply availability filter if dates exist
    if not from_date or not to_date:
        return venues

    available_venues = []

    for venue in venues:
        # Check blocks
        overlapping_block = (
            db.query(AvailabilityBlock)
            .filter(
                AvailabilityBlock.venue_id == venue.id,
                AvailabilityBlock.start_date < to_date,
                AvailabilityBlock.end_date > from_date,
            )
            .first()
        )

        if overlapping_block:
            continue

        # Check bookings
        overlapping_booking = (
            db.query(Booking)
            .filter(
                Booking.venue_id == venue.id,
                Booking.status.in_(["PENDING_PAYMENT", "CONFIRMED"]),
                Booking.check_in < to_date,
                Booking.check_out > from_date,
            )
            .first()
        )

        if overlapping_booking:
            continue

        available_venues.append(venue)

    return available_venues


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(
    venue_id: UUID,
    db: Session = Depends(get_db),
):
    venue = _get_venue_or_404(db, venue_id)
    return venue


@router.patch("/{venue_id}", response_model=VenueOut)
def update_venue_basic_details(
    venue_id: UUID,
    payload: VenueBasicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    venue.title = payload.title.strip()
    venue.description = payload.description.strip()
    venue.city = payload.city.strip()
    venue.capacity = payload.capacity
    venue.venue_category = payload.venue_category
    venue.venue_type = payload.venue_type

    if payload.payout_net_per_night is not None:
        venue.payout_net_per_night = payload.payout_net_per_night

    if payload.minimum_nights is not None:
        venue.minimum_nights = payload.minimum_nights

    if payload.rules_and_restrictions is not None:
        venue.rules_and_restrictions = payload.rules_and_restrictions

    db.commit()
    db.refresh(venue)

    return venue


@router.post("/{venue_id}/upload-image", response_model=VenueOut)
async def upload_venue_image(
    venue_id: UUID,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    ext = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Invalid image type")

    data = await image.read()
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large")

    old_image_url = venue.image_url

    filename = f"{uuid.uuid4().hex}{ext}"
    path = UPLOADS_DIR / filename

    with open(path, "wb") as f:
        f.write(data)

    venue.image_url = f"/uploads/{filename}"

    db.commit()
    db.refresh(venue)

    _delete_uploaded_file(old_image_url)

    return venue


@router.delete("/{venue_id}/legacy-image", response_model=VenueOut)
def delete_legacy_venue_image(
    venue_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    old_image_url = venue.image_url
    venue.image_url = None

    db.commit()
    db.refresh(venue)

    _delete_uploaded_file(old_image_url)

    return venue


@router.post("/{venue_id}/images", response_model=VenueOut)
async def upload_gallery_image(
    venue_id: UUID,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    ext = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Invalid image type")

    data = await image.read()
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large")

    filename = f"{uuid.uuid4().hex}{ext}"
    path = UPLOADS_DIR / filename

    with open(path, "wb") as f:
        f.write(data)

    count = db.query(VenueImage).filter(VenueImage.venue_id == venue_id).count()

    new_image = VenueImage(
        venue_id=venue_id,
        image_url=f"/uploads/{filename}",
        sort_order=count,
        is_cover=(count == 0),
    )

    db.add(new_image)
    db.commit()
    db.refresh(venue)

    return venue


@router.post("/{venue_id}/images/{image_id}/set-cover", response_model=VenueOut)
def set_gallery_cover(
    venue_id: UUID,
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    image = (
        db.query(VenueImage)
        .filter(VenueImage.id == image_id, VenueImage.venue_id == venue_id)
        .one_or_none()
    )

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    db.query(VenueImage).filter(VenueImage.venue_id == venue_id).update(
        {"is_cover": False}
    )

    image.is_cover = True

    db.commit()
    db.refresh(venue)

    return venue


@router.delete("/{venue_id}/images/{image_id}", response_model=VenueOut)
def delete_gallery_image(
    venue_id: UUID,
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    image = (
        db.query(VenueImage)
        .filter(VenueImage.id == image_id, VenueImage.venue_id == venue_id)
        .one_or_none()
    )

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    was_cover = bool(image.is_cover)
    image_url = image.image_url

    db.delete(image)
    db.commit()

    _delete_uploaded_file(image_url)

    if was_cover:
        replacement = (
            db.query(VenueImage)
            .filter(VenueImage.venue_id == venue_id)
            .order_by(VenueImage.sort_order.asc(), VenueImage.id.asc())
            .first()
        )

        if replacement:
            replacement.is_cover = True
            db.commit()

    db.refresh(venue)
    return venue


@router.post("/{venue_id}/publish", response_model=VenueOut)
def publish_venue(
    venue_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    if venue.status == "published":
        return venue

    venue.status = "published"
    db.commit()
    db.refresh(venue)

    return venue


@router.post("/{venue_id}/unpublish", response_model=VenueOut)
def unpublish_venue(
    venue_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    if venue.status == "draft":
        return venue

    venue.status = "draft"
    db.commit()
    db.refresh(venue)

    return venue


@router.delete("/{venue_id}")
def delete_venue(
    venue_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    venue = _get_owned_venue_or_403(db, venue_id, current_user)

    has_bookings = db.query(Booking).filter(Booking.venue_id == venue_id).first()
    if has_bookings:
        raise HTTPException(status_code=400, detail="Venue cannot be deleted")

    legacy_image_url = venue.image_url

    gallery_images = (
        db.query(VenueImage)
        .filter(VenueImage.venue_id == venue_id)
        .all()
    )
    gallery_image_urls = [img.image_url for img in gallery_images]

    db.delete(venue)
    db.commit()

    _delete_uploaded_file(legacy_image_url)
    for image_url in gallery_image_urls:
        _delete_uploaded_file(image_url)

    return {"success": True}