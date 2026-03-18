from alembic import op
import sqlalchemy as sa

revision = 'd1_guest_rating_filter'
down_revision = 'c4f8d1a2b3c7'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('venues', sa.Column('guest_rating_minimum', sa.Integer(), nullable=True))

def downgrade():
    op.drop_column('venues','guest_rating_minimum')
