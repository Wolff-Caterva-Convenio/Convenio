"""add lock, payout delay, and cancellation events

Revision ID: aa12bc34de56
Revises: f161f3ca8ddb
Create Date: 2026-02-28

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "aa12bc34de56"
down_revision = "f161f3ca8ddb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users: lock + penalty debt
    op.add_column("users", sa.Column("is_locked", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("users", sa.Column("lock_reason", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("penalty_debt_cents", sa.Integer(), server_default=sa.text("0"), nullable=False))

    # payments: payout processing
    op.add_column("payments", sa.Column("payout_status", sa.String(length=30), server_default=sa.text("'PENDING'"), nullable=False))
    op.add_column("payments", sa.Column("stripe_transfer_id", sa.Text(), nullable=True))
    op.add_column("payments", sa.Column("transferred_amount", sa.Integer(), server_default=sa.text("0"), nullable=False))
    op.add_column("payments", sa.Column("payout_processed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_payments_stripe_transfer_id", "payments", ["stripe_transfer_id"])

    # cancellation events
    op.create_table(
        "cancellation_events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("booking_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_role", sa.String(length=20), nullable=False),
        sa.Column("refund_ratio", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("refund_amount", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cancellation_events_actor_user_id", "cancellation_events", ["actor_user_id"])
    op.create_index("ix_cancellation_events_booking_id", "cancellation_events", ["booking_id"])


def downgrade() -> None:
    op.drop_index("ix_cancellation_events_booking_id", table_name="cancellation_events")
    op.drop_index("ix_cancellation_events_actor_user_id", table_name="cancellation_events")
    op.drop_table("cancellation_events")

    op.drop_constraint("uq_payments_stripe_transfer_id", "payments", type_="unique")
    op.drop_column("payments", "payout_processed_at")
    op.drop_column("payments", "transferred_amount")
    op.drop_column("payments", "stripe_transfer_id")
    op.drop_column("payments", "payout_status")

    op.drop_column("users", "penalty_debt_cents")
    op.drop_column("users", "lock_reason")
    op.drop_column("users", "is_locked")
