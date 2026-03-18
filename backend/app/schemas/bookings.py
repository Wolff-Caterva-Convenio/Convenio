from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BookingCreate(BaseModel):
    check_in: date
    check_out: date


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    venue_id: UUID
    guest_user_id: UUID
    check_in: date
    check_out: date
    status: str
    created_at: datetime

    # NEW: pricing snapshot fields
    currency: Optional[str] = None
    amount_guest_total: Optional[int] = None
    amount_platform_fee: Optional[int] = None
    amount_host_payout: Optional[int] = None