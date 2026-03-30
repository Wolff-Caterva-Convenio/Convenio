"""add password reset fields

Revision ID: ba492b8e77b2
Revises: 1d1b1ce57570
Create Date: 2026-03-27 22:04:14.642782
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba492b8e77b2'
down_revision: Union[str, Sequence[str], None] = '1d1b1ce57570'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "users",
        sa.Column("password_reset_token", sa.String(length=255), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token")