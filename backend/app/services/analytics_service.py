"""Service — Módulo de Reportes y Analytics (Módulo 15).

Toda la lógica analítica vive en vistas SQL; este service solo ejecuta
SELECT sobre esas vistas y devuelve los datos como dicts.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _fetch_all(db: AsyncSession, sql: str, params: dict | None = None) -> list[dict]:
    result = await db.execute(text(sql), params or {})
    return [dict(r) for r in result.mappings()]


async def _fetch_one(db: AsyncSession, sql: str, params: dict | None = None) -> dict | None:
    result = await db.execute(text(sql), params or {})
    row = result.mappings().one_or_none()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Ejecutivo
# ---------------------------------------------------------------------------

async def get_executive_dashboard(db: AsyncSession) -> dict | None:
    return await _fetch_one(db, "SELECT * FROM v_executive_dashboard")


# ---------------------------------------------------------------------------
# Comercial
# ---------------------------------------------------------------------------

async def get_sales_by_period(db: AsyncSession, year: int | None = None) -> list[dict]:
    if year:
        return await _fetch_all(
            db,
            "SELECT * FROM v_sales_by_period WHERE year = :year ORDER BY month DESC",
            {"year": year},
        )
    return await _fetch_all(db, "SELECT * FROM v_sales_by_period")


async def get_top_customers(db: AsyncSession, limit: int = 20) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_top_customers LIMIT :lim",
        {"lim": limit},
    )


async def get_quote_conversion(db: AsyncSession, year: int | None = None) -> list[dict]:
    if year:
        return await _fetch_all(
            db,
            "SELECT * FROM v_quote_conversion WHERE year = :year ORDER BY month DESC",
            {"year": year},
        )
    return await _fetch_all(db, "SELECT * FROM v_quote_conversion")


async def get_sales_rep_performance(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_sales_rep_performance")


# ---------------------------------------------------------------------------
# Margen
# ---------------------------------------------------------------------------

async def get_product_margin(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_product_margin ORDER BY revenue DESC NULLS LAST")


async def get_customer_profitability(db: AsyncSession, limit: int = 30) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_customer_profitability LIMIT :lim",
        {"lim": limit},
    )


async def get_category_margin(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_category_margin")


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------

async def get_top_suppliers(db: AsyncSession, limit: int = 20) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_top_suppliers LIMIT :lim",
        {"lim": limit},
    )


async def get_supplier_performance(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_supplier_performance")


async def get_supplier_invoices_aging(db: AsyncSession) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_supplier_invoices_aging WHERE aging_bucket <> 'PAID' ORDER BY days_overdue DESC",
    )


# ---------------------------------------------------------------------------
# Financiero
# ---------------------------------------------------------------------------

async def get_accounts_receivable(db: AsyncSession) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_accounts_receivable WHERE outstanding > 0 ORDER BY outstanding DESC",
    )


async def get_accounts_payable(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_accounts_payable ORDER BY outstanding DESC")


async def get_cash_flow_projection(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_cash_flow_projection")


async def get_expenses_by_category(db: AsyncSession, year: int | None = None) -> list[dict]:
    if year:
        return await _fetch_all(
            db,
            "SELECT * FROM v_expenses_by_category WHERE year = :year ORDER BY month DESC, total DESC",
            {"year": year},
        )
    return await _fetch_all(db, "SELECT * FROM v_expenses_by_category")


# ---------------------------------------------------------------------------
# CFDI
# ---------------------------------------------------------------------------

async def get_cfdi_emitted(
    db: AsyncSession,
    year: int | None = None,
    month: int | None = None,
) -> list[dict]:
    if year and month:
        return await _fetch_all(
            db,
            "SELECT * FROM v_cfdi_emitted"
            " WHERE EXTRACT(YEAR FROM issue_date) = :year"
            "   AND EXTRACT(MONTH FROM issue_date) = :month"
            " ORDER BY issue_date DESC",
            {"year": year, "month": month},
        )
    if year:
        return await _fetch_all(
            db,
            "SELECT * FROM v_cfdi_emitted"
            " WHERE EXTRACT(YEAR FROM issue_date) = :year"
            " ORDER BY issue_date DESC",
            {"year": year},
        )
    return await _fetch_all(db, "SELECT * FROM v_cfdi_emitted ORDER BY issue_date DESC LIMIT 200")


async def get_cfdi_summary_by_period(db: AsyncSession, year: int | None = None) -> list[dict]:
    if year:
        return await _fetch_all(
            db,
            "SELECT * FROM v_cfdi_summary_by_period WHERE year = :year ORDER BY month DESC",
            {"year": year},
        )
    return await _fetch_all(db, "SELECT * FROM v_cfdi_summary_by_period")


async def get_payments_unapplied(db: AsyncSession) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_payments_unapplied ORDER BY amount_unapplied DESC",
    )


# ---------------------------------------------------------------------------
# Operación
# ---------------------------------------------------------------------------

async def get_warehouse_kpis(db: AsyncSession) -> dict | None:
    return await _fetch_one(db, "SELECT * FROM v_warehouse_kpis")


async def get_nc_by_supplier(db: AsyncSession) -> list[dict]:
    return await _fetch_all(db, "SELECT * FROM v_nc_by_supplier")


async def get_route_efficiency(
    db: AsyncSession,
    limit: int = 50,
) -> list[dict]:
    return await _fetch_all(
        db,
        "SELECT * FROM v_route_efficiency ORDER BY route_date DESC LIMIT :lim",
        {"lim": limit},
    )
