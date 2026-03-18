from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreateIn(BaseModel):
    booking_id: UUID
    rating: int = Field(ge=1, le=10)
    # Guests provide stars only; hosts provide private text. The service enforces role-specific rules.
    text: str | None = Field(default=None, max_length=5000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    reviewer_user_id: UUID
    reviewed_user_id: UUID
    role: str
    is_public: bool
    rating: int
    text: str | None
    visible_at: datetime | None
    created_at: datetime
