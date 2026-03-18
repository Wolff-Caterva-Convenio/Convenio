from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))

    booking_id = Column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    provider = Column(String(20), nullable=False, server_default=text("'stripe'"))

    stripe_checkout_session_id = Column(Text, nullable=True, unique=True)
    stripe_payment_intent_id = Column(Text, nullable=True, unique=True)
    stripe_charge_id = Column(Text, nullable=True)

    # --- refund tracking (idempotency + reconciliation) ---
    stripe_refund_id = Column(Text, nullable=True, unique=True)
    refund_requested_amount = Column(Integer, nullable=True)

    # --- refund reconciliation metadata ---
    # 'api' | 'manual' | (future) 'dispute' | 'unknown'
    refund_origin = Column(String(20), nullable=True)

    status = Column(String(30), nullable=False, server_default=text("'processing'"))

    amount_guest_total = Column(Integer, nullable=False)
    amount_platform_fee = Column(Integer, nullable=False)
    amount_host_payout = Column(Integer, nullable=False)
    currency = Column(String(10), nullable=False)

    refunded_amount_total = Column(Integer, nullable=False, server_default=text("0"))

    # --- host payout processing (delayed to after checkout) ---
    payout_status = Column(String(30), nullable=False, server_default=text("'PENDING'"))
    stripe_transfer_id = Column(Text, nullable=True, unique=True)
    transferred_amount = Column(Integer, nullable=False, server_default=text("0"))
    payout_processed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    booking = relationship("Booking")