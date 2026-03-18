"""add bookings

Revision ID: 0592fec0905c
Revises: 9fecfc51cd9c
Create Date: 2026-02-22 20:54:20.494884

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0592fec0905c"
down_revision: Union[str, Sequence[str], None] = "9fecfc51cd9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Needed for GiST exclusion constraint combining UUID equality with range overlap
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # Create bookings table
    op.create_table(
        "bookings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "venue_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("venues.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "guest_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("check_in", sa.Date(), nullable=False),
        sa.Column("check_out", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'PENDING_PAYMENT'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # disallow zero-night / backwards bookings
        sa.CheckConstraint("check_in < check_out", name="ck_bookings_checkin_before_checkout"),
    )

    # Helpful index for queries by venue + date
    op.create_index("ix_bookings_venue_id", "bookings", ["venue_id"])
    op.create_index("ix_bookings_guest_user_id", "bookings", ["guest_user_id"])
    op.create_index("ix_bookings_status", "bookings", ["status"])

    # DB-level anti-double-booking:
    # Prevent overlapping [check_in, check_out) per venue for active statuses only.
    #
    # - '[)' means inclusive start (check_in), exclusive end (check_out)
    # - '&&' means ranges overlap
    # - WHERE clause means CANCELLED / EXPIRED do not block
    op.execute(
        """
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_double_booking
        EXCLUDE USING gist (
            venue_id WITH =,
            daterange(check_in, check_out, '[)') WITH &&
        )
        WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED'));
        """
    )


def downgrade() -> None:
    # Drop exclusion constraint first, then indexes, then table
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;")

    op.drop_index("ix_bookings_status", table_name="bookings")
    op.drop_index("ix_bookings_guest_user_id", table_name="bookings")
    op.drop_index("ix_bookings_venue_id", table_name="bookings")

    op.drop_table("bookings")

    # NOTE: We intentionally do NOT drop the btree_gist extension in downgrade,
    # because it may be used by other constraints/tables in the DB.