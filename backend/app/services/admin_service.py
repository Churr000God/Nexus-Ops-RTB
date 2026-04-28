from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user_model import AuditLog, Permission, Role, RolePermission


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_roles_with_permissions(self) -> list[Role]:
        result = await self.db.scalars(
            select(Role)
            .options(
                selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
            .order_by(Role.code)
        )
        return list(result.all())

    async def list_permissions(self) -> list[Permission]:
        result = await self.db.scalars(select(Permission).order_by(Permission.code))
        return list(result.all())

    async def list_audit_log(
        self,
        *,
        entity_type: str | None,
        entity_id: str | None,
        user_id: UUID | None,
        from_date: datetime | None,
        to_date: datetime | None,
        offset: int,
        limit: int,
    ) -> tuple[list[AuditLog], int]:
        base_q = select(AuditLog)
        if entity_type:
            base_q = base_q.where(AuditLog.entity_type == entity_type)
        if entity_id:
            base_q = base_q.where(AuditLog.entity_id == entity_id)
        if user_id:
            base_q = base_q.where(AuditLog.user_id == user_id)
        if from_date:
            base_q = base_q.where(AuditLog.changed_at >= from_date)
        if to_date:
            base_q = base_q.where(AuditLog.changed_at <= to_date)

        total = await self.db.scalar(
            select(func.count()).select_from(base_q.subquery())
        )
        items = list(
            await self.db.scalars(
                base_q.order_by(AuditLog.changed_at.desc()).offset(offset).limit(limit)
            )
        )
        return items, total or 0
