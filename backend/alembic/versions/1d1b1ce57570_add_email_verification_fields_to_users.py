"""add email verification fields to users

Revision ID: 1d1b1ce57570
Revises: ac6b2d7146d6
Create Date: 2026-03-27 20:47:00.189401
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d1b1ce57570'
down_revision: Union[str, Sequence[str], None] = 'ac6b2d7146d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.add_column(
        "users",
        sa.Column("email_verification_token", sa.String(length=255), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_token")
    op.drop_column("users", "is_verified")
