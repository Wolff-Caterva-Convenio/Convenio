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

    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # -------------------------
    # ACCOUNT STATUS
    # -------------------------
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    lock_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    penalty_debt_cents: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # -------------------------
    # SOFT DELETE
    # -------------------------
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # -------------------------
    # EMAIL VERIFICATION (NEW)
    # -------------------------
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    email_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verification_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # -------------------------
    # RELATIONSHIPS
    # -------------------------
    venues: Mapped[list["Venue"]] = relationship("Venue", back_populates="host")

    # -------------------------
    # PASSWORD RESET (NEW)
    # -------------------------
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
