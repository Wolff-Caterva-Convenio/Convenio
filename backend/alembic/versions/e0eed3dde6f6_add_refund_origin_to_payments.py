"""add refund origin to payments

Revision ID: e0eed3dde6f6
Revises: 80a51854251f
Create Date: 2026-02-25 01:28:48.296321
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e0eed3dde6f6"
down_revision: Union[str, Sequence[str], None] = "80a51854251f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add refund_origin column to payments
    op.add_column(
        "payments",
        sa.Column("refund_origin", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    # Remove refund_origin column
    op.drop_column("payments", "refund_origin")