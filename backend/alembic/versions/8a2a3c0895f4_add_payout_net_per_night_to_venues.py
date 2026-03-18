"""add payout_net_per_night to venues

Revision ID: 8a2a3c0895f4
Revises: 11ece8b0b822
Create Date: 2026-02-23 20:26:00.145815
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a2a3c0895f4"
down_revision: Union[str, Sequence[str], None] = "11ece8b0b822"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the column and temporarily give it a default so existing rows get a value
    op.add_column(
        "venues",
        sa.Column(
            "payout_net_per_night",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # Remove the default afterward (future inserts must provide a value)
    op.alter_column("venues", "payout_net_per_night", server_default=None)


def downgrade() -> None:
    # Remove the column if migration is rolled back
    op.drop_column("venues", "payout_net_per_night")