"""add messaging and reviews tables

Revision ID: 27e20ee9f9f9
Revises: e0eed3dde6f6
Create Date: 2026-02-27 04:14:18.434275
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "27e20ee9f9f9"
down_revision: Union[str, Sequence[str], None] = "e0eed3dde6f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------------- message_threads ----------------
    op.create_table(
        "message_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("host_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("renter_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_message_threads_venue_id_venues",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name="fk_message_threads_booking_id_bookings",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["host_user_id"],
            ["users.id"],
            name="fk_message_threads_host_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["renter_user_id"],
            ["users.id"],
            name="fk_message_threads_renter_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_message_threads"),
        sa.UniqueConstraint("booking_id", name="uq_message_threads_booking_id"),
    )

    op.create_index(
        "ix_message_threads_booking_id",
        "message_threads",
        ["booking_id"],
    )
    op.create_index(
        "ix_message_threads_host_user_id",
        "message_threads",
        ["host_user_id"],
    )
    op.create_index(
        "ix_message_threads_renter_user_id",
        "message_threads",
        ["renter_user_id"],
    )
    op.create_index(
        "ix_message_threads_venue_id",
        "message_threads",
        ["venue_id"],
    )

    # ---------------- reviews ----------------
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewer_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewed_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_reviews_rating_1_5",
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name="fk_reviews_booking_id_bookings",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_user_id"],
            ["users.id"],
            name="fk_reviews_reviewer_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_user_id"],
            ["users.id"],
            name="fk_reviews_reviewed_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reviews"),
        sa.UniqueConstraint(
            "booking_id",
            "reviewer_user_id",
            name="uq_reviews_booking_reviewer",
        ),
    )

    op.create_index("ix_reviews_booking_id", "reviews", ["booking_id"])
    op.create_index("ix_reviews_reviewer_user_id", "reviews", ["reviewer_user_id"])
    op.create_index("ix_reviews_reviewed_user_id", "reviews", ["reviewed_user_id"])

    # ---------------- messages ----------------
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["thread_id"],
            ["message_threads.id"],
            name="fk_messages_thread_id_message_threads",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sender_user_id"],
            ["users.id"],
            name="fk_messages_sender_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_messages"),
    )

    op.create_index("ix_messages_thread_id", "messages", ["thread_id"])
    op.create_index("ix_messages_sender_user_id", "messages", ["sender_user_id"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index("ix_messages_sender_user_id", table_name="messages")
    op.drop_index("ix_messages_thread_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_reviews_reviewed_user_id", table_name="reviews")
    op.drop_index("ix_reviews_reviewer_user_id", table_name="reviews")
    op.drop_index("ix_reviews_booking_id", table_name="reviews")
    op.drop_table("reviews")

    op.drop_index("ix_message_threads_venue_id", table_name="message_threads")
    op.drop_index("ix_message_threads_renter_user_id", table_name="message_threads")
    op.drop_index("ix_message_threads_host_user_id", table_name="message_threads")
    op.drop_index("ix_message_threads_booking_id", table_name="message_threads")
    op.drop_table("message_threads")