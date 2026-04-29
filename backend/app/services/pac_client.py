"""Cliente PAC para timbrado y cancelación de CFDI 4.0.

Interfaz abstracta + StubPacClient para desarrollo/sandbox.
Para producción, implementar DiverзaPacClient (u otro PAC) siguiendo
la misma interfaz y registrarlo en get_pac_client().
"""

from __future__ import annotations

import uuid as _uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Resultado de operaciones PAC
# ---------------------------------------------------------------------------


@dataclass
class StampResult:
    success: bool
    uuid: str | None = None
    sello_cfdi: str | None = None
    sello_sat: str | None = None
    certificate_number: str | None = None
    timbre_date: datetime | None = None
    xml_timbrado: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    raw_response: dict | None = None


@dataclass
class CancelResult:
    success: bool
    status: str | None = None          # "CANCELADO", "EN_PROCESO", "RECHAZADO"
    error_code: str | None = None
    error_message: str | None = None
    raw_response: dict | None = None


# ---------------------------------------------------------------------------
# Interfaz base
# ---------------------------------------------------------------------------


class PacClientBase(ABC):
    """Contrato mínimo que todo cliente PAC debe implementar."""

    @abstractmethod
    async def stamp(self, cfdi_xml: str, cfdi_id: int) -> StampResult: ...

    @abstractmethod
    async def cancel(
        self,
        uuid: str,
        issuer_rfc: str,
        receiver_rfc: str,
        total: str,
        reason: str,
        substitute_uuid: str | None = None,
    ) -> CancelResult: ...


# ---------------------------------------------------------------------------
# StubPacClient — simulación local para desarrollo
# ---------------------------------------------------------------------------


class StubPacClient(PacClientBase):
    """PAC simulado. Genera UUID fake y siempre retorna éxito.

    Usar cuando pac_environment='SANDBOX' o pac_provider='STUB'.
    Cambiar a un cliente real (DiverзaPacClient, FacturamaPacClient…)
    cuando las credenciales CSD y PAC estén configuradas.
    """

    async def stamp(self, cfdi_xml: str, cfdi_id: int) -> StampResult:
        fake_uuid = str(_uuid.uuid4()).upper()
        now = datetime.now(timezone.utc)
        return StampResult(
            success=True,
            uuid=fake_uuid,
            sello_cfdi=f"STUB_SELLO_CFDI_{cfdi_id}",
            sello_sat=f"STUB_SELLO_SAT_{cfdi_id}",
            certificate_number="00001000000504465028",
            timbre_date=now,
            xml_timbrado=cfdi_xml,
            raw_response={"stub": True, "cfdi_id": cfdi_id, "uuid": fake_uuid},
        )

    async def cancel(
        self,
        uuid: str,
        issuer_rfc: str,
        receiver_rfc: str,
        total: str,
        reason: str,
        substitute_uuid: str | None = None,
    ) -> CancelResult:
        return CancelResult(
            success=True,
            status="CANCELADO",
            raw_response={"stub": True, "uuid": uuid, "reason": reason},
        )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def get_pac_client(pac_provider: str | None, pac_environment: str = "SANDBOX") -> PacClientBase:
    """Devuelve el cliente PAC apropiado según la configuración.

    En producción, registrar aquí los clientes reales.
    """
    if pac_provider in (None, "STUB") or pac_environment == "SANDBOX":
        return StubPacClient()
    # Placeholder para PAC reales — implementar cuando haya credenciales
    raise NotImplementedError(
        f"PAC provider '{pac_provider}' no está implementado. "
        "Usa pac_provider='STUB' para desarrollo."
    )
