from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DisputeCreateIn(BaseModel):
    dispute_type: str = Field(default="MISREPRESENTATION", max_length=50)
    description: str | None = Field(default=None, max_length=10000)
    evidence_urls: list[str] = Field(default_factory=list, max_length=50)


class DisputeResolveIn(BaseModel):
    outcome: str = Field(pattern="^(APPROVED|DENIED)$")
    tier: int | None = Field(default=None, ge=1, le=3)
    notes: str | None = Field(default=None, max_length=10000)


class DisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    complainant_user_id: UUID
    respondent_user_id: UUID
    dispute_type: str
    description: str | None
    evidence_urls: list[str]
    status: str
    enforcement_tier: int | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolution_outcome: str | None
    resolution_notes: str | None
