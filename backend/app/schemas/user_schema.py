from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RoleSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_id: int
    code: str
    name: str
    description: str | None = None


class PermissionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    permission_id: int
    code: str
    description: str | None = None


class UserUpdateSchema(BaseModel):
    """Campos que el admin puede modificar en un usuario existente.
    La asignación de roles RBAC se gestiona por endpoints dedicados."""

    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("La contrasena no puede exceder 72 bytes")
        has_letter = any(char.isalpha() for char in value)
        has_digit = any(char.isdigit() for char in value)
        if not (has_letter and has_digit):
            raise ValueError("La contrasena debe tener al menos una letra y un numero")
        return value


class AssignRoleRequest(BaseModel):
    role_code: str


class CreateRoleRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    permission_codes: list[str] = []

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        import re
        value = value.strip()
        if not re.match(r"^[A-Za-z][A-Za-z0-9_]*$", value):
            raise ValueError("Código solo puede contener letras, números y guiones bajos, y debe empezar con letra")
        return value.upper()


class RoleWithPermissions(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_id: int
    code: str
    name: str
    description: str | None = None
    permissions: list[PermissionSchema]


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    audit_id: int
    user_id: UUID | None
    entity_type: str
    entity_id: str
    action: str
    before_data: dict[str, Any] | None = None
    after_data: dict[str, Any] | None = None
    changed_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogEntry]
    total: int
