"""add minimum nights

Revision ID: 2d9bf63a1c7d
Revises: f161f3ca8ddb
Create Date: (keep existing)
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2d9bf63a1c7d"
down_revision = "f161f3ca8ddb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "venues",
        sa.Column("minimum_nights", sa.Integer(), nullable=False, server_default="1"),
    )
    # optional: remove default after set (keeps schema cleaner)
    op.alter_column("venues", "minimum_nights", server_default=None)


def downgrade() -> None:
    op.drop_column("venues", "minimum_nights")