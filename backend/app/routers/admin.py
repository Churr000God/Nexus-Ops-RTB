from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permission
from app.models.user_model import User
from app.schemas.user_schema import (
    AuditLogEntry,
    AuditLogPage,
    CreateRoleRequest,
    PermissionSchema,
    RoleWithPermissions,
    UpdateRolePermissionsRequest,
)
from app.services.admin_service import (
    AdminService,
    PermissionNotFoundError,
    RoleAlreadyExistsError,
    RoleNotFoundError,
    RoleProtectedError,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/roles", response_model=list[RoleWithPermissions])
async def list_roles(
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> list[RoleWithPermissions]:
    service = AdminService(db)
    roles = await service.list_roles_with_permissions()
    return [
        RoleWithPermissions(
            role_id=r.role_id,
            code=r.code,
            name=r.name,
            description=r.description,
            permissions=[
                PermissionSchema.model_validate(rp.permission)
                for rp in r.role_permissions
            ],
        )
        for r in roles
    ]


@router.post("/roles", response_model=RoleWithPermissions, status_code=201)
async def create_role(
    payload: CreateRoleRequest,
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> RoleWithPermissions:
    service = AdminService(db)
    try:
        role = await service.create_role(payload)
    except RoleAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PermissionNotFoundError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return RoleWithPermissions(
        role_id=role.role_id,
        code=role.code,
        name=role.name,
        description=role.description,
        permissions=[],
    )


@router.put("/roles/{role_id}/permissions", response_model=RoleWithPermissions)
async def update_role_permissions(
    role_id: int,
    payload: UpdateRolePermissionsRequest,
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> RoleWithPermissions:
    service = AdminService(db)
    try:
        role = await service.update_role_permissions(role_id, payload.permission_codes)
    except RoleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RoleProtectedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except PermissionNotFoundError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return RoleWithPermissions(
        role_id=role.role_id,
        code=role.code,
        name=role.name,
        description=role.description,
        permissions=[
            PermissionSchema.model_validate(rp.permission)
            for rp in role.role_permissions
        ],
    )


@router.get("/permissions", response_model=list[PermissionSchema])
async def list_permissions(
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> list[PermissionSchema]:
    service = AdminService(db)
    perms = await service.list_permissions()
    return [PermissionSchema.model_validate(p) for p in perms]


@router.get("/audit-log", response_model=AuditLogPage)
async def list_audit_log(
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    user_id: UUID | None = Query(default=None),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    _: User = Depends(require_permission("audit.view")),
    db: AsyncSession = Depends(get_db),
) -> AuditLogPage:
    service = AdminService(db)
    items, total = await service.list_audit_log(
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        offset=offset,
        limit=limit,
    )
    return AuditLogPage(
        items=[AuditLogEntry.model_validate(entry) for entry in items],
        total=total,
    )
