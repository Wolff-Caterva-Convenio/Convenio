"""add disputes table

Revision ID: b7e3c2d1f0a9
Revises: aa12bc34de56
Create Date: 2026-02-28

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b7e3c2d1f0a9"
down_revision = "aa12bc34de56"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "disputes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("complainant_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("respondent_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dispute_type", sa.String(length=50), nullable=False, server_default=sa.text("'MISREPRESENTATION'")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'OPEN'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolution_outcome", sa.String(length=30), nullable=True),
    )
    op.create_index("ix_disputes_booking_id", "disputes", ["booking_id"])
    op.create_index("ix_disputes_status", "disputes", ["status"])


def downgrade() -> None:
    op.drop_index("ix_disputes_status", table_name="disputes")
    op.drop_index("ix_disputes_booking_id", table_name="disputes")
    op.drop_table("disputes")
