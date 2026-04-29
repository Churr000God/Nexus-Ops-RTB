from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # Legacy single-role field; se mantiene durante la transición al RBAC completo
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="operativo")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    totp_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    totp_setup_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_roles: Mapped[list[UserRole]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    totp_backup_codes: Mapped[list[TotpBackupCode]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(
        SmallInteger, Identity(always=True), primary_key=True
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_roles: Mapped[list[UserRole]] = relationship(back_populates="role")
    role_permissions: Mapped[list[RolePermission]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    __tablename__ = "permissions"

    permission_id: Mapped[int] = mapped_column(
        SmallInteger, Identity(always=True), primary_key=True
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    role_permissions: Mapped[list[RolePermission]] = relationship(
        back_populates="permission", cascade="all, delete-orphan"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("roles.role_id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("permissions.permission_id", ondelete="CASCADE"),
        primary_key=True,
    )

    role: Mapped[Role] = relationship(back_populates="role_permissions")
    permission: Mapped[Permission] = relationship(back_populates="role_permissions")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("roles.role_id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="user_roles")
    role: Mapped[Role] = relationship(back_populates="user_roles")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TotpBackupCode(Base):
    __tablename__ = "totp_backup_codes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="totp_backup_codes")


class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    before_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
