import os
from datetime import datetime, timedelta, time as dtime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models.booking import Booking
from app.db.models.dispute import Dispute
from app.db.models.venue import Venue
from app.db.models.user import User


def _now_utc() -> datetime:
    return datetime.utcnow()


def _as_checkin_dt(check_in_date) -> datetime:
    # Booking.check_in is a date; interpret as 15:00 UTC-naive for policy calculations.
    if isinstance(check_in_date, datetime):
        return check_in_date
    return datetime.combine(check_in_date, dtime(15, 0))


def _require_admin(current_user: User) -> None:
    raw = os.getenv("ADMIN_USER_IDS", "")
    allowed = {s.strip() for s in raw.split(",") if s.strip()}
    if not allowed or str(current_user.id) not in allowed:
        raise HTTPException(status_code=403, detail="Admin access required")


def create_dispute(
    *,
    db: Session,
    booking_id: UUID,
    current_user: User,
    dispute_type: str | None,
    description: str | None,
    evidence_urls: list[str] | None,
) -> Dispute:
    """Open a dispute for listing mismatch/misrepresentation.

    Agreed rule:
      - Guest can open within 24 hours AFTER check-in (not after checkout).
      - When dispute exists (OPEN/UNDER_REVIEW), payouts are held (handled in payout_service).
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only the guest can open mismatch disputes (MVP).
    if booking.guest_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the booking guest can open a dispute")

    if booking.status not in ("CONFIRMED", "COMPLETED"):
        raise HTTPException(status_code=409, detail=f"Cannot open dispute for booking in state {booking.status}")

    now = _now_utc()
    checkin = _as_checkin_dt(booking.check_in)
    if now < checkin:
        raise HTTPException(status_code=400, detail="Disputes can only be opened after check-in")

    deadline = checkin + timedelta(hours=24)
    if now > deadline:
        raise HTTPException(status_code=400, detail="Dispute window has expired (24h after check-in)")

    existing_open = (
        db.query(Dispute)
        .filter(Dispute.booking_id == booking_id)
        .filter(Dispute.status.in_(["OPEN", "UNDER_REVIEW"]))
        .one_or_none()
    )
    if existing_open:
        return existing_open

    venue = db.get(Venue, booking.venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    host_id = venue.host_user_id

    dispute = Dispute(
        booking_id=booking_id,
        complainant_user_id=current_user.id,
        respondent_user_id=host_id,
        dispute_type=(dispute_type or "MISREPRESENTATION")[:50],
        description=description,
        evidence_urls=evidence_urls or [],
        status="OPEN",
        created_at=now,
        updated_at=now,
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    return dispute


def list_disputes_for_user(db: Session, current_user: User) -> list[Dispute]:
    return (
        db.query(Dispute)
        .filter((Dispute.complainant_user_id == current_user.id) | (Dispute.respondent_user_id == current_user.id))
        .order_by(Dispute.created_at.desc())
        .all()
    )


def resolve_dispute(
    *,
    db: Session,
    dispute_id: UUID,
    current_user: User,
    outcome: str,
    notes: str | None,
    tier: int | None = None,
) -> Dispute:
    """Admin resolution.

    MVP: record tier as fields; apply manual-admin actions in-system minimally:
      - Tier 2: suspend the venue (status='suspended')
      - Tier 3: suspend all venues for the host (status='suspended')
    """
    _require_admin(current_user)

    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if dispute.status not in ("OPEN", "UNDER_REVIEW"):
        raise HTTPException(status_code=400, detail="Dispute already resolved")

    now = _now_utc()
    dispute.status = "RESOLVED"
    dispute.resolution_outcome = outcome
    dispute.resolution_notes = notes
    dispute.resolved_at = now
    dispute.updated_at = now

    if tier is not None:
        if tier not in (1, 2, 3):
            raise HTTPException(status_code=400, detail="tier must be 1, 2, or 3")
        dispute.enforcement_tier = tier

    # Apply minimal enforcement actions on APPROVED only.
    if outcome == "APPROVED" and dispute.enforcement_tier in (2, 3):
        booking = db.get(Booking, dispute.booking_id)
        if booking:
            venue = db.get(Venue, booking.venue_id)
            if venue and dispute.enforcement_tier == 2:
                venue.status = "suspended"
                db.add(venue)

            if dispute.enforcement_tier == 3 and venue:
                # "Host banned" MVP: suspend all venues owned by the host.
                db.query(Venue).filter(Venue.host_user_id == venue.host_user_id).update({Venue.status: "suspended"})

    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    return dispute
