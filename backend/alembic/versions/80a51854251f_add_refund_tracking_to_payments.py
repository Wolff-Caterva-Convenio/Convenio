"""add refund tracking to payments

Revision ID: 80a51854251f
Revises: c9724dec3d5d
Create Date: 2026-02-24 23:54:30.504018

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80a51854251f'
down_revision: Union[str, Sequence[str], None] = 'c9724dec3d5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # Add refund tracking fields to payments
    op.add_column(
        "payments",
        sa.Column("stripe_refund_id", sa.Text(), nullable=True),
    )

    op.add_column(
        "payments",
        sa.Column("refund_requested_amount", sa.Integer(), nullable=True),
    )

    # Prevent associating multiple payments with the same Stripe refund
    op.create_index(
        "ix_payments_stripe_refund_id",
        "payments",
        ["stripe_refund_id"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index("ix_payments_stripe_refund_id", table_name="payments")

    op.drop_column("payments", "refund_requested_amount")
    op.drop_column("payments", "stripe_refund_id")