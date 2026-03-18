"""merge heads

Revision ID: 437ef297b2b6
Revises: 27e20ee9f9f9, d2_overlap_events
Create Date: 2026-03-01 05:34:27.031652

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '437ef297b2b6'
down_revision: Union[str, Sequence[str], None] = ('27e20ee9f9f9', 'd2_overlap_events')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
