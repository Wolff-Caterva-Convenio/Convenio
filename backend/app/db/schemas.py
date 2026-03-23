from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None = None
    company_name: str | None = None
    avatar_url: str | None = None

class UserUpdateRequest(BaseModel):
    email: EmailStr | None = None
    name: str | None = None
    company_name: str | None = None
    avatar_url: str | None = None