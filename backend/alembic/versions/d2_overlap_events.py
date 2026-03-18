from alembic import op
import sqlalchemy as sa

revision = 'd2_overlap_events'
down_revision = 'd1_guest_rating_filter'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'host_overlap_events',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('venue_id', sa.Uuid(), sa.ForeignKey('venues.id'), nullable=False),
        sa.Column('booking_id', sa.Uuid(), sa.ForeignKey('bookings.id'), nullable=False),
        sa.Column('overlap_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True)
    )

def downgrade():
    op.drop_table('host_overlap_events')
