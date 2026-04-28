import logging
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models.user_model import User
from app.services.auth_service import AuthService, InvalidCredentialsError

logger = logging.getLogger(__name__)


async def get_db() -> AsyncIterator[AsyncSession]:
    try:
        async with AsyncSessionLocal() as session:
            yield session
    except SQLAlchemyError as exc:
        logger.exception("Database connection error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servicio de base de datos no disponible",
        ) from exc


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token_payload = getattr(request.state, "token_payload", None)
    if token_payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )

    subject = token_payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido"
        )

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido"
        ) from exc

    service = AuthService(db)
    user = await service.get_user_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no valido"
        )
    return user


def require_roles(*roles: str):
    """Legacy: usa el campo role de users. Preferir require_permission para código nuevo."""
    async def validator(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        return user

    return validator


def require_permission(permission: str):
    """Verifica que el JWT del request incluya el permiso atómico indicado.

    Uso:
        current_user: User = Depends(require_permission("quote.create"))
    """
    async def dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
    ) -> User:
        token_payload: dict = request.state.token_payload or {}
        perms: list[str] = token_payload.get("permissions", [])
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {permission}",
            )
        return current_user

    return dependency


def decode_bearer_token_from_header(auth_header: str | None) -> dict | None:
    if not auth_header:
        return None
    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header[7:].strip()
    if not token:
        return None

    try:
        return AuthService.decode_access_token(token)
    except InvalidCredentialsError:
        return None
