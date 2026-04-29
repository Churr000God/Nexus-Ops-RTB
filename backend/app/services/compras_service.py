"""Service — Módulo de Compras."""

from __future__ import annotations

from datetime import date, timezone, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.compras_models import (
    ComprasGoodsReceipt as GoodsReceipt,
    ComprasGoodsReceiptItem as GoodsReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseRequest,
    PurchaseRequestItem,
    SatPaymentForm,
    SatPaymentMethod,
    SupplierInvoice,
    SupplierInvoiceItem,
)
from app.models.ops_models import OperatingExpense
from app.schemas.compras_schema import (
    GoodsReceiptIn,
    OperatingExpenseIn,
    OperatingExpenseUpdate,
    PurchaseOrderIn,
    PurchaseOrderStatusUpdate,
    PurchaseRequestIn,
    PurchaseRequestStatusUpdate,
    SupplierInvoiceIn,
    SupplierInvoicePayUpdate,
)


# ---------------------------------------------------------------------------
# Catálogos SAT
# ---------------------------------------------------------------------------


async def get_sat_payment_forms(db: AsyncSession) -> list[SatPaymentForm]:
    result = await db.execute(select(SatPaymentForm).where(SatPaymentForm.is_active.is_(True)))
    return list(result.scalars().all())


async def get_sat_payment_methods(db: AsyncSession) -> list[SatPaymentMethod]:
    result = await db.execute(select(SatPaymentMethod).where(SatPaymentMethod.is_active.is_(True)))
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Purchase Requests
# ---------------------------------------------------------------------------


async def list_purchase_requests(
    db: AsyncSession,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[PurchaseRequest]:
    q = select(PurchaseRequest).order_by(PurchaseRequest.request_date.desc())
    if status:
        q = q.where(PurchaseRequest.status == status)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_purchase_request(db: AsyncSession, request_id: int) -> PurchaseRequest | None:
    result = await db.execute(
        select(PurchaseRequest)
        .options(selectinload(PurchaseRequest.items))
        .where(PurchaseRequest.request_id == request_id)
    )
    return result.scalar_one_or_none()


async def create_purchase_request(
    db: AsyncSession, data: PurchaseRequestIn, user_id: UUID | None
) -> PurchaseRequest:
    pr = PurchaseRequest(
        request_number=data.request_number,
        requested_by=user_id,
        request_date=data.request_date,
        status="DRAFT",
        notes=data.notes,
    )
    db.add(pr)
    await db.flush()

    for item in data.items:
        db.add(
            PurchaseRequestItem(
                request_id=pr.request_id,
                line_number=item.line_number,
                item_type=item.item_type,
                product_id=item.product_id,
                service_description=item.service_description,
                unit_of_measure=item.unit_of_measure,
                quantity_requested=item.quantity_requested,
                suggested_supplier_id=item.suggested_supplier_id,
                quote_item_id=item.quote_item_id,
                in_package=item.in_package,
                exception_reason=item.exception_reason,
                notes=item.notes,
            )
        )

    await db.commit()
    await db.refresh(pr)

    result = await db.execute(
        select(PurchaseRequest)
        .options(selectinload(PurchaseRequest.items))
        .where(PurchaseRequest.request_id == pr.request_id)
    )
    return result.scalar_one()


async def update_purchase_request_status(
    db: AsyncSession, request_id: int, data: PurchaseRequestStatusUpdate
) -> PurchaseRequest | None:
    pr = await get_purchase_request(db, request_id)
    if not pr:
        return None
    pr.status = data.status
    pr.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pr)
    result = await db.execute(
        select(PurchaseRequest)
        .options(selectinload(PurchaseRequest.items))
        .where(PurchaseRequest.request_id == request_id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------


async def list_purchase_orders(
    db: AsyncSession,
    status: str | None = None,
    supplier_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[PurchaseOrder]:
    q = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    if status:
        q = q.where(PurchaseOrder.status == status)
    if supplier_id:
        q = q.where(PurchaseOrder.supplier_id == supplier_id)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_purchase_order(db: AsyncSession, po_id: int) -> PurchaseOrder | None:
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.po_id == po_id)
    )
    return result.scalar_one_or_none()


async def create_purchase_order(
    db: AsyncSession, data: PurchaseOrderIn, user_id: UUID | None
) -> PurchaseOrder:
    po = PurchaseOrder(
        po_number=data.po_number,
        supplier_id=data.supplier_id,
        po_type=data.po_type,
        status="DRAFT",
        issue_date=data.issue_date,
        estimated_pickup_date=data.estimated_pickup_date,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        subtotal=data.subtotal,
        tax_amount=data.tax_amount,
        shipping_amount=data.shipping_amount,
        total=data.total,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(po)
    await db.flush()

    for item in data.items:
        db.add(
            PurchaseOrderItem(
                po_id=po.po_id,
                line_number=item.line_number,
                request_item_id=item.request_item_id,
                item_type=item.item_type,
                product_id=item.product_id,
                service_description=item.service_description,
                unit_of_measure=item.unit_of_measure,
                quantity_ordered=item.quantity_ordered,
                unit_cost=item.unit_cost,
                tax_pct=item.tax_pct,
                notes=item.notes,
            )
        )

    await db.commit()
    await db.refresh(po)

    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.po_id == po.po_id)
    )
    return result.scalar_one()


async def update_purchase_order_status(
    db: AsyncSession, po_id: int, data: PurchaseOrderStatusUpdate
) -> PurchaseOrder | None:
    po = await get_purchase_order(db, po_id)
    if not po:
        return None
    po.status = data.status
    if data.status == "CONFIRMED":
        po.is_confirmed = True
        po.confirmation_date = date.today()
    po.updated_at = datetime.now(timezone.utc)
    await db.commit()
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.po_id == po_id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Goods Receipts
# ---------------------------------------------------------------------------


async def list_goods_receipts(
    db: AsyncSession,
    po_id: int | None = None,
    supplier_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[GoodsReceipt]:
    q = select(GoodsReceipt).order_by(GoodsReceipt.receipt_date.desc())
    if po_id:
        q = q.where(GoodsReceipt.po_id == po_id)
    if supplier_id:
        q = q.where(GoodsReceipt.supplier_id == supplier_id)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_goods_receipt(db: AsyncSession, receipt_id: int) -> GoodsReceipt | None:
    result = await db.execute(
        select(GoodsReceipt)
        .options(selectinload(GoodsReceipt.items))
        .where(GoodsReceipt.receipt_id == receipt_id)
    )
    return result.scalar_one_or_none()


async def create_goods_receipt(
    db: AsyncSession, data: GoodsReceiptIn, user_id: UUID | None
) -> GoodsReceipt:
    gr = GoodsReceipt(
        receipt_number=data.receipt_number,
        po_id=data.po_id,
        supplier_id=data.supplier_id,
        receipt_date=data.receipt_date,
        physical_validation=data.physical_validation,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(gr)
    await db.flush()

    for item in data.items:
        db.add(
            GoodsReceiptItem(
                receipt_id=gr.receipt_id,
                po_item_id=item.po_item_id,
                line_number=item.line_number,
                product_id=item.product_id,
                quantity_requested=item.quantity_requested,
                quantity_received=item.quantity_received,
                unit_cost=item.unit_cost,
                notes=item.notes,
            )
        )

    await db.commit()
    await db.refresh(gr)

    result = await db.execute(
        select(GoodsReceipt)
        .options(selectinload(GoodsReceipt.items))
        .where(GoodsReceipt.receipt_id == gr.receipt_id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Supplier Invoices
# ---------------------------------------------------------------------------


async def list_supplier_invoices(
    db: AsyncSession,
    supplier_id: int | None = None,
    payment_status: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SupplierInvoice]:
    q = select(SupplierInvoice).order_by(SupplierInvoice.invoice_date.desc())
    if supplier_id:
        q = q.where(SupplierInvoice.supplier_id == supplier_id)
    if payment_status:
        q = q.where(SupplierInvoice.payment_status == payment_status)
    if status:
        q = q.where(SupplierInvoice.status == status)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_supplier_invoice(db: AsyncSession, invoice_id: int) -> SupplierInvoice | None:
    result = await db.execute(
        select(SupplierInvoice)
        .options(selectinload(SupplierInvoice.items))
        .where(SupplierInvoice.invoice_id == invoice_id)
    )
    return result.scalar_one_or_none()


async def create_supplier_invoice(
    db: AsyncSession, data: SupplierInvoiceIn, user_id: UUID | None
) -> SupplierInvoice:
    inv = SupplierInvoice(
        invoice_number=data.invoice_number,
        supplier_id=data.supplier_id,
        po_id=data.po_id,
        invoice_type=data.invoice_type,
        invoice_date=data.invoice_date,
        received_date=data.received_date,
        status="RECEIVED",
        payment_status="UNPAID",
        sat_payment_form_id=data.sat_payment_form_id,
        sat_payment_method_id=data.sat_payment_method_id,
        uuid_sat=data.uuid_sat,
        subtotal=data.subtotal,
        tax_amount=data.tax_amount,
        shipping_amount=data.shipping_amount,
        discount_amount=data.discount_amount,
        total=data.total,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(inv)
    await db.flush()

    for item in data.items:
        db.add(
            SupplierInvoiceItem(
                invoice_id=inv.invoice_id,
                po_item_id=item.po_item_id,
                receipt_item_id=item.receipt_item_id,
                line_number=item.line_number,
                item_type=item.item_type,
                product_id=item.product_id,
                concept_description=item.concept_description,
                unit_of_measure=item.unit_of_measure,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                tax_pct=item.tax_pct,
                notes=item.notes,
            )
        )

    await db.commit()
    await db.refresh(inv)

    result = await db.execute(
        select(SupplierInvoice)
        .options(selectinload(SupplierInvoice.items))
        .where(SupplierInvoice.invoice_id == inv.invoice_id)
    )
    return result.scalar_one()


async def pay_supplier_invoice(
    db: AsyncSession, invoice_id: int, data: SupplierInvoicePayUpdate
) -> SupplierInvoice | None:
    inv = await get_supplier_invoice(db, invoice_id)
    if not inv:
        return None
    inv.payment_status = "PAID"
    inv.status = "PAID"
    inv.payment_date = data.payment_date
    if data.sat_payment_form_id:
        inv.sat_payment_form_id = data.sat_payment_form_id
    inv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    result = await db.execute(
        select(SupplierInvoice)
        .options(selectinload(SupplierInvoice.items))
        .where(SupplierInvoice.invoice_id == invoice_id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Operating Expenses
# ---------------------------------------------------------------------------


async def list_operating_expenses(
    db: AsyncSession,
    category: str | None = None,
    status: str | None = None,
    is_deductible: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[OperatingExpense]:
    q = select(OperatingExpense).order_by(OperatingExpense.spent_on.desc())
    if category:
        q = q.where(OperatingExpense.category == category)
    if status:
        q = q.where(OperatingExpense.status == status)
    if is_deductible is not None:
        q = q.where(OperatingExpense.is_deductible.is_(is_deductible))
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_operating_expense(db: AsyncSession, expense_id: UUID) -> OperatingExpense | None:
    result = await db.execute(
        select(OperatingExpense).where(OperatingExpense.id == expense_id)
    )
    return result.scalar_one_or_none()


async def create_operating_expense(
    db: AsyncSession, data: OperatingExpenseIn, user_id: UUID | None
) -> OperatingExpense:
    expense = OperatingExpense(
        concept=data.concept,
        category=data.category,
        spent_on=data.expense_date,
        subtotal=data.subtotal,
        supplier_name=data.supplier_name,
        supplier_rfc=data.supplier_rfc,
        invoice_folio=data.invoice_folio,
        is_deductible=data.is_deductible,
        payment_method=data.payment_method,
        status=data.status,
        notes=data.notes,
        created_by_user_id=user_id,
    )
    # Campos SAT extendidos (añadidos por migración 0017)
    if hasattr(expense, "sat_payment_form_id"):
        expense.sat_payment_form_id = data.sat_payment_form_id
    if hasattr(expense, "sat_payment_method_id"):
        expense.sat_payment_method_id = data.sat_payment_method_id
    if hasattr(expense, "uuid_sat"):
        expense.uuid_sat = data.uuid_sat
    if hasattr(expense, "expense_number"):
        expense.expense_number = data.expense_number

    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


async def update_operating_expense(
    db: AsyncSession, expense_id: UUID, data: OperatingExpenseUpdate
) -> OperatingExpense | None:
    expense = await get_operating_expense(db, expense_id)
    if not expense:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "expense_date" in update_data:
        update_data["spent_on"] = update_data.pop("expense_date")

    for field, value in update_data.items():
        if hasattr(expense, field):
            setattr(expense, field, value)

    expense.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(expense)
    return expense


# ---------------------------------------------------------------------------
# Vista v_purchase_chain
# ---------------------------------------------------------------------------


async def get_purchase_chain(
    db: AsyncSession,
    request_number: str | None = None,
    po_number: str | None = None,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM v_purchase_chain WHERE 1=1"
    params: dict[str, Any] = {}

    if request_number:
        sql += " AND request_number = :request_number"
        params["request_number"] = request_number
    if po_number:
        sql += " AND po_number = :po_number"
        params["po_number"] = po_number

    sql += " ORDER BY request_number, pri_line"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [dict(r) for r in rows]
