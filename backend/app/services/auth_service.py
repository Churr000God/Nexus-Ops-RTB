from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user_model import (
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.schemas.auth_schema import RegisterRequest

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


class AuthError(Exception):
    pass


class InvalidCredentialsError(AuthError):
    pass


class RefreshTokenError(AuthError):
    pass


class UserAlreadyExistsError(AuthError):
    pass


class WrongCurrentPasswordError(AuthError):
    pass


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register_user(self, payload: RegisterRequest) -> User:
        existing = await self.db.scalar(select(User).where(User.email == payload.email))
        if existing is not None:
            raise UserAlreadyExistsError("El usuario ya existe")

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=self.hash_password(payload.password),
            role=payload.role,
            is_active=True,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate_user(self, email: str, password: str) -> tuple[User, list[str]]:
        user = await self.db.scalar(select(User).where(User.email == email))
        if user is None or not self.verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Credenciales invalidas")
        if not user.is_active:
            raise InvalidCredentialsError("Usuario inactivo")

        user.last_login_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)

        permissions = await self.get_user_permissions(user.id)
        return user, permissions

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        return await self.db.get(User, user_id)

    async def get_user_permissions(self, user_id: UUID) -> list[str]:
        """4 JOINs: users → user_roles → roles → role_permissions → permissions."""
        result = await self.db.scalars(
            select(Permission.code)
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.role_id == UserRole.role_id)
            .join(RolePermission, RolePermission.role_id == Role.role_id)
            .join(Permission, Permission.permission_id == RolePermission.permission_id)
            .where(User.id == user_id)
            .distinct()
            .order_by(Permission.code)
        )
        return list(result.all())

    async def get_user_roles(self, user_id: UUID) -> list[str]:
        result = await self.db.scalars(
            select(Role.code)
            .join(UserRole, UserRole.role_id == Role.role_id)
            .where(UserRole.user_id == user_id)
            .order_by(Role.code)
        )
        return list(result.all())

    def create_access_token(self, user: User, permissions: list[str]) -> str:
        if settings.JWT_SECRET is None:
            raise RuntimeError("JWT_SECRET no esta configurado")

        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "permissions": permissions,
            "iat": int(now.timestamp()),
            "exp": int(
                (
                    now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
                ).timestamp()
            ),
        }
        return jwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )

    async def issue_refresh_token(
        self,
        user_id: UUID,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> str:
        raw_token = secrets.token_urlsafe(48)
        token_hash = self.hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        # Limpiar tokens expirados
        await self.db.execute(
            delete(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at <= now,
            )
        )

        # Máximo 5 sesiones activas: eliminar la más antigua si se supera
        active = list(
            await self.db.scalars(
                select(RefreshToken)
                .where(RefreshToken.user_id == user_id)
                .order_by(RefreshToken.created_at.asc())
            )
        )
        if len(active) >= 5:
            await self.db.delete(active[0])

        self.db.add(
            RefreshToken(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
                user_agent=user_agent,
                ip_address=ip_address,
            )
        )
        await self.db.commit()
        return raw_token

    async def rotate_refresh_token(self, raw_refresh_token: str) -> tuple[User, str]:
        token_hash = self.hash_token(raw_refresh_token)
        token_record = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        if token_record is None:
            raise RefreshTokenError("Refresh token invalido")

        if token_record.expires_at <= datetime.now(timezone.utc):
            await self.db.execute(
                delete(RefreshToken).where(RefreshToken.id == token_record.id)
            )
            await self.db.commit()
            raise RefreshTokenError("Refresh token expirado")

        user = await self.db.get(User, token_record.user_id)
        if user is None or not user.is_active:
            raise RefreshTokenError("Usuario invalido")

        new_token = secrets.token_urlsafe(48)
        now = datetime.now(timezone.utc)
        token_record.token_hash = self.hash_token(new_token)
        token_record.expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        token_record.last_used_at = now
        await self.db.commit()
        return user, new_token

    async def revoke_refresh_token(self, raw_refresh_token: str) -> None:
        token_hash = self.hash_token(raw_refresh_token)
        await self.db.execute(
            delete(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        await self.db.commit()

    async def change_own_password(
        self, user_id: UUID, current_password: str, new_password: str
    ) -> None:
        user = await self.db.get(User, user_id)
        if user is None or not self.verify_password(current_password, user.hashed_password):
            raise WrongCurrentPasswordError("Contraseña actual incorrecta")
        user.hashed_password = self.hash_password(new_password)
        await self.db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
        await self.db.commit()

    async def list_sessions(self, user_id: UUID) -> list[RefreshToken]:
        result = await self.db.scalars(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .order_by(RefreshToken.created_at.desc())
        )
        return list(result.all())

    async def revoke_session(self, session_id: UUID, user_id: UUID) -> None:
        token = await self.db.get(RefreshToken, session_id)
        if token is None or token.user_id != user_id:
            return
        await self.db.delete(token)
        await self.db.commit()

    async def revoke_all_except(
        self, user_id: UUID, current_token_hash: str | None
    ) -> None:
        if current_token_hash:
            await self.db.execute(
                delete(RefreshToken).where(
                    RefreshToken.user_id == user_id,
                    RefreshToken.token_hash != current_token_hash,
                )
            )
        else:
            await self.db.execute(
                delete(RefreshToken).where(RefreshToken.user_id == user_id)
            )
        await self.db.commit()

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        return pwd_context.verify(password, hashed_password)

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def decode_access_token(token: str) -> dict:
        if settings.JWT_SECRET is None:
            raise RuntimeError("JWT_SECRET no esta configurado")
        try:
            return jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except JWTError as exc:
            raise InvalidCredentialsError("Token invalido") from exc
