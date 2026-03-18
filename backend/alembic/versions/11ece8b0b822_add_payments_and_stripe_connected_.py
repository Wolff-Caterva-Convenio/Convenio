"""add payments and stripe connected accounts

Revision ID: 11ece8b0b822
Revises: 0592fec0905c
Create Date: 2026-02-23 01:36:00.646801

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "11ece8b0b822"
down_revision: Union[str, Sequence[str], None] = "0592fec0905c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTE: Your project already uses gen_random_uuid() on bookings.id
    # (see Booking model), so we keep the same UUID default here. :contentReference[oaicite:2]{index=2}

    op.create_table(
        "stripe_connected_accounts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("stripe_account_id", sa.Text(), nullable=False, unique=True),
        sa.Column(
            "onboarding_status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "charges_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "payouts_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "payments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "provider",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'stripe'"),
        ),
        sa.Column("stripe_checkout_session_id", sa.Text(), nullable=True, unique=True),
        sa.Column("stripe_payment_intent_id", sa.Text(), nullable=True, unique=True),
        sa.Column("stripe_charge_id", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("'processing'"),
        ),
        sa.Column("amount_guest_total", sa.Integer(), nullable=False),
        sa.Column("amount_platform_fee", sa.Integer(), nullable=False),
        sa.Column("amount_host_payout", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column(
            "refunded_amount_total",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("stripe_connected_accounts")