from datetime import datetime, timedelta, timezone
import uuid

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(pw: str) -> str:
    return pwd.hash(pw)


def verify_password(pw: str, pw_hash: str) -> bool:
    return pwd.verify(pw, pw_hash)


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        sub = payload.get("sub")
        if not sub:
            raise ValueError("missing_sub")
        return sub
    except JWTError:
        raise ValueError("invalid_token")