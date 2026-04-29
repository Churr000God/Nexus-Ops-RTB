"""Router — Módulo CFDI 4.0.

Prefijo: /api/cfdi
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_permission
from app.models.user_model import User
from app.schemas.cfdi_schemas import (
    CfdiCancelIn,
    CfdiCancelResponse,
    CfdiCreateIn,
    CfdiCreditNoteIn,
    CfdiIssuerConfigIn,
    CfdiIssuerConfigOut,
    CfdiListItem,
    CfdiOut,
    CfdiPacLogOut,
    CfdiPaymentComplementIn,
    CfdiPaymentComplementOut,
    CfdiPpdPending,
    CfdiSeriesOut,
    CfdiStampResponse,
)
from app.services import cfdi_service

router = APIRouter(prefix="/api/cfdi", tags=["cfdi"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Issuer Config
# ---------------------------------------------------------------------------


@router.get("/issuer-config", response_model=CfdiIssuerConfigOut | None)
async def get_issuer_config(
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("cfdi.view")),
):
    return await cfdi_service.get_active_issuer_config(db)


@router.post(
    "/issuer-config",
    response_model=CfdiIssuerConfigOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_issuer_config(
    data: CfdiIssuerConfigIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("cfdi.config.manage")),
):
    return await cfdi_service.save_issuer_config(db, data, user.id)


# ---------------------------------------------------------------------------
# Series
# ---------------------------------------------------------------------------


@router.get("/series", response_model=list[CfdiSeriesOut])
async def list_series(
    db: DbDep,
    _: UserDep,
    active_only: bool = Query(default=True),
    _perm=Depends(require_permission("cfdi.view")),
):
    return await cfdi_service.list_series(db, active_only=active_only)


# ---------------------------------------------------------------------------
# CFDIs
# ---------------------------------------------------------------------------


@router.get("", response_model=list[CfdiListItem])
async def list_cfdis(
    db: DbDep,
    _: UserDep,
    cfdi_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _perm=Depends(require_permission("cfdi.view")),
):
    return await cfdi_service.list_cfdis(
        db, cfdi_type=cfdi_type, status=status,
        customer_id=customer_id, limit=limit, offset=offset,
    )


@router.post("", response_model=CfdiOut, status_code=status.HTTP_201_CREATED)
async def create_cfdi(
    data: CfdiCreateIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("cfdi.issue")),
):
    try:
        return await cfdi_service.create_cfdi_draft(db, data, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Rutas estáticas ANTES de /{cfdi_id} para evitar colisión de rutas
@router.get("/ppd-pending", response_model=list[CfdiPpdPending])
async def list_ppd_pending(
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("cfdi.view")),
):
    return await cfdi_service.list_ppd_pending(db)


@router.post(
    "/credit-notes",
    response_model=CfdiOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_credit_note(
    data: CfdiCreditNoteIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("cfdi.issue")),
):
    try:
        return await cfdi_service.create_credit_note(db, data, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/payment-complements",
    response_model=CfdiPaymentComplementOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_complement(
    data: CfdiPaymentComplementIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("cfdi.issue")),
):
    try:
        return await cfdi_service.create_payment_complement(db, data, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{cfdi_id}", response_model=CfdiOut)
async def get_cfdi(
    cfdi_id: int,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("cfdi.view")),
):
    try:
        return await cfdi_service.get_cfdi(db, cfdi_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---------------------------------------------------------------------------
# Timbrar
# ---------------------------------------------------------------------------


@router.post("/{cfdi_id}/stamp", response_model=CfdiStampResponse)
async def stamp_cfdi(
    cfdi_id: int,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("cfdi.issue")),
):
    try:
        cfdi = await cfdi_service.stamp_cfdi(db, cfdi_id, user.id)
        return CfdiStampResponse(
            cfdi_id=cfdi.cfdi_id,
            uuid=cfdi.uuid or "",
            status=cfdi.status,
            timbre_date=cfdi.timbre_date,
            certificate_number=cfdi.certificate_number or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---------------------------------------------------------------------------
# Cancelar
# ---------------------------------------------------------------------------


@router.post("/{cfdi_id}/cancel", response_model=CfdiCancelResponse)
async def cancel_cfdi(
    cfdi_id: int,
    data: CfdiCancelIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("cfdi.cancel")),
):
    try:
        cfdi = await cfdi_service.cancel_cfdi(db, cfdi_id, data, user.id)
        return CfdiCancelResponse(
            cfdi_id=cfdi.cfdi_id,
            status=cfdi.status,
            sat_status="CANCELADO",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---------------------------------------------------------------------------
# PAC Log
# ---------------------------------------------------------------------------


@router.get("/{cfdi_id}/pac-log", response_model=list[CfdiPacLogOut])
async def get_pac_log(
    cfdi_id: int,
    db: DbDep,
    _: UserDep,
    limit: int = Query(default=50, ge=1, le=200),
    _perm=Depends(require_permission("cfdi.view")),
):
    return await cfdi_service.list_pac_log(db, cfdi_id, limit=limit)
