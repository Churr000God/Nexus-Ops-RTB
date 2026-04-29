"""Service — Módulo Ventas y Logística."""

from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.ventas_logistica_models import (
    CFDI,
    CFDIItem,
    Carrier,
    DeliveryNote,
    DeliveryNoteItem,
    Order,
    OrderItem,
    OrderMilestone,
    Payment,
    PaymentApplication,
    SalesQuote,
    QuoteDeliveryNote,
    SalesQuoteItem,
    QuoteStatusHistory,
    Route,
    RouteStop,
    Shipment,
    ShipmentItem,
    ShipmentTrackingEvent,
)
from app.schemas.ventas_logistica_schema import (
    CarrierCreate,
    CarrierUpdate,
    CFDICancelRequest,
    CFDICreate,
    DeliveryNoteCreate,
    DeliveryNoteUpdate,
    OrderItemPackUpdate,
    OrderUpdate,
    PaymentApplicationCreate,
    PaymentCreate,
    QuoteApprove,
    QuoteCreate,
    QuoteLinkDeliveryNotes,
    QuoteReject,
    QuoteUpdate,
    RouteCreate,
    RouteStopCreate,
    RouteStopUpdate,
    RouteUpdate,
    ShipmentCreate,
    ShipmentDeliverRequest,
    ShipmentUpdate,
    TrackingEventCreate,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _next_number(prefix: str, seq: int) -> str:
    year = datetime.now(timezone.utc).year
    return f"{prefix}-{year}-{seq:05d}"


async def _seq_for(db: AsyncSession, table: str) -> int:
    result = await db.execute(text(f"SELECT COALESCE(MAX(CAST(SPLIT_PART({table}_number, '-', 3) AS INT)), 0) + 1 FROM {table}s"))
    return result.scalar() or 1


# ---------------------------------------------------------------------------
# Carriers
# ---------------------------------------------------------------------------

async def list_carriers(db: AsyncSession, active_only: bool = True) -> list[Carrier]:
    q = select(Carrier)
    if active_only:
        q = q.where(Carrier.is_active.is_(True))
    result = await db.execute(q.order_by(Carrier.name))
    return list(result.scalars())


async def get_carrier(db: AsyncSession, carrier_id: int) -> Carrier | None:
    result = await db.execute(select(Carrier).where(Carrier.carrier_id == carrier_id))
    return result.scalar_one_or_none()


async def create_carrier(db: AsyncSession, data: CarrierCreate) -> Carrier:
    carrier = Carrier(**data.model_dump())
    db.add(carrier)
    await db.commit()
    await db.refresh(carrier)
    return carrier


async def update_carrier(db: AsyncSession, carrier_id: int, data: CarrierUpdate) -> Carrier | None:
    carrier = await get_carrier(db, carrier_id)
    if not carrier:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(carrier, field, value)
    carrier.updated_at = _now()
    await db.commit()
    await db.refresh(carrier)
    return carrier


async def delete_carrier(db: AsyncSession, carrier_id: int) -> bool:
    carrier = await get_carrier(db, carrier_id)
    if not carrier:
        return False
    carrier.is_active = False
    carrier.updated_at = _now()
    await db.commit()
    return True


# ---------------------------------------------------------------------------
# Delivery Notes
# ---------------------------------------------------------------------------

async def _calc_dn_totals(items: list[dict]) -> tuple[float, float, float]:
    subtotal = sum(
        i["quantity"] * i["unit_price"] - i.get("discount_amount", 0)
        for i in items
    )
    tax = sum(
        (i["quantity"] * i["unit_price"] - i.get("discount_amount", 0)) * i.get("tax_rate", 0.16)
        for i in items
    )
    return round(subtotal, 4), round(tax, 4), round(subtotal + tax, 4)


async def list_delivery_notes(
    db: AsyncSession,
    customer_id: int | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[DeliveryNote]:
    q = select(DeliveryNote).options(selectinload(DeliveryNote.items))
    if customer_id:
        q = q.where(DeliveryNote.customer_id == customer_id)
    if status:
        q = q.where(DeliveryNote.status == status)
    q = q.order_by(DeliveryNote.issue_date.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_delivery_note(db: AsyncSession, note_id: int) -> DeliveryNote | None:
    result = await db.execute(
        select(DeliveryNote)
        .options(selectinload(DeliveryNote.items))
        .where(DeliveryNote.delivery_note_id == note_id)
    )
    return result.scalar_one_or_none()


async def create_delivery_note(
    db: AsyncSession, data: DeliveryNoteCreate, user_id: UUID
) -> DeliveryNote:
    result = await db.execute(
        text("SELECT COALESCE(MAX(delivery_note_id), 0) + 1 FROM delivery_notes")
    )
    seq = result.scalar()
    note_number = f"NR-{datetime.now(timezone.utc).year}-{seq:05d}"

    items_data = [i.model_dump() for i in data.items]
    subtotal, tax, total = await _calc_dn_totals(items_data)

    note = DeliveryNote(
        note_number=note_number,
        customer_id=data.customer_id,
        shipping_address_id=data.shipping_address_id,
        sales_rep_id=user_id,
        issue_date=data.issue_date,
        delivery_date=data.delivery_date,
        customer_po_number=data.customer_po_number,
        customer_po_date=data.customer_po_date,
        notes=data.notes,
        subtotal=subtotal,
        tax_amount=tax,
        total=total,
    )
    db.add(note)
    await db.flush()

    for item_data in items_data:
        qty = item_data["quantity"]
        price = item_data["unit_price"]
        disc = item_data.get("discount_amount", 0)
        rate = item_data.get("tax_rate", 0.16)
        sub = qty * price - disc
        item = DeliveryNoteItem(
            delivery_note_id=note.delivery_note_id,
            subtotal=round(sub, 4),
            tax_amount=round(sub * rate, 4),
            total=round(sub * (1 + rate), 4),
            **item_data,
        )
        db.add(item)

    await db.commit()
    await db.refresh(note)
    return note


async def update_delivery_note(
    db: AsyncSession, note_id: int, data: DeliveryNoteUpdate
) -> DeliveryNote | None:
    note = await get_delivery_note(db, note_id)
    if not note:
        return None
    updates = data.model_dump(exclude_none=True)
    if "status" in updates and updates["status"] == "CANCELLED":
        updates["cancelled_at"] = _now()
    for field, value in updates.items():
        setattr(note, field, value)
    note.updated_at = _now()
    await db.commit()
    await db.refresh(note)
    return note


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------

def _calc_quote_item_totals(qty: float, price: float, disc_pct: float, rate: float) -> tuple:
    sub = qty * price * (1 - disc_pct / 100)
    tax = sub * rate
    return round(sub, 4), round(tax, 4), round(sub + tax, 4)


async def list_quotes(
    db: AsyncSession,
    customer_id: int | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SalesQuote]:
    q = select(Quote).options(selectinload(SalesQuote.items))
    if customer_id:
        q = q.where(SalesQuote.customer_id == customer_id)
    if status:
        q = q.where(SalesQuote.status == status)
    q = q.order_by(SalesQuote.issue_date.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_quote(db: AsyncSession, quote_id: int) -> SalesQuote | None:
    result = await db.execute(
        select(Quote)
        .options(
            selectinload(SalesQuote.items),
            selectinload(SalesQuote.status_history),
            selectinload(SalesQuote.delivery_note_links),
        )
        .where(SalesQuote.quote_id == quote_id)
    )
    return result.scalar_one_or_none()


async def create_quote(
    db: AsyncSession, data: QuoteCreate, user_id: UUID
) -> SalesQuote:
    result = await db.execute(
        text("SELECT COALESCE(MAX(quote_id), 0) + 1 FROM quotes")
    )
    seq = result.scalar()
    quote_number = f"COT-{datetime.now(timezone.utc).year}-{seq:05d}"

    subtotal = 0.0
    tax_total = 0.0
    for item in data.items:
        sub, tax, _ = _calc_quote_item_totals(item.quantity, item.unit_price, item.discount_pct, item.tax_rate)
        subtotal += sub
        tax_total += tax

    quote = SalesQuote(
        quote_number=quote_number,
        customer_id=data.customer_id,
        sales_rep_id=user_id,
        issue_date=data.issue_date,
        expiry_date=data.expiry_date,
        customer_po_number=data.customer_po_number,
        customer_po_date=data.customer_po_date,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        payment_terms=data.payment_terms,
        shipping_address_id=data.shipping_address_id,
        notes=data.notes,
        internal_notes=data.internal_notes,
        subtotal=round(subtotal, 4),
        tax_amount=round(tax_total, 4),
        total=round(subtotal + tax_total, 4),
    )
    db.add(quote)
    await db.flush()

    for idx, item_data in enumerate(data.items):
        sub, tax, total = _calc_quote_item_totals(
            item_data.quantity, item_data.unit_price, item_data.discount_pct, item_data.tax_rate
        )
        item = SalesQuoteItem(
            quote_id=quote.quote_id,
            subtotal=sub,
            tax_amount=tax,
            total=total,
            **item_data.model_dump(),
        )
        db.add(item)

    db.add(QuoteStatusHistory(
        quote_id=quote.quote_id,
        from_status=None,
        to_status="DRAFT",
        changed_by=user_id,
    ))

    await db.commit()
    await db.refresh(quote)
    return quote


async def update_quote(db: AsyncSession, quote_id: int, data: QuoteUpdate) -> SalesQuote | None:
    quote = await get_quote(db, quote_id)
    if not quote:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(quote, field, value)
    quote.updated_at = _now()
    await db.commit()
    await db.refresh(quote)
    return quote


async def approve_quote(
    db: AsyncSession, quote_id: int, user_id: UUID, data: QuoteApprove
) -> SalesQuote | None:
    quote = await get_quote(db, quote_id)
    if not quote or quote.status not in ("DRAFT", "SUBMITTED"):
        return None
    prev = quote.status
    quote.status = "APPROVED"
    quote.approved_by = user_id
    quote.approved_at = _now()
    quote.updated_at = _now()
    db.add(QuoteStatusHistory(
        quote_id=quote_id,
        from_status=prev,
        to_status="APPROVED",
        changed_by=user_id,
        notes=data.notes,
    ))
    await db.commit()
    await db.refresh(quote)
    return quote


async def reject_quote(
    db: AsyncSession, quote_id: int, user_id: UUID, data: QuoteReject
) -> SalesQuote | None:
    quote = await get_quote(db, quote_id)
    if not quote or quote.status not in ("DRAFT", "SUBMITTED"):
        return None
    prev = quote.status
    quote.status = "REJECTED"
    quote.rejected_by = user_id
    quote.rejected_at = _now()
    quote.rejection_reason = data.rejection_reason
    quote.updated_at = _now()
    db.add(QuoteStatusHistory(
        quote_id=quote_id,
        from_status=prev,
        to_status="REJECTED",
        changed_by=user_id,
        notes=data.rejection_reason,
    ))
    await db.commit()
    await db.refresh(quote)
    return quote


async def link_delivery_notes_to_quote(
    db: AsyncSession, quote_id: int, user_id: UUID, data: QuoteLinkDeliveryNotes
) -> SalesQuote | None:
    quote = await get_quote(db, quote_id)
    if not quote:
        return None
    for dn_id in data.delivery_note_ids:
        existing = await db.execute(
            select(QuoteDeliveryNote).where(
                QuoteDeliveryNote.quote_id == quote_id,
                QuoteDeliveryNote.delivery_note_id == dn_id,
            )
        )
        if existing.scalar_one_or_none():
            continue
        db.add(QuoteDeliveryNote(
            quote_id=quote_id,
            delivery_note_id=dn_id,
            associated_by=user_id,
            notes=data.notes,
        ))
        await db.execute(
            text("UPDATE delivery_notes SET status='TRANSFORMED', updated_at=NOW() WHERE delivery_note_id=:id"),
            {"id": dn_id},
        )
    await db.commit()
    await db.refresh(quote)
    return quote


# ---------------------------------------------------------------------------
# Orders (read + update; creation is via trigger on quote approval)
# ---------------------------------------------------------------------------

async def list_orders(
    db: AsyncSession,
    customer_id: int | None = None,
    status: str | None = None,
    packing_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Order]:
    q = select(Order).options(selectinload(Order.items))
    if customer_id:
        q = q.where(Order.customer_id == customer_id)
    if status:
        q = q.where(Order.status == status)
    if packing_status:
        q = q.where(Order.packing_status == packing_status)
    q = q.order_by(Order.order_date.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_order(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.milestones),
        )
        .where(Order.order_id == order_id)
    )
    return result.scalar_one_or_none()


async def update_order(db: AsyncSession, order_id: int, data: OrderUpdate) -> Order | None:
    order = await get_order(db, order_id)
    if not order:
        return None
    updates = data.model_dump(exclude_none=True)
    if "status" in updates and updates["status"] == "CANCELLED":
        updates["cancelled_at"] = _now()
        db.add(OrderMilestone(order_id=order_id, milestone_type="CANCELLED"))
    for field, value in updates.items():
        setattr(order, field, value)
    order.updated_at = _now()
    await db.commit()
    await db.refresh(order)
    return order


async def pack_order_item(
    db: AsyncSession, order_id: int, item_id: int, data: OrderItemPackUpdate, user_id: UUID
) -> OrderItem | None:
    result = await db.execute(
        select(OrderItem).where(
            OrderItem.order_item_id == item_id,
            OrderItem.order_id == order_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return None
    if data.quantity_packed > item.quantity_ordered:
        return None
    item.quantity_packed = data.quantity_packed
    item.updated_at = _now()

    # Recalculate order packing_status
    all_items_result = await db.execute(
        select(OrderItem).where(OrderItem.order_id == order_id)
    )
    all_items = list(all_items_result.scalars())
    total_ordered = sum(i.quantity_ordered for i in all_items)
    total_packed = sum(
        data.quantity_packed if i.order_item_id == item_id else i.quantity_packed
        for i in all_items
    )
    order_result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = order_result.scalar_one_or_none()
    if order:
        if total_packed == 0:
            order.packing_status = "NOT_STARTED"
        elif total_packed >= total_ordered:
            order.packing_status = "READY"
        else:
            order.packing_status = "IN_PROGRESS"
        order.updated_at = _now()

    await db.commit()
    await db.refresh(item)
    return item


async def get_order_packing_progress(db: AsyncSession, order_id: int) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM v_order_packing_progress WHERE order_id = :id"),
        {"id": order_id},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def get_order_payment_status(db: AsyncSession, order_id: int) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM v_order_payment_status WHERE order_id = :id"),
        {"id": order_id},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def list_incomplete_orders(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        text("SELECT * FROM v_orders_incomplete_tracking ORDER BY days_open DESC")
    )
    return [dict(r) for r in result.mappings()]


# ---------------------------------------------------------------------------
# CFDI
# ---------------------------------------------------------------------------

async def list_cfdi(
    db: AsyncSession,
    customer_id: int | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CFDI]:
    q = select(CFDI).options(selectinload(CFDI.items))
    if customer_id:
        q = q.where(CFDI.customer_id == customer_id)
    if status:
        q = q.where(CFDI.status == status)
    q = q.order_by(CFDI.issue_date.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_cfdi(db: AsyncSession, cfdi_id: int) -> CFDI | None:
    result = await db.execute(
        select(CFDI)
        .options(selectinload(CFDI.items))
        .where(CFDI.cfdi_id == cfdi_id)
    )
    return result.scalar_one_or_none()


async def create_cfdi(
    db: AsyncSession, data: CFDICreate, user_id: UUID
) -> CFDI:
    result = await db.execute(
        text("SELECT COALESCE(MAX(cfdi_id), 0) + 1 FROM cfdi")
    )
    seq = result.scalar()
    cfdi_number = f"CFDI-{datetime.now(timezone.utc).year}-{seq:05d}"

    subtotal = sum(
        (i.quantity * i.unit_price - i.discount_amount)
        for i in data.items
    )
    tax = sum(
        (i.quantity * i.unit_price - i.discount_amount) * i.tax_rate
        for i in data.items
    )

    cfdi = CFDI(
        cfdi_number=cfdi_number,
        order_id=data.order_id,
        customer_id=data.customer_id,
        sales_rep_id=user_id,
        cfdi_type=data.cfdi_type,
        series=data.series,
        issue_date=data.issue_date,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        payment_method=data.payment_method,
        payment_form=data.payment_form,
        cfdi_use=data.cfdi_use,
        subtotal=round(subtotal, 4),
        tax_amount=round(tax, 4),
        total=round(subtotal + tax, 4),
    )
    db.add(cfdi)
    await db.flush()

    for item_data in data.items:
        sub = item_data.quantity * item_data.unit_price - item_data.discount_amount
        tax_i = sub * item_data.tax_rate
        item = CFDIItem(
            cfdi_id=cfdi.cfdi_id,
            subtotal=round(sub, 4),
            tax_amount=round(tax_i, 4),
            total=round(sub + tax_i, 4),
            **item_data.model_dump(),
        )
        db.add(item)

    await db.commit()
    await db.refresh(cfdi)
    return cfdi


async def cancel_cfdi(
    db: AsyncSession, cfdi_id: int, data: CFDICancelRequest, user_id: UUID
) -> CFDI | None:
    cfdi = await get_cfdi(db, cfdi_id)
    if not cfdi or cfdi.status != "ISSUED":
        return None
    cfdi.status = "CANCELLED"
    cfdi.cancelled_at = _now()
    cfdi.cancellation_reason = data.cancellation_reason
    cfdi.sat_cancellation_motive = data.sat_cancellation_motive
    if data.replaces_cfdi_id:
        cfdi.sat_cancellation_uuid_substitute = str(data.replaces_cfdi_id)
        cfdi.replaced_by_cfdi_id = data.replaces_cfdi_id
    cfdi.updated_at = _now()
    await db.commit()
    await db.refresh(cfdi)
    return cfdi


async def list_cfdi_cancellations(
    db: AsyncSession, days: int = 30
) -> list[dict]:
    result = await db.execute(
        text(f"SELECT * FROM v_cfdi_cancellations WHERE cancelled_at >= NOW() - INTERVAL '{days} days'")
    )
    return [dict(r) for r in result.mappings()]


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

async def list_payments(
    db: AsyncSession,
    customer_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Payment]:
    q = select(Payment).options(selectinload(Payment.applications))
    if customer_id:
        q = q.where(Payment.customer_id == customer_id)
    q = q.order_by(Payment.payment_date.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_payment(db: AsyncSession, payment_id: int) -> Payment | None:
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.applications))
        .where(Payment.payment_id == payment_id)
    )
    return result.scalar_one_or_none()


async def create_payment(
    db: AsyncSession, data: PaymentCreate, user_id: UUID
) -> Payment:
    result = await db.execute(
        text("SELECT COALESCE(MAX(payment_id), 0) + 1 FROM payments")
    )
    seq = result.scalar()
    payment_number = f"PAY-{datetime.now(timezone.utc).year}-{seq:05d}"

    payment = Payment(
        payment_number=payment_number,
        recorded_by=user_id,
        **data.model_dump(),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


async def apply_payment(
    db: AsyncSession, payment_id: int, data: PaymentApplicationCreate, user_id: UUID
) -> PaymentApplication | None:
    payment = await get_payment(db, payment_id)
    if not payment or payment.status == "CANCELLED":
        return None

    app = PaymentApplication(
        payment_id=payment_id,
        order_id=data.order_id,
        cfdi_id=data.cfdi_id,
        amount_applied=data.amount_applied,
        applied_by=user_id,
        notes=data.notes,
    )
    db.add(app)

    total_applied_result = await db.execute(
        text("SELECT COALESCE(SUM(amount_applied), 0) FROM payment_applications WHERE payment_id = :pid"),
        {"pid": payment_id},
    )
    total_applied = (total_applied_result.scalar() or 0) + data.amount_applied

    if total_applied >= payment.amount:
        payment.status = "APPLIED"
    else:
        payment.status = "PARTIALLY_APPLIED"
    payment.updated_at = _now()

    await db.commit()
    await db.refresh(app)
    return app


# ---------------------------------------------------------------------------
# Shipments
# ---------------------------------------------------------------------------

async def list_shipments(
    db: AsyncSession,
    order_id: int | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Shipment]:
    q = select(Shipment).options(
        selectinload(Shipment.items),
        selectinload(Shipment.tracking_events),
    )
    if order_id:
        q = q.where(Shipment.order_id == order_id)
    if status:
        q = q.where(Shipment.status == status)
    q = q.order_by(Shipment.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_shipment(db: AsyncSession, shipment_id: int) -> Shipment | None:
    result = await db.execute(
        select(Shipment)
        .options(
            selectinload(Shipment.items),
            selectinload(Shipment.tracking_events),
        )
        .where(Shipment.shipment_id == shipment_id)
    )
    return result.scalar_one_or_none()


async def create_shipment(
    db: AsyncSession, data: ShipmentCreate, user_id: UUID
) -> Shipment:
    result = await db.execute(
        text("SELECT COALESCE(MAX(shipment_id), 0) + 1 FROM shipments")
    )
    seq = result.scalar()
    shipment_number = f"SHP-{datetime.now(timezone.utc).year}-{seq:05d}"

    shipment = Shipment(
        shipment_number=shipment_number,
        order_id=data.order_id,
        delivery_note_id=data.delivery_note_id,
        customer_address_id=data.customer_address_id,
        carrier_id=data.carrier_id,
        tracking_number=data.tracking_number,
        shipping_date=data.shipping_date,
        estimated_arrival=data.estimated_arrival,
        shipping_cost=data.shipping_cost,
        created_by=user_id,
    )
    db.add(shipment)
    await db.flush()

    for item_data in data.items:
        db.add(ShipmentItem(
            shipment_id=shipment.shipment_id,
            **item_data.model_dump(),
        ))

    db.add(ShipmentTrackingEvent(
        shipment_id=shipment.shipment_id,
        status_code="CREATED",
        description="Envío creado",
        recorded_by=user_id,
        is_automatic=True,
    ))

    await db.commit()
    await db.refresh(shipment)
    return shipment


async def update_shipment(
    db: AsyncSession, shipment_id: int, data: ShipmentUpdate
) -> Shipment | None:
    shipment = await get_shipment(db, shipment_id)
    if not shipment:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(shipment, field, value)
    shipment.updated_at = _now()
    await db.commit()
    await db.refresh(shipment)
    return shipment


async def deliver_shipment(
    db: AsyncSession, shipment_id: int, data: ShipmentDeliverRequest, user_id: UUID
) -> Shipment | None:
    shipment = await get_shipment(db, shipment_id)
    if not shipment or shipment.status == "DELIVERED":
        return None
    shipment.status = "DELIVERED"
    shipment.received_by_name = data.received_by_name
    shipment.actual_arrival = data.actual_arrival or date.today()
    if data.delivery_evidence_url:
        shipment.delivery_evidence_url = data.delivery_evidence_url
    shipment.updated_at = _now()

    db.add(ShipmentTrackingEvent(
        shipment_id=shipment_id,
        status_code="DELIVERED",
        description=f"Entregado a {data.received_by_name}",
        recorded_by=user_id,
        is_automatic=False,
    ))

    await db.commit()
    await db.refresh(shipment)
    return shipment


async def add_tracking_event(
    db: AsyncSession, shipment_id: int, data: TrackingEventCreate, user_id: UUID
) -> ShipmentTrackingEvent:
    event = ShipmentTrackingEvent(
        shipment_id=shipment_id,
        event_date=data.event_date or _now(),
        location=data.location,
        status_code=data.status_code,
        description=data.description,
        recorded_by=user_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def list_shipments_overview(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        text("SELECT * FROM v_shipments_overview ORDER BY shipment_id DESC")
    )
    return [dict(r) for r in result.mappings()]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

async def list_routes(
    db: AsyncSession,
    route_date: date | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Route]:
    q = select(Route).options(selectinload(Route.stops))
    if route_date:
        q = q.where(Route.route_date == route_date)
    if status:
        q = q.where(Route.status == status)
    q = q.order_by(Route.route_date.desc(), Route.route_id.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars())


async def get_route(db: AsyncSession, route_id: int) -> Route | None:
    result = await db.execute(
        select(Route)
        .options(selectinload(Route.stops))
        .where(Route.route_id == route_id)
    )
    return result.scalar_one_or_none()


async def create_route(
    db: AsyncSession, data: RouteCreate, user_id: UUID
) -> Route:
    result = await db.execute(
        text("SELECT COALESCE(MAX(route_id), 0) + 1 FROM routes")
    )
    seq = result.scalar()
    route_number = f"RUT-{datetime.now(timezone.utc).year}-{seq:05d}"

    route = Route(
        route_number=route_number,
        route_date=data.route_date,
        driver_user_id=data.driver_user_id,
        vehicle_plate=data.vehicle_plate,
        vehicle_label=data.vehicle_label,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(route)
    await db.flush()

    for stop_data in data.stops:
        db.add(RouteStop(
            route_id=route.route_id,
            **stop_data.model_dump(),
        ))

    await db.commit()
    await db.refresh(route)
    return route


async def update_route(db: AsyncSession, route_id: int, data: RouteUpdate) -> Route | None:
    route = await get_route(db, route_id)
    if not route:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(route, field, value)
    route.updated_at = _now()
    await db.commit()
    await db.refresh(route)
    return route


async def add_route_stop(
    db: AsyncSession, route_id: int, data: RouteStopCreate
) -> RouteStop:
    stop = RouteStop(route_id=route_id, **data.model_dump())
    db.add(stop)
    await db.commit()
    await db.refresh(stop)
    return stop


async def update_route_stop(
    db: AsyncSession, route_id: int, stop_id: int, data: RouteStopUpdate
) -> RouteStop | None:
    result = await db.execute(
        select(RouteStop).where(
            RouteStop.stop_id == stop_id,
            RouteStop.route_id == route_id,
        )
    )
    stop = result.scalar_one_or_none()
    if not stop:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(stop, field, value)
    stop.updated_at = _now()
    await db.commit()
    await db.refresh(stop)
    return stop
