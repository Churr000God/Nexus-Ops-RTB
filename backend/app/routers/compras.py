"""Router — Módulo de Compras.

Prefijos:
  /api/compras  — solicitudes, órdenes, recepciones, facturas, cadena, catálogos SAT
  /api/gastos   — gastos operativos
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_permission
from app.models.user_model import User
from app.schemas.compras_schema import (
    GoodsReceiptIn,
    GoodsReceiptListItem,
    GoodsReceiptOut,
    OperatingExpenseIn,
    OperatingExpenseOut,
    OperatingExpenseUpdate,
    PurchaseOrderIn,
    PurchaseOrderListItem,
    PurchaseOrderOut,
    PurchaseOrderStatusUpdate,
    PurchaseRequestIn,
    PurchaseRequestListItem,
    PurchaseRequestOut,
    PurchaseRequestStatusUpdate,
    SatPaymentFormOut,
    SatPaymentMethodOut,
    SupplierInvoiceIn,
    SupplierInvoiceListItem,
    SupplierInvoiceOut,
    SupplierInvoicePayUpdate,
)
from app.services import compras_service

router = APIRouter(prefix="/api/compras", tags=["compras"])
gastos_router = APIRouter(prefix="/api/gastos", tags=["gastos"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Catálogos SAT
# ---------------------------------------------------------------------------


@router.get("/sat/formas-pago", response_model=list[SatPaymentFormOut])
async def list_sat_payment_forms(db: DbDep, _: UserDep):
    return await compras_service.get_sat_payment_forms(db)


@router.get("/sat/metodos-pago", response_model=list[SatPaymentMethodOut])
async def list_sat_payment_methods(db: DbDep, _: UserDep):
    return await compras_service.get_sat_payment_methods(db)


# ---------------------------------------------------------------------------
# Purchase Requests — Solicitudes de Material
# ---------------------------------------------------------------------------


@router.get("/solicitudes", response_model=list[PurchaseRequestListItem])
async def list_solicitudes(
    db: DbDep,
    user: UserDep,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _perm=Depends(require_permission("compras.view")),
):
    return await compras_service.list_purchase_requests(db, status=status, limit=limit, offset=offset)


@router.post("/solicitudes", response_model=PurchaseRequestOut, status_code=status.HTTP_201_CREATED)
async def create_solicitud(
    body: PurchaseRequestIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("compras.create")),
):
    return await compras_service.create_purchase_request(db, body, user.id)


@router.get("/solicitudes/{request_id}", response_model=PurchaseRequestOut)
async def get_solicitud(
    request_id: int,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.view")),
):
    pr = await compras_service.get_purchase_request(db, request_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return pr


@router.patch("/solicitudes/{request_id}/status", response_model=PurchaseRequestOut)
async def update_solicitud_status(
    request_id: int,
    body: PurchaseRequestStatusUpdate,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.create")),
):
    pr = await compras_service.update_purchase_request_status(db, request_id, body)
    if not pr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return pr


# ---------------------------------------------------------------------------
# Purchase Orders — Órdenes de Compra
# ---------------------------------------------------------------------------


@router.get("/ordenes", response_model=list[PurchaseOrderListItem])
async def list_ordenes(
    db: DbDep,
    _: UserDep,
    status: str | None = Query(default=None),
    supplier_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _perm=Depends(require_permission("compras.view")),
):
    return await compras_service.list_purchase_orders(
        db, status=status, supplier_id=supplier_id, limit=limit, offset=offset
    )


@router.post("/ordenes", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_orden(
    body: PurchaseOrderIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("compras.create")),
):
    return await compras_service.create_purchase_order(db, body, user.id)


@router.get("/ordenes/{po_id}", response_model=PurchaseOrderOut)
async def get_orden(
    po_id: int,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.view")),
):
    po = await compras_service.get_purchase_order(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
    return po


@router.patch("/ordenes/{po_id}/status", response_model=PurchaseOrderOut)
async def update_orden_status(
    po_id: int,
    body: PurchaseOrderStatusUpdate,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.confirm")),
):
    try:
        po = await compras_service.update_purchase_order_status(db, po_id, body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not po:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
    return po


# ---------------------------------------------------------------------------
# Goods Receipts — Recepciones de Mercancía
# ---------------------------------------------------------------------------


@router.get("/recepciones", response_model=list[GoodsReceiptListItem])
async def list_recepciones(
    db: DbDep,
    _: UserDep,
    po_id: int | None = Query(default=None),
    supplier_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _perm=Depends(require_permission("compras.view")),
):
    return await compras_service.list_goods_receipts(
        db, po_id=po_id, supplier_id=supplier_id, limit=limit, offset=offset
    )


@router.post("/recepciones", response_model=GoodsReceiptOut, status_code=status.HTTP_201_CREATED)
async def create_recepcion(
    body: GoodsReceiptIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("compras.receive")),
):
    try:
        return await compras_service.create_goods_receipt(db, body, user.id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/recepciones/{receipt_id}", response_model=GoodsReceiptOut)
async def get_recepcion(
    receipt_id: int,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.view")),
):
    gr = await compras_service.get_goods_receipt(db, receipt_id)
    if not gr:
        raise HTTPException(status_code=404, detail="Recepción no encontrada")
    return gr


# ---------------------------------------------------------------------------
# Supplier Invoices — Facturas de Proveedor
# ---------------------------------------------------------------------------


@router.get("/facturas", response_model=list[SupplierInvoiceListItem])
async def list_facturas(
    db: DbDep,
    _: UserDep,
    supplier_id: int | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _perm=Depends(require_permission("compras.view")),
):
    return await compras_service.list_supplier_invoices(
        db,
        supplier_id=supplier_id,
        payment_status=payment_status,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.post("/facturas", response_model=SupplierInvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_factura(
    body: SupplierInvoiceIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("compras.invoice")),
):
    return await compras_service.create_supplier_invoice(db, body, user.id)


@router.get("/facturas/{invoice_id}", response_model=SupplierInvoiceOut)
async def get_factura(
    invoice_id: int,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.view")),
):
    inv = await compras_service.get_supplier_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return inv


@router.patch("/facturas/{invoice_id}/pagar", response_model=SupplierInvoiceOut)
async def pagar_factura(
    invoice_id: int,
    body: SupplierInvoicePayUpdate,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("compras.invoice")),
):
    try:
        inv = await compras_service.pay_supplier_invoice(db, invoice_id, body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return inv


# ---------------------------------------------------------------------------
# Vista v_purchase_chain — Trazabilidad completa
# ---------------------------------------------------------------------------


@router.get("/cadena")
async def get_cadena(
    db: DbDep,
    _: UserDep,
    request_number: str | None = Query(default=None),
    po_number: str | None = Query(default=None),
    _perm=Depends(require_permission("compras.view")),
):
    return await compras_service.get_purchase_chain(
        db, request_number=request_number, po_number=po_number
    )


# ---------------------------------------------------------------------------
# Gastos Operativos
# ---------------------------------------------------------------------------


@gastos_router.get("", response_model=list[OperatingExpenseOut])
async def list_gastos(
    db: DbDep,
    _: UserDep,
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    is_deductible: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _perm=Depends(require_permission("gastos.view")),
):
    return await compras_service.list_operating_expenses(
        db, category=category, status=status, is_deductible=is_deductible,
        limit=limit, offset=offset
    )


@gastos_router.post("", response_model=OperatingExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_gasto(
    body: OperatingExpenseIn,
    db: DbDep,
    user: UserDep,
    _perm=Depends(require_permission("gastos.create")),
):
    return await compras_service.create_operating_expense(db, body, user.id)


@gastos_router.get("/{expense_id}", response_model=OperatingExpenseOut)
async def get_gasto(
    expense_id: UUID,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("gastos.view")),
):
    exp = await compras_service.get_operating_expense(db, expense_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return exp


@gastos_router.patch("/{expense_id}", response_model=OperatingExpenseOut)
async def update_gasto(
    expense_id: UUID,
    body: OperatingExpenseUpdate,
    db: DbDep,
    _: UserDep,
    _perm=Depends(require_permission("gastos.create")),
):
    exp = await compras_service.update_operating_expense(db, expense_id, body)
    if not exp:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return exp
