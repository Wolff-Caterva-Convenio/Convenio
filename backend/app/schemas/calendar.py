from datetime import date
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


CalendarEventType = Literal["booking", "blocked"]


class CalendarEventOut(BaseModel):
    type: CalendarEventType
    booking_id: Optional[UUID] = None
    block_id: Optional[UUID] = None
    start: date
    end: date
    booking_status: Optional[str] = None

    class Config:
        from_attributes = True