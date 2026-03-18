"""add pricing snapshot to bookings

Revision ID: f161f3ca8ddb
Revises: 8a2a3c0895f4
Create Date: 2026-02-23 20:46:36.258573
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f161f3ca8ddb"
down_revision: Union[str, Sequence[str], None] = "8a2a3c0895f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add pricing snapshot columns (nullable for now — we fill them at checkout time)
    op.add_column("bookings", sa.Column("currency", sa.String(length=10), nullable=True))
    op.add_column("bookings", sa.Column("amount_guest_total", sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("amount_platform_fee", sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("amount_host_payout", sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove them if migration rolled back
    op.drop_column("bookings", "amount_host_payout")
    op.drop_column("bookings", "amount_platform_fee")
    op.drop_column("bookings", "amount_guest_total")
    op.drop_column("bookings", "currency")