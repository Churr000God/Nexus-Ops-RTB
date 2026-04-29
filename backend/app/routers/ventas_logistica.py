"""Router — Módulo Ventas y Logística.

Prefijo: /api/ventas-logistica
"""

from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_permission
from app.models.user_model import User
from app.schemas.ventas_logistica_schema import (
    CarrierCreate,
    CarrierResponse,
    CarrierUpdate,
    CFDICancelRequest,
    CFDICancellationRow,
    CFDICreate,
    CFDIResponse,
    DeliveryNoteCreate,
    DeliveryNoteResponse,
    DeliveryNoteUpdate,
    IncompleteOrderRow,
    OrderItemPackUpdate,
    OrderItemResponse,
    OrderMilestoneResponse,
    OrderPaymentStatusRow,
    OrderPackingProgressRow,
    OrderResponse,
    OrderUpdate,
    PaymentApplicationCreate,
    PaymentApplicationResponse,
    PaymentCreate,
    PaymentResponse,
    QuoteApprove,
    QuoteCreate,
    QuoteLinkDeliveryNotes,
    QuoteReject,
    QuoteResponse,
    QuoteUpdate,
    RouteCreate,
    RouteResponse,
    RouteStopCreate,
    RouteStopResponse,
    RouteStopUpdate,
    RouteUpdate,
    ShipmentCreate,
    ShipmentDeliverRequest,
    ShipmentOverviewRow,
    ShipmentResponse,
    ShipmentUpdate,
    TrackingEventCreate,
    TrackingEventResponse,
)
from app.services import ventas_logistica_service as svc

router = APIRouter(prefix="/api/ventas-logistica", tags=["Ventas & Logística"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


# ─────────────────────────────────────────────────────────────────────────────
# Carriers
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/carriers", response_model=list[CarrierResponse])
async def list_carriers(
    db: DbDep,
    _: UserDep,
    active_only: bool = Query(default=True),
):
    return await svc.list_carriers(db, active_only)


@router.get("/carriers/{carrier_id}", response_model=CarrierResponse)
async def get_carrier(carrier_id: int, db: DbDep, _: UserDep):
    carrier = await svc.get_carrier(db, carrier_id)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")
    return carrier


@router.post("/carriers", response_model=CarrierResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("route.manage"))])
async def create_carrier(data: CarrierCreate, db: DbDep, _: UserDep):
    return await svc.create_carrier(db, data)


@router.patch("/carriers/{carrier_id}", response_model=CarrierResponse,
              dependencies=[Depends(require_permission("route.manage"))])
async def update_carrier(carrier_id: int, data: CarrierUpdate, db: DbDep, _: UserDep):
    result = await svc.update_carrier(db, carrier_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")
    return result


@router.delete("/carriers/{carrier_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_permission("route.manage"))])
async def delete_carrier(carrier_id: int, db: DbDep, _: UserDep):
    if not await svc.delete_carrier(db, carrier_id):
        raise HTTPException(status_code=404, detail="Carrier no encontrado")


# ─────────────────────────────────────────────────────────────────────────────
# Delivery Notes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/delivery-notes", response_model=list[DeliveryNoteResponse],
            dependencies=[Depends(require_permission("delivery_note.manage"))])
async def list_delivery_notes(
    db: DbDep,
    _: UserDep,
    customer_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_delivery_notes(db, customer_id, status, limit, offset)


@router.get("/delivery-notes/{note_id}", response_model=DeliveryNoteResponse,
            dependencies=[Depends(require_permission("delivery_note.manage"))])
async def get_delivery_note(note_id: int, db: DbDep, _: UserDep):
    note = await svc.get_delivery_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Nota de remisión no encontrada")
    return note


@router.post("/delivery-notes", response_model=DeliveryNoteResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("delivery_note.create"))])
async def create_delivery_note(data: DeliveryNoteCreate, db: DbDep, user: UserDep):
    return await svc.create_delivery_note(db, data, user.id)


@router.patch("/delivery-notes/{note_id}", response_model=DeliveryNoteResponse,
              dependencies=[Depends(require_permission("delivery_note.manage"))])
async def update_delivery_note(note_id: int, data: DeliveryNoteUpdate, db: DbDep, _: UserDep):
    result = await svc.update_delivery_note(db, note_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Nota de remisión no encontrada")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Quotes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/quotes", response_model=list[QuoteResponse],
            dependencies=[Depends(require_permission("quote.view"))])
async def list_quotes(
    db: DbDep,
    _: UserDep,
    customer_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_quotes(db, customer_id, status, limit, offset)


@router.get("/quotes/{quote_id}", response_model=QuoteResponse,
            dependencies=[Depends(require_permission("quote.view"))])
async def get_quote(quote_id: int, db: DbDep, _: UserDep):
    quote = await svc.get_quote(db, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return quote


@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("quote.create"))])
async def create_quote(data: QuoteCreate, db: DbDep, user: UserDep):
    return await svc.create_quote(db, data, user.id)


@router.patch("/quotes/{quote_id}", response_model=QuoteResponse,
              dependencies=[Depends(require_permission("quote.edit"))])
async def update_quote(quote_id: int, data: QuoteUpdate, db: DbDep, _: UserDep):
    result = await svc.update_quote(db, quote_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return result


@router.post("/quotes/{quote_id}/approve", response_model=QuoteResponse,
             dependencies=[Depends(require_permission("quote.approve"))])
async def approve_quote(quote_id: int, data: QuoteApprove, db: DbDep, user: UserDep):
    result = await svc.approve_quote(db, quote_id, user.id, data)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Cotización no encontrada o no está en estado aprobable",
        )
    return result


@router.post("/quotes/{quote_id}/reject", response_model=QuoteResponse,
             dependencies=[Depends(require_permission("quote.approve"))])
async def reject_quote(quote_id: int, data: QuoteReject, db: DbDep, user: UserDep):
    result = await svc.reject_quote(db, quote_id, user.id, data)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Cotización no encontrada o no está en estado rechazable",
        )
    return result


@router.post("/quotes/{quote_id}/link-delivery-notes", response_model=QuoteResponse,
             dependencies=[Depends(require_permission("delivery_note.invoice"))])
async def link_delivery_notes(quote_id: int, data: QuoteLinkDeliveryNotes, db: DbDep, user: UserDep):
    result = await svc.link_delivery_notes_to_quote(db, quote_id, user.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Orders
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=list[OrderResponse],
            dependencies=[Depends(require_permission("order.view"))])
async def list_orders(
    db: DbDep,
    _: UserDep,
    customer_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    packing_status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_orders(db, customer_id, status, packing_status, limit, offset)


@router.get("/orders/incomplete", response_model=list[IncompleteOrderRow],
            dependencies=[Depends(require_permission("order.view"))])
async def incomplete_orders(db: DbDep, _: UserDep):
    return await svc.list_incomplete_orders(db)


@router.get("/orders/{order_id}", response_model=OrderResponse,
            dependencies=[Depends(require_permission("order.view"))])
async def get_order(order_id: int, db: DbDep, _: UserDep):
    order = await svc.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return order


@router.patch("/orders/{order_id}", response_model=OrderResponse,
              dependencies=[Depends(require_permission("order.manage"))])
async def update_order(order_id: int, data: OrderUpdate, db: DbDep, _: UserDep):
    result = await svc.update_order(db, order_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return result


@router.patch("/orders/{order_id}/items/{item_id}/pack", response_model=OrderItemResponse,
              dependencies=[Depends(require_permission("order.pack"))])
async def pack_item(order_id: int, item_id: int, data: OrderItemPackUpdate, db: DbDep, user: UserDep):
    result = await svc.pack_order_item(db, order_id, item_id, data, user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Partida no encontrada o cantidad inválida")
    return result


@router.get("/orders/{order_id}/packing-progress", response_model=OrderPackingProgressRow,
            dependencies=[Depends(require_permission("order.view"))])
async def packing_progress(order_id: int, db: DbDep, _: UserDep):
    result = await svc.get_order_packing_progress(db, order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return result


@router.get("/orders/{order_id}/payment-status", response_model=OrderPaymentStatusRow,
            dependencies=[Depends(require_permission("order.view"))])
async def payment_status(order_id: int, db: DbDep, _: UserDep):
    result = await svc.get_order_payment_status(db, order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# CFDI
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/cfdi", response_model=list[CFDIResponse],
            dependencies=[Depends(require_permission("cfdi.issue"))])
async def list_cfdi(
    db: DbDep,
    _: UserDep,
    customer_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_cfdi(db, customer_id, status, limit, offset)


@router.get("/cfdi/cancellations", response_model=list[CFDICancellationRow],
            dependencies=[Depends(require_permission("cfdi.cancel"))])
async def cfdi_cancellations(
    db: DbDep,
    _: UserDep,
    days: int = Query(default=30, ge=1, le=365),
):
    return await svc.list_cfdi_cancellations(db, days)


@router.get("/cfdi/{cfdi_id}", response_model=CFDIResponse,
            dependencies=[Depends(require_permission("cfdi.issue"))])
async def get_cfdi(cfdi_id: int, db: DbDep, _: UserDep):
    cfdi = await svc.get_cfdi(db, cfdi_id)
    if not cfdi:
        raise HTTPException(status_code=404, detail="CFDI no encontrado")
    return cfdi


@router.post("/cfdi", response_model=CFDIResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("cfdi.issue"))])
async def create_cfdi(data: CFDICreate, db: DbDep, user: UserDep):
    return await svc.create_cfdi(db, data, user.id)


@router.post("/cfdi/{cfdi_id}/cancel", response_model=CFDIResponse,
             dependencies=[Depends(require_permission("cfdi.cancel"))])
async def cancel_cfdi(cfdi_id: int, data: CFDICancelRequest, db: DbDep, user: UserDep):
    result = await svc.cancel_cfdi(db, cfdi_id, data, user.id)
    if not result:
        raise HTTPException(status_code=400, detail="CFDI no encontrado o no está en estado ISSUED")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Payments
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/payments", response_model=list[PaymentResponse],
            dependencies=[Depends(require_permission("payment.register"))])
async def list_payments(
    db: DbDep,
    _: UserDep,
    customer_id: int | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_payments(db, customer_id, limit, offset)


@router.get("/payments/{payment_id}", response_model=PaymentResponse,
            dependencies=[Depends(require_permission("payment.register"))])
async def get_payment(payment_id: int, db: DbDep, _: UserDep):
    payment = await svc.get_payment(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return payment


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("payment.register"))])
async def create_payment(data: PaymentCreate, db: DbDep, user: UserDep):
    return await svc.create_payment(db, data, user.id)


@router.post("/payments/{payment_id}/apply", response_model=PaymentApplicationResponse,
             dependencies=[Depends(require_permission("payment.register"))])
async def apply_payment(payment_id: int, data: PaymentApplicationCreate, db: DbDep, user: UserDep):
    result = await svc.apply_payment(db, payment_id, data, user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Pago no encontrado o cancelado")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Shipments
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/shipments", response_model=list[ShipmentResponse],
            dependencies=[Depends(require_permission("shipment.manage"))])
async def list_shipments(
    db: DbDep,
    _: UserDep,
    order_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_shipments(db, order_id, status, limit, offset)


@router.get("/shipments/overview", response_model=list[ShipmentOverviewRow],
            dependencies=[Depends(require_permission("shipment.manage"))])
async def shipments_overview(db: DbDep, _: UserDep):
    return await svc.list_shipments_overview(db)


@router.get("/shipments/{shipment_id}", response_model=ShipmentResponse,
            dependencies=[Depends(require_permission("shipment.manage"))])
async def get_shipment(shipment_id: int, db: DbDep, _: UserDep):
    shipment = await svc.get_shipment(db, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return shipment


@router.post("/shipments", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("shipment.create"))])
async def create_shipment(data: ShipmentCreate, db: DbDep, user: UserDep):
    return await svc.create_shipment(db, data, user.id)


@router.patch("/shipments/{shipment_id}", response_model=ShipmentResponse,
              dependencies=[Depends(require_permission("shipment.manage"))])
async def update_shipment(shipment_id: int, data: ShipmentUpdate, db: DbDep, _: UserDep):
    result = await svc.update_shipment(db, shipment_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return result


@router.post("/shipments/{shipment_id}/deliver", response_model=ShipmentResponse,
             dependencies=[Depends(require_permission("order.deliver"))])
async def deliver_shipment(shipment_id: int, data: ShipmentDeliverRequest, db: DbDep, user: UserDep):
    result = await svc.deliver_shipment(db, shipment_id, data, user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Envío no encontrado o ya entregado")
    return result


@router.post("/shipments/{shipment_id}/tracking-events", response_model=TrackingEventResponse,
             dependencies=[Depends(require_permission("shipment.track.update"))])
async def add_tracking_event(
    shipment_id: int, data: TrackingEventCreate, db: DbDep, user: UserDep
):
    return await svc.add_tracking_event(db, shipment_id, data, user.id)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/routes", response_model=list[RouteResponse],
            dependencies=[Depends(require_permission("route.manage"))])
async def list_routes(
    db: DbDep,
    _: UserDep,
    route_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_routes(db, route_date, status, limit, offset)


@router.get("/routes/{route_id}", response_model=RouteResponse,
            dependencies=[Depends(require_permission("route.manage"))])
async def get_route(route_id: int, db: DbDep, _: UserDep):
    route = await svc.get_route(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    return route


@router.post("/routes", response_model=RouteResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("route.create"))])
async def create_route(data: RouteCreate, db: DbDep, user: UserDep):
    return await svc.create_route(db, data, user.id)


@router.patch("/routes/{route_id}", response_model=RouteResponse,
              dependencies=[Depends(require_permission("route.manage"))])
async def update_route(route_id: int, data: RouteUpdate, db: DbDep, _: UserDep):
    result = await svc.update_route(db, route_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    return result


@router.post("/routes/{route_id}/stops", response_model=RouteStopResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("route.manage"))])
async def add_stop(route_id: int, data: RouteStopCreate, db: DbDep, _: UserDep):
    return await svc.add_route_stop(db, route_id, data)


@router.patch("/routes/{route_id}/stops/{stop_id}", response_model=RouteStopResponse,
              dependencies=[Depends(require_permission("route.execute"))])
async def update_stop(route_id: int, stop_id: int, data: RouteStopUpdate, db: DbDep, _: UserDep):
    result = await svc.update_route_stop(db, route_id, stop_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Parada no encontrada")
    return result
