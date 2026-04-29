from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.auth_schema import (
    ChangeOwnPasswordRequest,
    LoginRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
    SessionInfo,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from app.services.auth_service import (
    AuthService,
    InvalidCredentialsError,
    RefreshTokenError,
    UserAlreadyExistsError,
    WrongCurrentPasswordError,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_REFRESH_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.COOKIE_REFRESH_NAME,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/api/auth",
    )


@router.post(
    "/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    service = AuthService(db)
    try:
        user = await service.register_user(payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc

    return RegisterResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    service = AuthService(db)
    try:
        user, permissions = await service.authenticate_user(payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    try:
        access_token = service.create_access_token(user, permissions)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc

    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    refresh_token = await service.issue_refresh_token(
        user.id, user_agent=user_agent, ip_address=ip_address
    )
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> RefreshResponse:
    raw_refresh_token = request.cookies.get(settings.COOKIE_REFRESH_NAME)
    if raw_refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token ausente"
        )

    service = AuthService(db)
    try:
        user, rotated_token = await service.rotate_refresh_token(raw_refresh_token)
    except RefreshTokenError as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    permissions = await service.get_user_permissions(user.id)
    try:
        access_token = service.create_access_token(user, permissions)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
    _set_refresh_cookie(response, rotated_token)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    raw_refresh_token = request.cookies.get(settings.COOKIE_REFRESH_NAME)
    if raw_refresh_token:
        service = AuthService(db)
        await service.revoke_refresh_token(raw_refresh_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = AuthService(db)
    roles = await service.get_user_roles(current_user.id)
    permissions = await service.get_user_permissions(current_user.id)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        roles=roles,
        permissions=permissions,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    current_user.full_name = payload.full_name
    await db.commit()
    await db.refresh(current_user)
    service = AuthService(db)
    roles = await service.get_user_roles(current_user.id)
    permissions = await service.get_user_permissions(current_user.id)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        roles=roles,
        permissions=permissions,
    )


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_own_password(
    payload: ChangeOwnPasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = AuthService(db)
    try:
        await service.change_own_password(
            current_user.id, payload.current_password, payload.new_password
        )
    except WrongCurrentPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    _clear_refresh_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/sessions", response_model=list[SessionInfo])
async def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionInfo]:
    raw_refresh_token = request.cookies.get(settings.COOKIE_REFRESH_NAME)
    current_hash = AuthService.hash_token(raw_refresh_token) if raw_refresh_token else None
    service = AuthService(db)
    tokens = await service.list_sessions(current_user.id)
    return [
        SessionInfo(
            id=t.id,
            user_agent=t.user_agent,
            ip_address=t.ip_address,
            created_at=t.created_at,
            last_used_at=t.last_used_at,
            is_current=(current_hash is not None and t.token_hash == current_hash),
        )
        for t in tokens
    ]


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = AuthService(db)
    await service.revoke_session(session_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/sessions", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_all_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    raw_refresh_token = request.cookies.get(settings.COOKIE_REFRESH_NAME)
    current_hash = AuthService.hash_token(raw_refresh_token) if raw_refresh_token else None
    service = AuthService(db)
    await service.revoke_all_except(current_user.id, current_hash)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
