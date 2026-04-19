from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import Select, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_models import (
    CancelledQuote,
    Customer,
    Product,
    Quote,
    QuoteItem,
    Sale,
)
from app.schemas.venta_schema import (
    ApprovedVsCancelledByMonthResponse,
    DashboardOverviewResponse,
    GrossMarginByProductResponse,
    SaleResponse,
    SalesByCustomerResponse,
    SalesByMonthResponse,
)


def _date_range_to_datetimes(
    start_date: date | None, end_date: date | None
) -> tuple[datetime | None, datetime | None]:
    start_dt = (
        datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        if start_date is not None
        else None
    )
    end_dt = (
        datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        if end_date is not None
        else None
    )
    return start_dt, end_dt


def _apply_sold_on_filter(
    stmt: Select,
    start_date: date | None,
    end_date: date | None,
) -> Select:
    start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
    if start_dt is not None:
        stmt = stmt.where(Sale.sold_on >= start_dt)
    if end_dt is not None:
        stmt = stmt.where(Sale.sold_on < end_dt)
    return stmt


def _apply_approved_on_filter(
    stmt: Select,
    start_date: date | None,
    end_date: date | None,
) -> Select:
    if start_date is not None:
        stmt = stmt.where(
            Quote.approved_on
            >= datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        )
    if end_date is not None:
        stmt = stmt.where(
            Quote.approved_on
            < datetime.combine(
                end_date + timedelta(days=1), time.min, tzinfo=timezone.utc
            )
        )
    return stmt


def _apply_cancelled_on_filter(
    stmt: Select,
    start_date: date | None,
    end_date: date | None,
) -> Select:
    if start_date is not None:
        stmt = stmt.where(CancelledQuote.cancelled_on >= start_date)
    if end_date is not None:
        stmt = stmt.where(CancelledQuote.cancelled_on <= end_date)
    return stmt


def _to_float(value: object | None) -> float:
    if value is None:
        return 0.0
    return float(value)


class VentasService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_sales(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
        offset: int,
    ) -> list[SaleResponse]:
        stmt = (
            select(Sale, Customer.name)
            .outerjoin(Customer, Customer.id == Sale.customer_id)
            .order_by(Sale.sold_on.desc().nullslast(), Sale.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        stmt = _apply_sold_on_filter(stmt, start_date, end_date)
        rows: Sequence[tuple[Sale, str | None]] = (await self.db.execute(stmt)).all()
        results: list[SaleResponse] = []
        for sale, customer_name in rows:
            results.append(
                SaleResponse(
                    id=sale.id,
                    name=sale.name,
                    sold_on=sale.sold_on,
                    customer_name=customer_name,
                    status=sale.status,
                    subtotal=float(sale.subtotal)
                    if sale.subtotal is not None
                    else None,
                    total=float(sale.total) if sale.total is not None else None,
                    purchase_cost=float(sale.purchase_cost)
                    if sale.purchase_cost is not None
                    else None,
                    gross_margin=float(sale.gross_margin)
                    if sale.gross_margin is not None
                    else None,
                    margin_percent=float(sale.margin_percent)
                    if sale.margin_percent is not None
                    else None,
                    year_month=sale.year_month,
                )
            )
        return results

    async def sales_by_month(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[SalesByMonthResponse]:
        month_key = func.coalesce(
            Sale.year_month, func.to_char(Sale.sold_on, "YYYY-MM")
        )
        stmt = select(
            month_key.label("year_month"),
            func.count(Sale.id).label("sale_count"),
            func.coalesce(func.sum(Sale.total), 0).label("total_revenue"),
            func.coalesce(func.sum(Sale.gross_margin), 0).label("total_gross_margin"),
        ).group_by(month_key)
        stmt = _apply_sold_on_filter(stmt, start_date, end_date).order_by(
            month_key.asc()
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            SalesByMonthResponse(
                year_month=row.year_month,
                sale_count=int(row.sale_count),
                total_revenue=_to_float(row.total_revenue),
                total_gross_margin=_to_float(row.total_gross_margin),
            )
            for row in rows
            if row.year_month is not None
        ]

    async def sales_by_customer(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
    ) -> list[SalesByCustomerResponse]:
        customer_key = func.coalesce(
            Customer.name, Sale.external_customer_id, literal("Sin cliente")
        )
        stmt = (
            select(
                customer_key.label("customer"),
                func.count(Sale.id).label("sale_count"),
                func.coalesce(func.sum(Sale.total), 0).label("total_revenue"),
            )
            .outerjoin(Customer, Customer.id == Sale.customer_id)
            .group_by(customer_key)
            .order_by(func.coalesce(func.sum(Sale.total), 0).desc())
            .limit(limit)
        )
        stmt = _apply_sold_on_filter(stmt, start_date, end_date)
        rows = (await self.db.execute(stmt)).all()
        results: list[SalesByCustomerResponse] = []
        for row in rows:
            sale_count = int(row.sale_count)
            total_revenue = _to_float(row.total_revenue)
            avg_ticket = total_revenue / sale_count if sale_count > 0 else 0.0
            results.append(
                SalesByCustomerResponse(
                    customer=row.customer,
                    sale_count=sale_count,
                    total_revenue=total_revenue,
                    average_ticket=avg_ticket,
                )
            )
        return results

    async def gross_margin_by_product(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
    ) -> list[GrossMarginByProductResponse]:
        product_key = func.coalesce(
            Product.name, QuoteItem.sku, literal("Sin producto")
        )
        stmt = (
            select(
                product_key.label("product"),
                QuoteItem.sku.label("sku"),
                func.coalesce(func.sum(QuoteItem.qty_packed), 0).label("qty"),
                func.coalesce(func.sum(QuoteItem.subtotal), 0).label("revenue"),
                func.coalesce(func.sum(QuoteItem.purchase_subtotal), 0).label("cost"),
            )
            .select_from(QuoteItem)
            .join(Quote, Quote.id == QuoteItem.quote_id)
            .outerjoin(Product, Product.id == QuoteItem.product_id)
            .where(Quote.approved_on.is_not(None))
            .group_by(product_key, QuoteItem.sku)
            .order_by(func.coalesce(func.sum(QuoteItem.subtotal), 0).desc())
            .limit(limit)
        )
        stmt = _apply_approved_on_filter(stmt, start_date, end_date)
        rows = (await self.db.execute(stmt)).all()
        results: list[GrossMarginByProductResponse] = []
        for row in rows:
            revenue = _to_float(row.revenue)
            cost = _to_float(row.cost)
            gross_margin = revenue - cost
            margin_percent = (gross_margin / revenue * 100.0) if revenue > 0 else None
            results.append(
                GrossMarginByProductResponse(
                    product=row.product,
                    sku=row.sku,
                    qty=_to_float(row.qty),
                    revenue=revenue,
                    cost=cost,
                    gross_margin=gross_margin,
                    margin_percent=margin_percent,
                )
            )
        return results

    async def approved_vs_cancelled_by_month(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[ApprovedVsCancelledByMonthResponse]:
        approved_month = func.to_char(Quote.approved_on, "YYYY-MM")
        approved_stmt = (
            select(
                approved_month.label("year_month"),
                func.count(Quote.id).label("approved_count"),
            )
            .where(Quote.approved_on.is_not(None))
            .group_by(approved_month)
        )
        approved_stmt = _apply_approved_on_filter(approved_stmt, start_date, end_date)
        approved_rows = (await self.db.execute(approved_stmt)).all()

        cancelled_month = func.to_char(CancelledQuote.cancelled_on, "YYYY-MM")
        cancelled_stmt = select(
            cancelled_month.label("year_month"),
            func.count(CancelledQuote.id).label("cancelled_count"),
        ).group_by(cancelled_month)
        cancelled_stmt = _apply_cancelled_on_filter(
            cancelled_stmt, start_date, end_date
        )
        cancelled_rows = (await self.db.execute(cancelled_stmt)).all()

        merged: dict[str, dict[str, int]] = {}
        for row in approved_rows:
            if row.year_month is None:
                continue
            merged.setdefault(row.year_month, {"approved": 0, "cancelled": 0})
            merged[row.year_month]["approved"] = int(row.approved_count)
        for row in cancelled_rows:
            if row.year_month is None:
                continue
            merged.setdefault(row.year_month, {"approved": 0, "cancelled": 0})
            merged[row.year_month]["cancelled"] = int(row.cancelled_count)

        return [
            ApprovedVsCancelledByMonthResponse(
                year_month=year_month,
                approved_count=counts["approved"],
                cancelled_count=counts["cancelled"],
            )
            for year_month, counts in sorted(merged.items(), key=lambda item: item[0])
        ]

    async def dashboard_overview(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> DashboardOverviewResponse:
        sales_stmt = select(
            func.count(Sale.id).label("sale_count"),
            func.coalesce(func.sum(Sale.total), 0).label("total_revenue"),
            func.coalesce(func.sum(Sale.gross_margin), 0).label("total_gross_margin"),
        )
        sales_stmt = _apply_sold_on_filter(sales_stmt, start_date, end_date)
        sales_row = (await self.db.execute(sales_stmt)).one()

        approved_stmt = select(func.count(Quote.id)).where(
            Quote.approved_on.is_not(None)
        )
        approved_stmt = _apply_approved_on_filter(approved_stmt, start_date, end_date)
        approved_count = int((await self.db.execute(approved_stmt)).scalar_one())

        cancelled_stmt = select(func.count(CancelledQuote.id))
        cancelled_stmt = _apply_cancelled_on_filter(
            cancelled_stmt, start_date, end_date
        )
        cancelled_count = int((await self.db.execute(cancelled_stmt)).scalar_one())

        return DashboardOverviewResponse(
            start_date=start_date,
            end_date=end_date,
            sale_count=int(sales_row.sale_count),
            total_revenue=_to_float(sales_row.total_revenue),
            total_gross_margin=_to_float(sales_row.total_gross_margin),
            approved_quotes=approved_count,
            cancelled_quotes=cancelled_count,
        )
