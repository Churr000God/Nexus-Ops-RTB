from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=10, max_length=128)
    role: str = Field(default="operativo")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email:
            raise ValueError("Email invalido")
        local, domain = email.split("@", 1)
        if not local or not domain or "." not in domain:
            raise ValueError("Email invalido")
        return email

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("La contrasena no puede exceder 72 bytes")
        has_letter = any(char.isalpha() for char in value)
        has_digit = any(char.isdigit() for char in value)
        if not (has_letter and has_digit):
            raise ValueError("La contrasena debe tener al menos una letra y un numero")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        allowed_roles = {"admin", "operativo", "lectura"}
        if value not in allowed_roles:
            raise ValueError("Rol invalido")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email:
            raise ValueError("Email invalido")
        local, domain = email.split("@", 1)
        if not local or not domain or "." not in domain:
            raise ValueError("Email invalido")
        return email


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    is_active: bool
    created_at: datetime


class RegisterResponse(BaseModel):
    user: UserResponse
