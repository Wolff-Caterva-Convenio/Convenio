"""add availability overlap constraint

Revision ID: 9fecfc51cd9c
Revises: 02842078d6d1
"""

from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9fecfc51cd9c"
down_revision: Union[str, Sequence[str], None] = "02842078d6d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")
    op.execute("""
        ALTER TABLE availability_blocks
        ADD CONSTRAINT no_overlapping_availability
        EXCLUDE USING gist (
            venue_id WITH =,
            daterange(start_date, end_date, '[)') WITH &&
        );
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE availability_blocks
        DROP CONSTRAINT IF EXISTS no_overlapping_availability;
    """)
