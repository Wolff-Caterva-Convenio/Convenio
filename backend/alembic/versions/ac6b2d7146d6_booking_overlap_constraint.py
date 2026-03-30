from alembic import op

# revision identifiers, used by Alembic.
revision = "ac6b2d7146d6"
down_revision = "e4907e87b065"
branch_labels = None
depends_on = None


def upgrade():
    # Ensure only one correct constraint exists
    op.execute("""
        ALTER TABLE bookings
        DROP CONSTRAINT IF EXISTS bookings_no_double_booking;
    """)


def downgrade():
    op.execute("""
        ALTER TABLE bookings
        DROP CONSTRAINT IF EXISTS bookings_no_overlap;
    """)