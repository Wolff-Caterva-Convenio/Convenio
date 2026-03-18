"""Fix bookings exclusion constraint to not block EXPIRED/CANCELLED

Revision ID: 260302143504_9c82ca
Revises: 437ef297b2b6
Create Date: 2026-03-02T14:35:04.347672Z
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "260302143504_9c82ca"
down_revision = "437ef297b2b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure extension exists for GiST exclusion constraint on UUID equality
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # Drop and recreate constraint with correct WHERE clause.
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;")
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
    # Best-effort rollback: drop and recreate without WHERE (previous buggy behavior)
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;")
    op.execute(
        """
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_double_booking
        EXCLUDE USING gist (
            venue_id WITH =,
            daterange(check_in, check_out, '[)') WITH &&
        );
        """
    )
