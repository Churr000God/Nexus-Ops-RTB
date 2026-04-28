from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_model import Role, User, UserRole
from app.schemas.user_schema import UserUpdateSchema


class UserNotFoundError(Exception):
    pass


class RoleNotFoundError(Exception):
    pass


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_users(self) -> list[tuple[User, list[str]]]:
        """Devuelve todos los usuarios con sus roles en 2 queries (evita N+1)."""
        users = list(
            await self.db.scalars(select(User).order_by(User.created_at.desc()))
        )
        if not users:
            return []

        user_ids = [u.id for u in users]
        rows = (
            await self.db.execute(
                select(UserRole.user_id, Role.code)
                .join(Role, Role.role_id == UserRole.role_id)
                .where(UserRole.user_id.in_(user_ids))
                .order_by(Role.code)
            )
        ).all()

        roles_by_user: dict[UUID, list[str]] = {}
        for user_id, role_code in rows:
            roles_by_user.setdefault(user_id, []).append(role_code)

        return [(user, roles_by_user.get(user.id, [])) for user in users]

    async def get_user(self, user_id: UUID) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError(f"Usuario {user_id} no encontrado")
        return user

    async def get_user_roles(self, user_id: UUID) -> list[str]:
        result = await self.db.scalars(
            select(Role.code)
            .join(UserRole, UserRole.role_id == Role.role_id)
            .where(UserRole.user_id == user_id)
            .order_by(Role.code)
        )
        return list(result.all())

    async def update_user(self, user_id: UUID, payload: UserUpdateSchema) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError(f"Usuario {user_id} no encontrado")

        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.is_active is not None:
            user.is_active = payload.is_active

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def assign_role(self, user_id: UUID, role_code: str) -> None:
        """Idempotente: no falla si el usuario ya tiene el rol."""
        user = await self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError(f"Usuario {user_id} no encontrado")

        role = await self.db.scalar(select(Role).where(Role.code == role_code))
        if role is None:
            raise RoleNotFoundError(f"Rol '{role_code}' no existe")

        already = await self.db.scalar(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role.role_id,
            )
        )
        if already is not None:
            return

        self.db.add(UserRole(user_id=user_id, role_id=role.role_id))
        await self.db.commit()

    async def revoke_role(self, user_id: UUID, role_code: str) -> None:
        """Idempotente: no falla si el usuario no tenía el rol."""
        role = await self.db.scalar(select(Role).where(Role.code == role_code))
        if role is None:
            raise RoleNotFoundError(f"Rol '{role_code}' no existe")

        await self.db.execute(
            delete(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role.role_id,
            )
        )
        await self.db.commit()
