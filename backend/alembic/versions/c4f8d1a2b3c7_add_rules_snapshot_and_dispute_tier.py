"""add rules snapshot and dispute tier

Revision ID: c4f8d1a2b3c7
Revises: b7e3c2d1f0a9
Create Date: 2026-02-28

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4f8d1a2b3c7'
down_revision = 'b7e3c2d1f0a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # venues: rules & restrictions
    op.add_column('venues', sa.Column('rules_and_restrictions', sa.Text(), nullable=True))

    # bookings: rules snapshot + gtc version + acceptance timestamp
    op.add_column('bookings', sa.Column('rules_snapshot', sa.Text(), nullable=True))
    op.add_column('bookings', sa.Column('gtc_version', sa.String(length=50), nullable=True))
    op.add_column('bookings', sa.Column('rules_accepted_at', sa.DateTime(timezone=True), nullable=True))

    # disputes: enforcement tier
    op.add_column('disputes', sa.Column('enforcement_tier', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('disputes', 'enforcement_tier')
    op.drop_column('bookings', 'rules_accepted_at')
    op.drop_column('bookings', 'gtc_version')
    op.drop_column('bookings', 'rules_snapshot')
    op.drop_column('venues', 'rules_and_restrictions')
