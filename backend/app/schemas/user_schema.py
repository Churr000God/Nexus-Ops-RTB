from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class AssignRoleRequest(BaseModel):
    role_code: str


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
