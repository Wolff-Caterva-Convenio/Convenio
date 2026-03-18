"""merge heads

Revision ID: 32ee4ccaa77c
Revises: 260302143504_9c82ca, 2d9bf63a1c7d
Create Date: 2026-03-05 14:57:59.867995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32ee4ccaa77c'
down_revision: Union[str, Sequence[str], None] = ('260302143504_9c82ca', '2d9bf63a1c7d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
