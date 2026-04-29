"""Sincronización de catálogos SAT CFDI 4.0.

Estrategia por catálogo:
  - Estáticos pequeños (formas/métodos pago, regímenes, usos CFDI):
    datos canónicos hardcodeados — siempre correctos, sin dependencia externa.
  - Grandes (claves producto/servicio, claves unidad):
    descarga desde URL (SAT oficial o configurable) y parseo Excel .xls/.xlsx.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Iterator
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Datos canónicos CFDI 4.0
# ---------------------------------------------------------------------------

_PAYMENT_FORMS: list[tuple[str, str]] = [
    ("01", "Efectivo"),
    ("02", "Cheque nominativo"),
    ("03", "Transferencia electrónica de fondos"),
    ("04", "Tarjeta de crédito"),
    ("05", "Monedero electrónico"),
    ("06", "Dinero electrónico"),
    ("08", "Vales de despensa"),
    ("12", "Dación en pago"),
    ("13", "Pago por subrogación"),
    ("14", "Pago por consignación"),
    ("15", "Condonación"),
    ("17", "Compensación"),
    ("23", "Novación"),
    ("24", "Confusión"),
    ("25", "Remisión de deuda"),
    ("26", "Prescripción o caducidad"),
    ("27", "A satisfacción del acreedor"),
    ("28", "Tarjeta de débito"),
    ("29", "Tarjeta de servicios"),
    ("30", "Aplicación de anticipos"),
    ("31", "Intermediario pagos"),
    ("99", "Por definir"),
]

_PAYMENT_METHODS: list[tuple[str, str]] = [
    ("PUE", "Pago en una sola exhibición"),
    ("PPD", "Pago en parcialidades o diferido"),
]

_TAX_REGIMES: list[tuple[str, str, str]] = [
    ("601", "General de Ley Personas Morales", "MORAL"),
    ("603", "Personas Morales con Fines no Lucrativos", "MORAL"),
    ("605", "Sueldos y Salarios e Ingresos Asimilados a Salarios", "FISICA"),
    ("606", "Arrendamiento", "FISICA"),
    ("607", "Régimen de Enajenación o Adquisición de Bienes", "FISICA"),
    ("608", "Demás ingresos", "FISICA"),
    ("610", "Residentes en el Extranjero sin Establecimiento Permanente", "BOTH"),
    ("611", "Ingresos por Dividendos (socios y accionistas)", "FISICA"),
    ("612", "Personas Físicas con Actividades Empresariales y Profesionales", "FISICA"),
    ("614", "Ingresos por intereses", "FISICA"),
    ("615", "Régimen de los ingresos por obtención de premios", "FISICA"),
    ("616", "Sin obligaciones fiscales", "FISICA"),
    ("620", "Sociedades Cooperativas de Producción", "MORAL"),
    ("621", "Incorporación Fiscal", "FISICA"),
    ("622", "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras", "BOTH"),
    ("623", "Opcional para Grupos de Sociedades", "MORAL"),
    ("624", "Coordinados", "MORAL"),
    ("625", "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas", "FISICA"),
    ("626", "Régimen Simplificado de Confianza (RESICO)", "BOTH"),
]

_CFDI_USES: list[tuple[str, str, str]] = [
    ("G01", "Adquisición de mercancias", "BOTH"),
    ("G02", "Devoluciones, descuentos o bonificaciones", "BOTH"),
    ("G03", "Gastos en general", "BOTH"),
    ("I01", "Construcciones", "BOTH"),
    ("I02", "Mobilario y equipo de oficina por inversiones", "BOTH"),
    ("I03", "Equipo de transporte", "BOTH"),
    ("I04", "Equipo de computo y accesorios", "BOTH"),
    ("I05", "Dados, troqueles, moldes, matrices y herramental", "BOTH"),
    ("I06", "Comunicaciones telefónicas", "BOTH"),
    ("I07", "Comunicaciones satelitales", "BOTH"),
    ("I08", "Otra maquinaria y equipo", "BOTH"),
    ("D01", "Honorarios médicos, dentales y gastos hospitalarios", "FISICA"),
    ("D02", "Gastos médicos por incapacidad o discapacidad", "FISICA"),
    ("D03", "Gastos funerales", "FISICA"),
    ("D04", "Donativos", "FISICA"),
    ("D05", "Intereses reales por créditos hipotecarios (casa habitación)", "FISICA"),
    ("D06", "Aportaciones voluntarias al SAR", "FISICA"),
    ("D07", "Primas por seguros de gastos médicos", "FISICA"),
    ("D08", "Gastos de transportación escolar obligatoria", "FISICA"),
    ("D09", "Depósitos en cuentas para el ahorro / planes de pensiones", "FISICA"),
    ("D10", "Pagos por servicios educativos (colegiaturas)", "FISICA"),
    ("S01", "Sin efectos fiscales", "BOTH"),
    ("CP01", "Pagos", "BOTH"),
    ("CN01", "Nómina", "BOTH"),
]

# URL oficial del SAT para catálogos CFDI 4.0 (XLS)
SAT_CATALOG_URL_DEFAULT = (
    "http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI.xls"
)

# ---------------------------------------------------------------------------
# Tipos de resultado
# ---------------------------------------------------------------------------


@dataclass
class CatalogSyncResult:
    catalog: str
    rows_processed: int = 0
    rows_upserted: int = 0
    error: str | None = None


@dataclass
class SyncReport:
    results: list[CatalogSyncResult] = field(default_factory=list)

    @property
    def success(self) -> bool:
        return all(r.error is None for r in self.results)


# ---------------------------------------------------------------------------
# Helpers para parseo de Excel
# ---------------------------------------------------------------------------


def _open_workbook(data: bytes, filename: str) -> object:
    """Abre un workbook desde bytes. Detecta formato por extensión."""
    if filename.lower().endswith(".xlsx"):
        import openpyxl  # type: ignore[import-untyped]
        return openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    else:
        import xlrd  # type: ignore[import-untyped]
        return xlrd.open_workbook(file_contents=data)


def _iter_sheet_rows(wb: object, sheet_name: str) -> Iterator[list[str]]:
    """Itera las filas de una hoja como listas de strings. Omite la primera fila (encabezado)."""
    try:
        import openpyxl  # type: ignore[import-untyped]
        is_openpyxl = isinstance(wb, openpyxl.Workbook)
    except ImportError:
        is_openpyxl = False

    if is_openpyxl:
        ws = wb[sheet_name]
        rows = iter(ws.iter_rows(values_only=True))
        next(rows, None)  # skip header
        for row in rows:
            yield [str(c).strip() if c is not None else "" for c in row]
    else:
        import xlrd  # type: ignore[import-untyped]
        try:
            ws = wb.sheet_by_name(sheet_name)
        except xlrd.XLRDError:
            return
        for row_idx in range(1, ws.nrows):  # skip header at row 0
            yield [str(ws.cell_value(row_idx, c)).strip() for c in range(ws.ncols)]


def _normalize_applies_to(fisica_val: str, moral_val: str) -> str:
    """Convierte columnas 'Física'/'Moral' del SAT al enum BOTH/FISICA/MORAL."""
    f = fisica_val.strip().upper() in ("SÍ", "SI", "S", "X", "TRUE", "1")
    m = moral_val.strip().upper() in ("SÍ", "SI", "S", "X", "TRUE", "1")
    if f and m:
        return "BOTH"
    if f:
        return "FISICA"
    return "MORAL"


# ---------------------------------------------------------------------------
# Funciones de sync — catálogos estáticos
# ---------------------------------------------------------------------------


async def sync_payment_forms(db: AsyncSession) -> CatalogSyncResult:
    result = CatalogSyncResult(catalog="sat_payment_forms")
    try:
        for form_id, description in _PAYMENT_FORMS:
            await db.execute(
                text(
                    """
                    INSERT INTO sat_payment_forms (form_id, description, is_active)
                    VALUES (:form_id, :description, TRUE)
                    ON CONFLICT (form_id) DO UPDATE
                        SET description = EXCLUDED.description,
                            is_active   = TRUE
                    """
                ),
                {"form_id": form_id, "description": description},
            )
            result.rows_processed += 1
        await db.commit()
        result.rows_upserted = result.rows_processed
    except Exception as exc:
        await db.rollback()
        result.error = str(exc)
    return result


async def sync_payment_methods(db: AsyncSession) -> CatalogSyncResult:
    result = CatalogSyncResult(catalog="sat_payment_methods")
    try:
        for method_id, description in _PAYMENT_METHODS:
            await db.execute(
                text(
                    """
                    INSERT INTO sat_payment_methods (method_id, description)
                    VALUES (:method_id, :description)
                    ON CONFLICT (method_id) DO UPDATE
                        SET description = EXCLUDED.description
                    """
                ),
                {"method_id": method_id, "description": description},
            )
            result.rows_processed += 1
        await db.commit()
        result.rows_upserted = result.rows_processed
    except Exception as exc:
        await db.rollback()
        result.error = str(exc)
    return result


async def sync_tax_regimes(db: AsyncSession) -> CatalogSyncResult:
    result = CatalogSyncResult(catalog="sat_tax_regimes")
    try:
        for code, description, applies_to in _TAX_REGIMES:
            await db.execute(
                text(
                    """
                    INSERT INTO sat_tax_regimes (code, description, applies_to)
                    VALUES (:code, :description, :applies_to)
                    ON CONFLICT (code) DO UPDATE
                        SET description = EXCLUDED.description,
                            applies_to  = EXCLUDED.applies_to
                    """
                ),
                {"code": code, "description": description, "applies_to": applies_to},
            )
            result.rows_processed += 1
        await db.commit()
        result.rows_upserted = result.rows_processed
    except Exception as exc:
        await db.rollback()
        result.error = str(exc)
    return result


async def sync_cfdi_uses(db: AsyncSession) -> CatalogSyncResult:
    result = CatalogSyncResult(catalog="sat_cfdi_uses")
    try:
        for use_id, description, applies_to in _CFDI_USES:
            await db.execute(
                text(
                    """
                    INSERT INTO sat_cfdi_uses (use_id, description, applies_to)
                    VALUES (:use_id, :description, :applies_to)
                    ON CONFLICT (use_id) DO UPDATE
                        SET description = EXCLUDED.description,
                            applies_to  = EXCLUDED.applies_to
                    """
                ),
                {"use_id": use_id, "description": description, "applies_to": applies_to},
            )
            result.rows_processed += 1
        await db.commit()
        result.rows_upserted = result.rows_processed
    except Exception as exc:
        await db.rollback()
        result.error = str(exc)
    return result


# ---------------------------------------------------------------------------
# Funciones de sync — catálogos descargados del SAT
# ---------------------------------------------------------------------------


async def _download_sat_catalog(url: str) -> tuple[bytes, str]:
    """Descarga el archivo de catálogos SAT. Retorna (contenido, nombre_archivo)."""
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    filename = url.split("/")[-1] or "catCFDI.xls"
    return resp.content, filename


async def sync_unit_keys_from_excel(
    db: AsyncSession, data: bytes, filename: str
) -> CatalogSyncResult:
    """Parsea hoja c_ClaveUnidad del Excel SAT y hace upsert en sat_unit_keys."""
    result = CatalogSyncResult(catalog="sat_unit_keys")
    try:
        wb = _open_workbook(data, filename)
        batch: list[dict[str, str]] = []

        for row in _iter_sheet_rows(wb, "c_ClaveUnidad"):
            if not row or not row[0]:
                continue
            code = row[0].strip()
            description = row[1].strip() if len(row) > 1 else code
            if not code:
                continue
            batch.append({"code": code, "description": description or code})
            result.rows_processed += 1

            if len(batch) >= 500:
                await _upsert_unit_keys_batch(db, batch)
                result.rows_upserted += len(batch)
                batch.clear()

        if batch:
            await _upsert_unit_keys_batch(db, batch)
            result.rows_upserted += len(batch)

        await db.commit()

    except Exception as exc:
        await db.rollback()
        result.error = str(exc)
    return result


async def _upsert_unit_keys_batch(db: AsyncSession, batch: list[dict[str, str]]) -> None:
    for row in batch:
        await db.execute(
            text(
                """
                INSERT INTO sat_unit_keys (id, code, description, is_active)
                VALUES (gen_random_uuid(), :code, :description, TRUE)
                ON CONFLICT (code) DO UPDATE
                    SET description = EXCLUDED.description,
                        is_active   = TRUE
                """
            ),
            row,
        )


async def sync_product_keys_from_excel(
    db: AsyncSession, data: bytes, filename: str
) -> CatalogSyncResult:
    """Parsea hoja c_ClaveProdServ del Excel SAT y hace upsert en sat_product_keys."""
    result = CatalogSyncResult(catalog="sat_product_keys")
    try:
        wb = _open_workbook(data, filename)
        batch: list[dict[str, str]] = []

        for row in _iter_sheet_rows(wb, "c_ClaveProdServ"):
            if not row or not row[0]:
                continue
            code = str(row[0]).strip()
            description = row[1].strip() if len(row) > 1 else code
            if not code:
                continue
            batch.append({"code": code, "description": description or code})
            result.rows_processed += 1

            if len(batch) >= 1000:
                await _upsert_product_keys_batch(db, batch)
                result.rows_upserted += len(batch)
                batch.clear()

        if batch:
            await _upsert_product_keys_batch(db, batch)
            result.rows_upserted += len(batch)

        await db.commit()

    except Exception as exc:
        await db.rollback()
        result.error = str(exc)
    return result


async def _upsert_product_keys_batch(db: AsyncSession, batch: list[dict[str, str]]) -> None:
    for row in batch:
        await db.execute(
            text(
                """
                INSERT INTO sat_product_keys (id, code, description, is_active)
                VALUES (gen_random_uuid(), :code, :description, TRUE)
                ON CONFLICT (code) DO UPDATE
                    SET description = EXCLUDED.description,
                        is_active   = TRUE
                """
            ),
            row,
        )


# ---------------------------------------------------------------------------
# Función principal — sync completo
# ---------------------------------------------------------------------------


async def run_full_sync(
    db: AsyncSession,
    include_product_keys: bool = True,
    include_unit_keys: bool = True,
    sat_url: str = SAT_CATALOG_URL_DEFAULT,
) -> SyncReport:
    """Ejecuta sync completo de todos los catálogos SAT.

    Para catálogos estáticos usa datos canónicos hardcodeados.
    Para claves producto/unidad descarga desde `sat_url`.
    """
    report = SyncReport()

    # Catálogos estáticos
    report.results.append(await sync_payment_forms(db))
    report.results.append(await sync_payment_methods(db))
    report.results.append(await sync_tax_regimes(db))
    report.results.append(await sync_cfdi_uses(db))

    if not (include_product_keys or include_unit_keys):
        return report

    # Descargar Excel del SAT
    try:
        data, filename = await _download_sat_catalog(sat_url)
    except Exception as exc:
        err = f"Error descargando catálogo SAT ({sat_url}): {exc}"
        if include_unit_keys:
            report.results.append(
                CatalogSyncResult(catalog="sat_unit_keys", error=err)
            )
        if include_product_keys:
            report.results.append(
                CatalogSyncResult(catalog="sat_product_keys", error=err)
            )
        return report

    if include_unit_keys:
        report.results.append(await sync_unit_keys_from_excel(db, data, filename))
    if include_product_keys:
        report.results.append(await sync_product_keys_from_excel(db, data, filename))

    return report
