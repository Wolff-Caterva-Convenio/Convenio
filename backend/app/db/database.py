from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from sqlalchemy.exc import IllegalStateChangeError

from app.core.config import settings

# Create DB engine
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Create session factory
# NOTE: expire_on_commit=False is usually safer for API apps (prevents lazy refresh surprises)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


# Base class for models
class Base(DeclarativeBase):
    pass


# Dependency used by FastAPI routes
def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        # During reload/shutdown, FastAPI/AnyIO can cancel a request while SQLAlchemy
        # is still acquiring a connection in a worker thread. In that rare case,
        # Session.close() can raise IllegalStateChangeError.
        #
        # Swallowing that specific error prevents the server from getting wedged/crashing
        # during dev reloads, without changing normal request behavior.
        try:
            db.close()
        except IllegalStateChangeError:
            # Best effort cleanup; don't crash the app during shutdown/reload.
            try:
                db.rollback()
            except Exception:
                pass