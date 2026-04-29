"""Endpoints de administración de catálogos SAT CFDI 4.0.

POST /api/admin/sat/sync  — sincroniza uno o todos los catálogos desde la fuente oficial
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permission
from app.models.user_model import User
from app.services import sat_sync_service

router = APIRouter(prefix="/api/admin/sat", tags=["sat-admin"])

AdminDep = Annotated[User, Depends(require_permission("cfdi.config.manage"))]
DbDep = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ───────────────────────────────────────────────────────────────────


class SatSyncRequest(BaseModel):
    include_product_keys: bool = True
    include_unit_keys: bool = True
    sat_url: str = sat_sync_service.SAT_CATALOG_URL_DEFAULT


class CatalogResultOut(BaseModel):
    catalog: str
    rows_processed: int
    rows_upserted: int
    error: str | None


class SatSyncResponse(BaseModel):
    success: bool
    results: list[CatalogResultOut]


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/sync", response_model=SatSyncResponse)
async def sync_sat_catalogs(
    body: SatSyncRequest,
    db: DbDep,
    _: AdminDep,
) -> SatSyncResponse:
    """Sincroniza catálogos SAT CFDI 4.0 desde la fuente oficial.

    Catálogos estáticos (formas/métodos pago, regímenes, usos CFDI) se actualizan
    desde datos canónicos hardcodeados.  Claves producto/unidad se descargan del SAT.
    """
    report = await sat_sync_service.run_full_sync(
        db=db,
        include_product_keys=body.include_product_keys,
        include_unit_keys=body.include_unit_keys,
        sat_url=body.sat_url,
    )

    return SatSyncResponse(
        success=report.success,
        results=[
            CatalogResultOut(
                catalog=r.catalog,
                rows_processed=r.rows_processed,
                rows_upserted=r.rows_upserted,
                error=r.error,
            )
            for r in report.results
        ],
    )
