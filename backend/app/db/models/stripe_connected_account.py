from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class StripeConnectedAccount(Base):
    __tablename__ = "stripe_connected_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    stripe_account_id = Column(Text, nullable=False, unique=True)

    onboarding_status = Column(String(20), nullable=False, server_default=text("'pending'"))

    charges_enabled = Column(Boolean, nullable=False, server_default=text("false"))
    payouts_enabled = Column(Boolean, nullable=False, server_default=text("false"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))