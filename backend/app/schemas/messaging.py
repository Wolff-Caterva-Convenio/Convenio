from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ThreadCreateIn(BaseModel):
    """
    Create a thread either:
      - for a booking (post-booking conversation), OR
      - for a venue inquiry (pre-booking)
    """
    booking_id: Optional[UUID] = None
    venue_id: Optional[UUID] = None

    @model_validator(mode="after")
    def _validate_choice(self) -> "ThreadCreateIn":
        if not self.booking_id and not self.venue_id:
            raise ValueError("Either booking_id or venue_id is required")
        return self


class ThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    venue_id: UUID
    booking_id: Optional[UUID]
    host_user_id: UUID
    renter_user_id: UUID
    created_at: datetime


class MessageCreateIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thread_id: UUID
    sender_user_id: UUID
    body: str
    created_at: datetime