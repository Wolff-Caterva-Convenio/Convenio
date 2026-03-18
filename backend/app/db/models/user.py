import uuid
from sqlalchemy import String, DateTime, func, Boolean, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    lock_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    penalty_debt_cents: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # IMPORTANT: Fixes mapper error caused by Venue.host back_populates="venues"
    venues: Mapped[list["Venue"]] = relationship("Venue", back_populates="host")