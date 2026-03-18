"""add venue_images table

Revision ID: 33b1d5f2a9c1
Revises: 32ee4ccaa77c
Create Date: 2026-03-10 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "33b1d5f2a9c1"
down_revision: Union[str, Sequence[str], None] = "32ee4ccaa77c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "venue_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("image_url", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_cover", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_venue_images_venue_id"),
        "venue_images",
        ["venue_id"],
        unique=False,
    )

    op.alter_column("venue_images", "sort_order", server_default=None)
    op.alter_column("venue_images", "is_cover", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_venue_images_venue_id"), table_name="venue_images")
    op.drop_table("venue_images")