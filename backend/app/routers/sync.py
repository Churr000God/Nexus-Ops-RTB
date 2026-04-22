from __future__ import annotations

import base64
import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user
from app.services.sync_service import SyncService, get_sync_service

router = APIRouter(prefix="/api/sync", tags=["sync"])
logger = logging.getLogger(__name__)


class UploadCsvPayload(BaseModel):
    dataset: str
    filename: str
    content: str  # base64-encoded CSV


def _verify_sync_key(x_sync_key: str = Header(default="", alias="x-sync-key")) -> None:
    if not settings.SYNC_API_KEY:
        return
    if x_sync_key != settings.SYNC_API_KEY:
        raise HTTPException(status_code=401, detail="Clave de sincronización inválida")


@router.post("/trigger")
async def trigger_sync(
    _current_user=Depends(get_current_user),
    service: SyncService = Depends(get_sync_service),
):
    """
    El frontend llama a este endpoint cuando el usuario presiona Actualizar datos.
    Este endpoint llama al webhook de n8n para iniciar la extracción de Notion.
    """
    current = service.get_status()
    if current["state"] in ("syncing", "importing"):
        raise HTTPException(status_code=409, detail="Sincronización ya en progreso")

    if not settings.N8N_WEBHOOK_URL:
        raise HTTPException(status_code=503, detail="N8N_WEBHOOK_URL no configurada")

    service.set_state("syncing")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                settings.N8N_WEBHOOK_URL,
                json={"source": "nexus-ops", "action": "sync"},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        service.set_state("error", error=str(exc))
        raise HTTPException(status_code=502, detail=f"Error al contactar n8n: {exc}") from exc

    return {"ok": True, "message": "Sincronización iniciada"}


@router.post("/upload-csv")
async def upload_csv(
    payload: UploadCsvPayload,
    _=Depends(_verify_sync_key),
    service: SyncService = Depends(get_sync_service),
):
    """
    n8n llama a este endpoint una vez por cada CSV generado.
    Recibe JSON con el CSV codificado en base64.
    Guarda el archivo en CSV_DIR reemplazando el anterior.
    Cuando llegan todos los datasets esperados, dispara la importación a BD automáticamente.
    """
    try:
        raw = base64.b64decode(payload.content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"content no es base64 válido: {exc}") from exc

    if raw:
        dest = service.csv_dir / payload.filename
        dest.write_bytes(raw)
        logger.info("CSV guardado: %s (%d bytes)", payload.filename, len(raw))

    service.record_csv_received(payload.dataset)
    auto_started = service.start_import_if_complete()

    return {
        "ok": True,
        "dataset": payload.dataset,
        "bytes": len(raw),
        "import_started": auto_started,
    }


@router.post("/finalize")
async def finalize_sync(
    _=Depends(_verify_sync_key),
    service: SyncService = Depends(get_sync_service),
):
    """
    Endpoint opcional: n8n puede llamar a este endpoint explícitamente después de
    subir todos los CSVs si se prefiere control manual sobre el auto-disparo.
    """
    current = service.get_status()
    if current["state"] == "importing":
        return {"ok": True, "message": "Importación ya en curso"}

    service.launch_import()
    return {"ok": True, "message": "Importación iniciada"}


@router.get("/status")
async def get_sync_status(
    _current_user=Depends(get_current_user),
    service: SyncService = Depends(get_sync_service),
):
    """El frontend consulta este endpoint para mostrar el progreso de la sincronización."""
    return service.get_status()
