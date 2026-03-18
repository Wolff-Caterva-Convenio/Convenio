from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AvailabilityBlockCreate(BaseModel):
    start_date: date
    end_date: date


class AvailabilityBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    venue_id: UUID
    start_date: date
    end_date: date