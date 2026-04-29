"""Router — Módulo de Reportes y Analytics (Módulo 15).

Todos los endpoints son de solo lectura y requieren permiso report.view.
La lógica analítica vive en las vistas SQL; este router solo orquesta.

Prefijo: /api/analytics
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_permission
from app.models.user_model import User
from app.schemas.analytics_schema import (
    AccountsPayableRow,
    AccountsReceivableRow,
    CashFlowRow,
    CategoryMarginRow,
    CfdiEmittedRow,
    CfdiSummaryByPeriodRow,
    CustomerProfitabilityRow,
    ExecutiveDashboard,
    ExpensesByCategoryRow,
    NcBySupplierRow,
    PaymentUnappliedRow,
    ProductMarginRow,
    QuoteConversionRow,
    RouteEfficiencyRow,
    SalesByPeriodRow,
    SalesRepRow,
    SupplierInvoicesAgingRow,
    SupplierPerformanceRow,
    TopCustomerRow,
    TopSupplierRow,
    WarehouseKpis,
)
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]
ReportPerm = Depends(require_permission("report.view"))


# ---------------------------------------------------------------------------
# Ejecutivo
# ---------------------------------------------------------------------------


@router.get("/ejecutivo", response_model=ExecutiveDashboard)
async def get_ejecutivo(db: DbDep, _: UserDep, __=ReportPerm):
    """KPIs unificados para dirección general."""
    data = await analytics_service.get_executive_dashboard(db)
    if data is None:
        raise HTTPException(status_code=503, detail="Sin datos en el dashboard ejecutivo")
    return data


# ---------------------------------------------------------------------------
# Comercial
# ---------------------------------------------------------------------------


@router.get("/ventas/por-periodo", response_model=list[SalesByPeriodRow])
async def get_ventas_por_periodo(
    db: DbDep,
    _: UserDep,
    year: int | None = Query(default=None, ge=2020, le=2100),
    __=ReportPerm,
):
    """Ventas por mes / trimestre / año."""
    return await analytics_service.get_sales_by_period(db, year=year)


@router.get("/ventas/top-clientes", response_model=list[TopCustomerRow])
async def get_top_clientes(
    db: DbDep,
    _: UserDep,
    limit: int = Query(default=20, ge=1, le=100),
    __=ReportPerm,
):
    """Ranking de clientes por revenue."""
    return await analytics_service.get_top_customers(db, limit=limit)


@router.get("/ventas/conversion", response_model=list[QuoteConversionRow])
async def get_conversion_cotizaciones(
    db: DbDep,
    _: UserDep,
    year: int | None = Query(default=None, ge=2020, le=2100),
    __=ReportPerm,
):
    """Tasa de conversión de cotizaciones por mes."""
    return await analytics_service.get_quote_conversion(db, year=year)


@router.get("/ventas/por-vendedor", response_model=list[SalesRepRow])
async def get_ventas_por_vendedor(db: DbDep, _: UserDep, __=ReportPerm):
    """Performance por vendedor: cotizaciones, conversión, revenue."""
    return await analytics_service.get_sales_rep_performance(db)


# ---------------------------------------------------------------------------
# Margen
# ---------------------------------------------------------------------------


@router.get("/margen/productos", response_model=list[ProductMarginRow])
async def get_margen_productos(db: DbDep, _: UserDep, __=ReportPerm):
    """Margen por producto vendido."""
    return await analytics_service.get_product_margin(db)


@router.get("/margen/clientes", response_model=list[CustomerProfitabilityRow])
async def get_margen_clientes(
    db: DbDep,
    _: UserDep,
    limit: int = Query(default=30, ge=1, le=200),
    __=ReportPerm,
):
    """Rentabilidad por cliente."""
    return await analytics_service.get_customer_profitability(db, limit=limit)


@router.get("/margen/categorias", response_model=list[CategoryMarginRow])
async def get_margen_categorias(db: DbDep, _: UserDep, __=ReportPerm):
    """Margen por categoría vs target."""
    return await analytics_service.get_category_margin(db)


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------


@router.get("/compras/top-proveedores", response_model=list[TopSupplierRow])
async def get_top_proveedores(
    db: DbDep,
    _: UserDep,
    limit: int = Query(default=20, ge=1, le=100),
    __=ReportPerm,
):
    """Ranking de proveedores por monto comprado."""
    return await analytics_service.get_top_suppliers(db, limit=limit)


@router.get("/compras/desempeno-proveedores", response_model=list[SupplierPerformanceRow])
async def get_desempeno_proveedores(db: DbDep, _: UserDep, __=ReportPerm):
    """Lead time real vs estimado, % cumplimiento por proveedor."""
    return await analytics_service.get_supplier_performance(db)


@router.get("/compras/aging-facturas", response_model=list[SupplierInvoicesAgingRow])
async def get_aging_facturas_proveedor(db: DbDep, _: UserDep, __=ReportPerm):
    """Facturas de proveedor pendientes clasificadas por antigüedad."""
    return await analytics_service.get_supplier_invoices_aging(db)


# ---------------------------------------------------------------------------
# Financiero
# ---------------------------------------------------------------------------


@router.get("/financiero/cuentas-por-cobrar", response_model=list[AccountsReceivableRow])
async def get_cuentas_por_cobrar(db: DbDep, _: UserDep, __=ReportPerm):
    """AR aging: cuentas por cobrar segmentadas por antigüedad."""
    return await analytics_service.get_accounts_receivable(db)


@router.get("/financiero/cuentas-por-pagar", response_model=list[AccountsPayableRow])
async def get_cuentas_por_pagar(db: DbDep, _: UserDep, __=ReportPerm):
    """AP aging: cuentas por pagar por proveedor."""
    return await analytics_service.get_accounts_payable(db)


@router.get("/financiero/flujo-caja", response_model=list[CashFlowRow])
async def get_flujo_caja(db: DbDep, _: UserDep, __=ReportPerm):
    """Proyección de flujo de caja (próximos 90 días)."""
    return await analytics_service.get_cash_flow_projection(db)


@router.get("/financiero/gastos", response_model=list[ExpensesByCategoryRow])
async def get_gastos_por_categoria(
    db: DbDep,
    _: UserDep,
    year: int | None = Query(default=None, ge=2020, le=2100),
    __=ReportPerm,
):
    """Gastos operativos por categoría y mes."""
    return await analytics_service.get_expenses_by_category(db, year=year)


@router.get("/financiero/cfdi-emitidos", response_model=list[CfdiEmittedRow])
async def get_cfdi_emitidos(
    db: DbDep,
    _: UserDep,
    year: int | None = Query(default=None, ge=2020, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    __=ReportPerm,
):
    """Catálogo de CFDIs emitidos con saldos y relaciones."""
    return await analytics_service.get_cfdi_emitted(db, year=year, month=month)


@router.get("/financiero/cfdi-por-periodo", response_model=list[CfdiSummaryByPeriodRow])
async def get_cfdi_por_periodo(
    db: DbDep,
    _: UserDep,
    year: int | None = Query(default=None, ge=2020, le=2100),
    __=ReportPerm,
):
    """Resumen de facturación por período."""
    return await analytics_service.get_cfdi_summary_by_period(db, year=year)


@router.get("/financiero/pagos-sin-aplicar", response_model=list[PaymentUnappliedRow])
async def get_pagos_sin_aplicar(db: DbDep, _: UserDep, __=ReportPerm):
    """Pagos recibidos con saldo sin aplicar a pedidos."""
    return await analytics_service.get_payments_unapplied(db)


# ---------------------------------------------------------------------------
# Operación
# ---------------------------------------------------------------------------


@router.get("/operacion/almacen-kpis", response_model=WarehouseKpis)
async def get_almacen_kpis(db: DbDep, _: UserDep, __=ReportPerm):
    """KPIs de almacén: stock, movimientos del mes, pedidos activos."""
    data = await analytics_service.get_warehouse_kpis(db)
    if data is None:
        raise HTTPException(status_code=503, detail="Sin datos de KPIs de almacén")
    return data


@router.get("/operacion/ncs-proveedor", response_model=list[NcBySupplierRow])
async def get_ncs_por_proveedor(db: DbDep, _: UserDep, __=ReportPerm):
    """No conformidades por proveedor (últimos 90 días)."""
    return await analytics_service.get_nc_by_supplier(db)


@router.get("/operacion/rutas", response_model=list[RouteEfficiencyRow])
async def get_eficiencia_rutas(
    db: DbDep,
    _: UserDep,
    limit: int = Query(default=50, ge=1, le=200),
    __=ReportPerm,
):
    """Eficiencia de rutas de entrega: paradas, duración, % completado."""
    return await analytics_service.get_route_efficiency(db, limit=limit)
