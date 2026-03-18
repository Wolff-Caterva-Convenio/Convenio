import uuid
from datetime import date
from sqlalchemy import ForeignKey, Date, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class AvailabilityBlock(Base):
    __tablename__ = "availability_blocks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id"), nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        CheckConstraint("start_date < end_date", name="availability_start_before_end"),
    )