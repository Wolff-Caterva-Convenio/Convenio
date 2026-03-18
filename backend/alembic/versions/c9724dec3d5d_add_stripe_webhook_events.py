"""add stripe_webhook_events

Revision ID: c9724dec3d5d
Revises: f161f3ca8ddb
Create Date: 2026-02-23 23:10:09.825557
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c9724dec3d5d"
down_revision: Union[str, Sequence[str], None] = "f161f3ca8ddb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stripe_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_stripe_webhook_events_event_id"),
    )

    op.create_index(
        "ix_stripe_webhook_events_event_id",
        "stripe_webhook_events",
        ["event_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_stripe_webhook_events_event_id", table_name="stripe_webhook_events")
    op.drop_table("stripe_webhook_events")