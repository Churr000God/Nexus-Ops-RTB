from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

EXPECTED_DATASETS: frozenset[str] = frozenset(
    [
        "cotizaciones_a_clientes",
        "detalle_cotizaciones",
        "reporte_ventas",
        "cotizaciones_canceladas",
        "directorio_clientes_proveedores",
        "crecimiento_inventario",
        "gestion_inventario",
        "no_conformes",
        "bitacora_movimientos",
        "solicitudes_material",
        "entradas_mercancia",
        "pedidos_incompletos",
        "pedidos_clientes",
        "proveedores_productos",
        "solicitudes_proveedores",
        "gastos_operativos",
        "facturas_compras",
        "verificador_fechas_pedidos",
        "catalogo_productos",
    ]
)

_state: dict = {
    "state": "idle",
    "started_at": None,
    "finished_at": None,
    "error": None,
    "csvs_received": [],
}
_import_task: asyncio.Task | None = None


class SyncService:
    @property
    def csv_dir(self) -> Path:
        from app.config import settings

        return Path(settings.CSV_DIR)

    def get_status(self) -> dict:
        return {
            "state": _state["state"],
            "started_at": _state["started_at"],
            "finished_at": _state["finished_at"],
            "error": _state["error"],
            "csvs_received": list(_state["csvs_received"]),
            "total_expected": len(EXPECTED_DATASETS),
        }

    def set_state(self, state: str, error: str | None = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        _state["state"] = state

        if state == "syncing":
            _state["started_at"] = now
            _state["finished_at"] = None
            _state["error"] = None
            _state["csvs_received"] = []
        elif state in ("done", "error"):
            _state["finished_at"] = now
            _state["error"] = error

    def record_csv_received(self, dataset: str) -> None:
        received: list[str] = _state["csvs_received"]
        if dataset not in received:
            received.append(dataset)

    def all_csvs_received(self) -> bool:
        received = set(_state["csvs_received"])
        return EXPECTED_DATASETS.issubset(received)

    def start_import_if_complete(self, is_final: bool = False) -> bool:
        if _state["state"] != "syncing":
            return False
        # Dispara si n8n marcó este como el último CSV, o si llegaron todos los esperados
        if not is_final and not self.all_csvs_received():
            return False
        self._launch_import_task()
        return True

    def launch_import(self) -> None:
        self._launch_import_task()

    def _launch_import_task(self) -> None:
        global _import_task
        self.set_state("importing")
        _import_task = asyncio.create_task(_run_db_sync(self))


async def _run_db_sync(service: SyncService) -> None:
    script = Path("/app/scripts/sync_csv_data.py")
    if not script.exists():
        script = Path(__file__).resolve().parents[3] / "scripts" / "sync_csv_data.py"

    # Determina el directorio raíz donde `app` es importable (/app en Docker)
    app_root = script.parent.parent  # /app/scripts/../ = /app

    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        f"{app_root}{os.pathsep}{existing_pythonpath}" if existing_pythonpath else str(app_root)
    )

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            str(script),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )
        stdout, _ = await proc.communicate()
        output = stdout.decode() if stdout else ""

        if proc.returncode != 0:
            logger.error("sync_csv_data.py falló (código %d):\n%s", proc.returncode, output)
            service.set_state("error", error=f"Importación falló (código {proc.returncode})")
        else:
            logger.info("sync_csv_data.py OK. Datasets: %d filas procesadas", len(output.splitlines()))
            service.set_state("done")
    except Exception as exc:
        logger.exception("Error inesperado en importación de BD")
        service.set_state("error", error=str(exc))


_service = SyncService()


def get_sync_service() -> SyncService:
    return _service
