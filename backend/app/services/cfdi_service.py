"""Service — Módulo CFDI 4.0."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.cfdi_models import CfdiIssuerConfig, CfdiPacLog, CfdiSeries
from app.models.ventas_logistica_models import (
    CFDI,
    CFDICreditNote,
    CFDIItem,
    CFDIPayment,
)
from app.schemas.cfdi_schemas import (
    CfdiCancelIn,
    CfdiCreateIn,
    CfdiCreditNoteIn,
    CfdiIssuerConfigIn,
    CfdiPaymentComplementIn,
    CfdiPpdPending,
    CfdiSeriesIn,
    CfdiSeriesUpdate,
)
from app.services.pac_client import get_pac_client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _round4(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


async def _get_cfdi_or_404(db: AsyncSession, cfdi_id: int) -> CFDI:
    result = await db.execute(
        select(CFDI)
        .options(selectinload(CFDI.items))
        .where(CFDI.cfdi_id == cfdi_id)
    )
    cfdi = result.scalar_one_or_none()
    if cfdi is None:
        raise ValueError(f"CFDI {cfdi_id} no encontrado")
    return cfdi


def _calc_item_totals(item_in: object) -> dict:
    """Calcula subtotal, tax_amount y total de un item."""
    qty = _round4(item_in.quantity)
    price = _round4(item_in.unit_price)
    discount = _round4(item_in.discount_amount)
    iva = _round4(item_in.iva_pct)
    subtotal = _round4(qty * price - discount)
    tax_amount = _round4(subtotal * iva)
    total = _round4(subtotal + tax_amount)
    return {"subtotal": subtotal, "tax_amount": tax_amount, "total": total}


# ---------------------------------------------------------------------------
# Issuer Config
# ---------------------------------------------------------------------------


async def get_active_issuer_config(db: AsyncSession) -> CfdiIssuerConfig | None:
    result = await db.execute(
        select(CfdiIssuerConfig)
        .where(CfdiIssuerConfig.is_active.is_(True))
        .order_by(CfdiIssuerConfig.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def save_issuer_config(
    db: AsyncSession, data: CfdiIssuerConfigIn, user_id: object
) -> CfdiIssuerConfig:
    # Desactiva la configuración anterior
    await db.execute(
        text("UPDATE cfdi_issuer_config SET is_active = FALSE, updated_at = NOW() WHERE is_active = TRUE")
    )
    config = CfdiIssuerConfig(
        rfc=data.rfc.upper(),
        legal_name=data.legal_name,
        tax_regime_id=data.tax_regime_id,
        zip_code=data.zip_code,
        csd_certificate_b64=data.csd_certificate_b64,
        csd_key_encrypted=data.csd_key_encrypted,
        csd_password_hash=data.csd_password_hash,
        csd_serial_number=data.csd_serial_number,
        csd_valid_from=data.csd_valid_from,
        csd_valid_to=data.csd_valid_to,
        pac_provider=data.pac_provider,
        pac_username=data.pac_username,
        pac_endpoint_url=data.pac_endpoint_url,
        pac_credentials_enc=data.pac_credentials_enc,
        pac_environment=data.pac_environment,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        created_by=user_id,
        is_active=True,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


# ---------------------------------------------------------------------------
# Series
# ---------------------------------------------------------------------------


async def list_series(db: AsyncSession, active_only: bool = True) -> list[CfdiSeries]:
    q = select(CfdiSeries).order_by(CfdiSeries.series)
    if active_only:
        q = q.where(CfdiSeries.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_series(db: AsyncSession, data: CfdiSeriesIn) -> CfdiSeries:
    existing = await db.execute(
        select(CfdiSeries).where(
            CfdiSeries.series == data.series.upper(),
            CfdiSeries.cfdi_type == data.cfdi_type,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError(f"Ya existe la serie '{data.series}' para tipo {data.cfdi_type}")
    serie = CfdiSeries(
        series=data.series.upper(),
        cfdi_type=data.cfdi_type,
        description=data.description,
        next_folio=1,
        is_active=True,
    )
    db.add(serie)
    await db.commit()
    await db.refresh(serie)
    return serie


async def update_series(db: AsyncSession, series_id: int, data: CfdiSeriesUpdate) -> CfdiSeries:
    result = await db.execute(select(CfdiSeries).where(CfdiSeries.series_id == series_id))
    serie = result.scalar_one_or_none()
    if serie is None:
        raise ValueError(f"Serie {series_id} no encontrada")
    if data.description is not None:
        serie.description = data.description
    if data.is_active is not None:
        serie.is_active = data.is_active
    await db.commit()
    await db.refresh(serie)
    return serie


# ---------------------------------------------------------------------------
# CFDI — crear borrador
# ---------------------------------------------------------------------------


async def create_cfdi_draft(
    db: AsyncSession, data: CfdiCreateIn, user_id: object
) -> CFDI:
    # Asignar folio atómico
    folio_result = await db.execute(
        text("SELECT out_series_id, out_folio FROM fn_assign_cfdi_folio(:series)"),
        {"series": data.series},
    )
    row = folio_result.fetchone()
    if row is None:
        raise ValueError(f"Serie '{data.series}' no encontrada o inactiva")
    series_id, folio = row

    # Obtener configuración activa del emisor
    issuer = await get_active_issuer_config(db)

    # Calcular totales del CFDI
    subtotal = 0.0
    tax_total = 0.0
    items_data = []
    for idx, item_in in enumerate(data.items, start=1):
        t = _calc_item_totals(item_in)
        subtotal += t["subtotal"]
        tax_total += t["tax_amount"]
        items_data.append((item_in, t, idx))

    subtotal = _round4(subtotal)
    tax_total = _round4(tax_total)
    total = _round4(subtotal + tax_total)

    cfdi = CFDI(
        cfdi_number=data.cfdi_number,
        cfdi_type=data.cfdi_type,
        series=data.series,
        series_id=series_id,
        folio=folio,
        cfdi_version="4.0",
        issuer_config_id=issuer.config_id if issuer else None,
        issuer_rfc=data.issuer_rfc or (issuer.rfc if issuer else None),
        issuer_name=data.issuer_name or (issuer.legal_name if issuer else None),
        issuer_tax_regime=data.issuer_tax_regime,
        receiver_rfc=data.receiver_rfc,
        receiver_name=data.receiver_name,
        receiver_tax_regime=data.receiver_tax_regime,
        receiver_zip=data.receiver_zip,
        order_id=data.order_id,
        customer_id=data.customer_id,
        sales_rep_id=user_id,
        issue_date=data.issue_date,
        subtotal=subtotal,
        tax_amount=tax_total,
        total=total,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        payment_method=data.payment_method,
        payment_form=data.payment_form,
        cfdi_use=data.cfdi_use,
        status="DRAFT",
    )
    db.add(cfdi)
    await db.flush()  # genera cfdi_id sin hacer commit

    for item_in, totals, sort_order in items_data:
        item = CFDIItem(
            cfdi_id=cfdi.cfdi_id,
            order_item_id=item_in.order_item_id,
            product_id=item_in.product_id,
            sat_product_key_id=item_in.sat_product_key_id,
            sat_unit_key_id=item_in.sat_unit_key_id,
            unit_key=item_in.unit_key,
            product_key=item_in.product_key,
            description=item_in.description,
            quantity=item_in.quantity,
            unit_price=item_in.unit_price,
            discount_amount=item_in.discount_amount,
            iva_pct=item_in.iva_pct,
            tax_rate=item_in.iva_pct,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],
            sort_order=sort_order,
        )
        db.add(item)

    await db.commit()
    await db.refresh(cfdi)
    # Eager-load items antes de que la sesión cierre
    result = await db.execute(
        select(CFDI)
        .options(selectinload(CFDI.items))
        .where(CFDI.cfdi_id == cfdi.cfdi_id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# CFDI — listar / obtener
# ---------------------------------------------------------------------------


async def list_cfdis(
    db: AsyncSession,
    cfdi_type: str | None = None,
    status: str | None = None,
    customer_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[CFDI]:
    q = select(CFDI).order_by(CFDI.issue_date.desc(), CFDI.cfdi_id.desc())
    if cfdi_type:
        q = q.where(CFDI.cfdi_type == cfdi_type)
    if status:
        q = q.where(CFDI.status == status)
    if customer_id:
        q = q.where(CFDI.customer_id == customer_id)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_cfdi(db: AsyncSession, cfdi_id: int) -> CFDI:
    return await _get_cfdi_or_404(db, cfdi_id)


# ---------------------------------------------------------------------------
# CFDI — timbrar
# ---------------------------------------------------------------------------


async def stamp_cfdi(db: AsyncSession, cfdi_id: int, user_id: object) -> CFDI:
    cfdi = await _get_cfdi_or_404(db, cfdi_id)

    if cfdi.status not in ("DRAFT", "ISSUED"):
        raise ValueError(f"No se puede timbrar un CFDI en estado '{cfdi.status}'")

    issuer = await get_active_issuer_config(db)
    pac = get_pac_client(
        issuer.pac_provider if issuer else None,
        issuer.pac_environment if issuer else "SANDBOX",
    )

    # Generar XML mínimo (stub — en producción usar librería CFDI 4.0)
    xml_stub = f"<CFDI version='4.0' folio='{cfdi.folio}' uuid_pendiente='true'/>"

    stamp_result = await pac.stamp(xml_stub, cfdi_id)

    log = CfdiPacLog(
        cfdi_id=cfdi_id,
        operation="TIMBRAR",
        success=stamp_result.success,
        uuid_received=stamp_result.uuid,
        error_code=stamp_result.error_code,
        error_message=stamp_result.error_message,
        pac_response=stamp_result.raw_response,
        pac_provider=issuer.pac_provider if issuer else "STUB",
        user_id=user_id,
    )
    db.add(log)

    if not stamp_result.success:
        await db.commit()
        raise ValueError(
            f"Error PAC [{stamp_result.error_code}]: {stamp_result.error_message}"
        )

    cfdi.uuid = stamp_result.uuid
    cfdi.sello_cfdi = stamp_result.sello_cfdi
    cfdi.sello_sat = stamp_result.sello_sat
    cfdi.certificate_number = stamp_result.certificate_number
    cfdi.timbre_date = stamp_result.timbre_date
    cfdi.certification_date = stamp_result.timbre_date
    cfdi.status = "TIMBRADO"
    cfdi.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(cfdi)
    return cfdi


# ---------------------------------------------------------------------------
# CFDI — cancelar
# ---------------------------------------------------------------------------


async def cancel_cfdi(
    db: AsyncSession, cfdi_id: int, data: CfdiCancelIn, user_id: object
) -> CFDI:
    cfdi = await _get_cfdi_or_404(db, cfdi_id)

    if cfdi.status not in ("TIMBRADO", "ISSUED"):
        raise ValueError(f"No se puede cancelar un CFDI en estado '{cfdi.status}'")

    substitute_uuid = None
    if data.reason == "01" and data.substitute_cfdi_number:
        sub_result = await db.execute(
            select(CFDI.uuid).where(CFDI.cfdi_number == data.substitute_cfdi_number)
        )
        substitute_uuid = sub_result.scalar_one_or_none()

    issuer = await get_active_issuer_config(db)
    pac = get_pac_client(
        issuer.pac_provider if issuer else None,
        issuer.pac_environment if issuer else "SANDBOX",
    )

    cancel_result = await pac.cancel(
        uuid=cfdi.uuid or "",
        issuer_rfc=cfdi.issuer_rfc or "",
        receiver_rfc=cfdi.receiver_rfc or "",
        total=str(cfdi.total),
        reason=data.reason,
        substitute_uuid=substitute_uuid,
    )

    log = CfdiPacLog(
        cfdi_id=cfdi_id,
        operation="CANCELAR",
        success=cancel_result.success,
        error_code=cancel_result.error_code,
        error_message=cancel_result.error_message,
        pac_response=cancel_result.raw_response,
        pac_provider=issuer.pac_provider if issuer else "STUB",
        user_id=user_id,
    )
    db.add(log)

    if not cancel_result.success:
        await db.commit()
        raise ValueError(
            f"Error cancelación PAC [{cancel_result.error_code}]: {cancel_result.error_message}"
        )

    cfdi.status = "CANCELLED"
    cfdi.sat_cancellation_motive = data.reason
    cfdi.cancelled_at = datetime.now(timezone.utc)
    cfdi.cancellation_reason = data.notes
    if substitute_uuid:
        cfdi.sat_cancellation_uuid_substitute = substitute_uuid
    cfdi.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(cfdi)
    return cfdi


# ---------------------------------------------------------------------------
# Nota de crédito (Tipo E)
# ---------------------------------------------------------------------------


async def create_credit_note(
    db: AsyncSession, data: CfdiCreditNoteIn, user_id: object
) -> CFDI:
    # Verificar que el CFDI original existe y es tipo I
    original = await _get_cfdi_or_404(db, data.original_cfdi_id)
    if original.cfdi_type != "I":
        raise ValueError("Las notas de crédito solo aplican sobre CFDIs de tipo I")

    # Crear el CFDI Tipo E como draft
    create_in = CfdiCreateIn(
        cfdi_number=data.cfdi_number,
        cfdi_type="E",
        series=data.series,
        customer_id=original.customer_id,
        order_id=original.order_id,
        issue_date=data.issue_date,
        currency=original.currency,
        exchange_rate=original.exchange_rate,
        payment_method=original.payment_method,
        payment_form=original.payment_form,
        cfdi_use=original.cfdi_use,
        issuer_rfc=original.issuer_rfc,
        issuer_name=original.issuer_name,
        receiver_rfc=original.receiver_rfc,
        receiver_name=original.receiver_name,
        receiver_zip=original.receiver_zip,
        items=data.items,
    )
    cfdi_e = await create_cfdi_draft(db, create_in, user_id)

    # Registrar el vínculo de nota de crédito
    credit_note = CFDICreditNote(
        cfdi_id=cfdi_e.cfdi_id,
        original_cfdi_id=data.original_cfdi_id,
        relation_type=data.relation_type,
        reason=data.reason,
        amount=data.amount,
        issued_by=user_id,
        notes=data.notes,
    )
    db.add(credit_note)
    await db.commit()
    return cfdi_e


# ---------------------------------------------------------------------------
# Complemento de pago (Tipo P)
# ---------------------------------------------------------------------------


async def create_payment_complement(
    db: AsyncSession, data: CfdiPaymentComplementIn, user_id: object
) -> CFDIPayment:
    cfdi = await _get_cfdi_or_404(db, data.cfdi_id)

    if cfdi.payment_method != "PPD":
        raise ValueError("Los complementos de pago solo aplican a CFDIs con método PPD")
    if cfdi.status in ("CANCELLED", "SUPERSEDED"):
        raise ValueError(f"No se puede registrar pago en CFDI con estado '{cfdi.status}'")

    # Calcular parcialidad
    partiality_result = await db.execute(
        text(
            "SELECT COALESCE(MAX(partial_number), 0) + 1 AS next_partial, "
            "COALESCE(SUM(amount_paid), 0) AS total_paid "
            "FROM cfdi_payments WHERE cfdi_id = :cfdi_id"
        ),
        {"cfdi_id": data.cfdi_id},
    )
    row = partiality_result.fetchone()
    next_partial = row.next_partial
    total_paid_prev = float(row.total_paid)

    previous_balance = _round4(cfdi.total - total_paid_prev)
    remaining = _round4(previous_balance - data.amount_paid)

    payment = CFDIPayment(
        cfdi_id=data.cfdi_id,
        payment_date=data.payment_date,
        payment_form=data.payment_form,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        amount=data.amount_paid,
        partial_number=next_partial,
        previous_balance=previous_balance,
        amount_paid=data.amount_paid,
        remaining_balance=max(remaining, 0.0),
        bank_reference=data.bank_reference,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


# ---------------------------------------------------------------------------
# PPD pendientes
# ---------------------------------------------------------------------------


async def list_ppd_pending(db: AsyncSession) -> list[CfdiPpdPending]:
    result = await db.execute(text("SELECT * FROM v_cfdi_ppd_pending_payment"))
    rows = result.mappings().all()
    return [
        CfdiPpdPending(
            cfdi_id=r["cfdi_id"],
            uuid=r["uuid"],
            cfdi_number=r["cfdi_number"],
            series_code=r["series_code"],
            folio=r["folio"],
            issue_date=r["issue_date"],
            customer_name=r["customer_name"],
            customer_rfc=r["customer_rfc"],
            total=float(r["total"]),
            paid_amount=float(r["paid_amount"]),
            remaining_balance=float(r["remaining_balance"]),
            days_since_issue=int(r["days_since_issue"]) if r["days_since_issue"] is not None else 0,
            status=r["status"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# PAC Log
# ---------------------------------------------------------------------------


async def list_pac_log(
    db: AsyncSession, cfdi_id: int, limit: int = 50
) -> list[CfdiPacLog]:
    result = await db.execute(
        select(CfdiPacLog)
        .where(CfdiPacLog.cfdi_id == cfdi_id)
        .order_by(CfdiPacLog.requested_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
