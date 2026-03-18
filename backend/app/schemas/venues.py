from uuid import UUID
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class VenueImageOut(BaseModel):
    id: UUID
    image_url: str
    sort_order: int
    is_cover: bool

    model_config = ConfigDict(from_attributes=True)


class VenueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    city: str = Field(min_length=1, max_length=100)
    capacity: int = Field(ge=1)

    payout_net_per_night: int = Field(ge=0)
    minimum_nights: int = Field(default=1, ge=1)

    rules_and_restrictions: str | None = Field(default=None, max_length=20000)

    venue_category: str | None = None
    venue_type: str | None = None
    image_url: str | None = None


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    host_user_id: UUID

    title: str
    description: str
    city: str
    capacity: int

    payout_net_per_night: int
    minimum_nights: int

    status: str

    rules_and_restrictions: str | None = None
    venue_category: str | None = None
    venue_type: str | None = None
    image_url: str | None = None

    cover_image_url: str | None = None
    images: list[VenueImageOut] = []


class VenueSettingsUpdate(BaseModel):
    guest_rating_filter: Literal["allow_all", "exclude_3", "exclude_5"]


class VenueBasicUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    city: str = Field(min_length=1, max_length=100)
    capacity: int = Field(ge=1)

    venue_category: str | None = None
    venue_type: str | None = None
    image_url: str | None = None

    payout_net_per_night: int | None = Field(default=None, ge=0)
    minimum_nights: int | None = Field(default=None, ge=1)
    rules_and_restrictions: str | None = Field(default=None, max_length=20000)