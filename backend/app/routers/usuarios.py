from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permission
from app.models.user_model import User
from app.schemas.auth_schema import RegisterRequest, UserResponse
from app.schemas.user_schema import AssignRoleRequest, ChangePasswordRequest, UserUpdateSchema
from app.services.auth_service import AuthService, UserAlreadyExistsError
from app.services.user_service import (
    CannotChangeAdminPasswordError,
    RoleNotFoundError,
    UserNotFoundError,
    UserService,
)

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


def _user_response(user: User, roles: list[str], permissions: list[str] = []) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        roles=roles,
        permissions=permissions,
    )


@router.get("", response_model=list[UserResponse])
async def list_users(
    _: User = Depends(require_permission("user.view")),
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    service = UserService(db)
    users_with_roles = await service.list_users()
    return [_user_response(user, roles) for user, roles in users_with_roles]


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=1, description="Término de búsqueda"),
    limit: int = Query(10, ge=1, le=50),
    _: User = Depends(require_permission("user.view")),
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    """Buscar usuarios activos por nombre o email."""
    service = UserService(db)
    users = await service.search_users(q, limit)
    return [_user_response(user, await service.get_user_roles(user.id)) for user in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: RegisterRequest,
    _: User = Depends(require_permission("user.manage")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    auth_service = AuthService(db)
    try:
        user = await auth_service.register_user(payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return _user_response(user, roles=[])


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    payload: UserUpdateSchema,
    _: User = Depends(require_permission("user.manage")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = UserService(db)
    try:
        user = await service.update_user(user_id, payload)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    roles = await service.get_user_roles(user_id)
    return _user_response(user, roles)


@router.patch("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_user_password(
    user_id: UUID,
    payload: ChangePasswordRequest,
    current_user: User = Depends(require_permission("user.manage")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden cambiar contraseñas",
        )
    service = UserService(db)
    try:
        await service.change_password(user_id, payload.new_password)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CannotChangeAdminPasswordError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{user_id}/roles", response_model=UserResponse)
async def assign_role(
    user_id: UUID,
    payload: AssignRoleRequest,
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = UserService(db)
    try:
        await service.assign_role(user_id, payload.role_code)
        user = await service.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except RoleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    roles = await service.get_user_roles(user_id)
    return _user_response(user, roles)


@router.delete("/{user_id}/roles/{role_code}")
async def revoke_role(
    user_id: UUID,
    role_code: str,
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = UserService(db)
    try:
        await service.revoke_role(user_id, role_code)
    except RoleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
