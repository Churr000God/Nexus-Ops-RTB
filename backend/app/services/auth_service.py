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
from app.models.user_model import RefreshToken, User
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


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register_user(self, payload: RegisterRequest) -> User:
        existing = await self.db.scalar(select(User).where(User.email == payload.email))
        if existing is not None:
            raise UserAlreadyExistsError("El usuario ya existe")

        user = User(
            email=payload.email,
            hashed_password=self.hash_password(payload.password),
            role=payload.role,
            is_active=True,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate_user(self, email: str, password: str) -> User:
        user = await self.db.scalar(select(User).where(User.email == email))
        if user is None or not self.verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Credenciales invalidas")
        if not user.is_active:
            raise InvalidCredentialsError("Usuario inactivo")
        return user

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        return await self.db.get(User, user_id)

    def create_access_token(self, user: User) -> str:
        if settings.JWT_SECRET is None:
            raise RuntimeError("JWT_SECRET no esta configurado")

        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
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

    async def issue_refresh_token(self, user_id: UUID) -> str:
        raw_token = secrets.token_urlsafe(48)
        token_hash = self.hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

        await self.db.execute(
            delete(RefreshToken).where(RefreshToken.user_id == user_id)
        )
        self.db.add(
            RefreshToken(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
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
        token_record.token_hash = self.hash_token(new_token)
        token_record.expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.db.commit()
        return user, new_token

    async def revoke_refresh_token(self, raw_refresh_token: str) -> None:
        token_hash = self.hash_token(raw_refresh_token)
        await self.db.execute(
            delete(RefreshToken).where(RefreshToken.token_hash == token_hash)
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
