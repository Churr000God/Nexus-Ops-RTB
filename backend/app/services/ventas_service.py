from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import (
    Date,
    Integer,
    Select,
    String,
    bindparam,
    case,
    cast,
    func,
    literal,
    or_,
    select,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_models import (
    CancelledQuote,
    Customer,
    CustomerOrder,
    Quote,
    Sale,
)
from app.schemas.venta_schema import (
    ApprovedVsCancelledByMonthResponse,
    AtRiskCustomerResponse,
    AvgSalesByCustomerTypeResponse,
    DashboardOverviewResponse,
    GrossMarginByProductResponse,
    MonthlyGrowthYoYByCustomerTypeResponse,
    MissingDemandResponse,
    CustomerPaymentStatResponse,
    CustomerSearchItemResponse,
    PaymentTrendResponse,
    ApprovalTimeTrendResponse,
    PendingPaymentStatResponse,
    PendingPaymentCustomerResponse,
    ProductsByCustomerTypeResponse,
    QuarterlyGrowthByCustomerTypeResponse,
    QuoteStatusByMonthResponse,
    RecentQuoteResponse,
    SaleResponse,
    SalesByProductDistributionResponse,
    SalesByCustomerResponse,
    SalesByCustomerTypeResponse,
    SalesByMonthResponse,
    SalesForecastByProductResponse,
    SalesProjectionByMonthResponse,
    SalesSummaryResponse,
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


def _apply_quote_created_filter(
    stmt: Select,
    start_date: date | None,
    end_date: date | None,
) -> Select:
    start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
    if start_dt is not None:
        stmt = stmt.where(Quote.created_on >= start_dt)
    if end_dt is not None:
        stmt = stmt.where(Quote.created_on < end_dt)
    return stmt


def _to_float(value: object | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def _quote_status_bucket_expr():
    status_text = func.lower(func.coalesce(Quote.status, literal("")))
    return case(
        (
            or_(Quote.approved_on.is_not(None), status_text.like("%aprob%")),
            literal("approved"),
        ),
        (
            status_text.like("%cancel%"),
            literal("cancelled"),
        ),
        (status_text.like("%rechaz%"), literal("rejected")),
        (status_text.like("%expir%"), literal("expired")),
        (
            or_(
                status_text.like("%revisi%"),
                status_text.like("%pend%"),
                status_text.like("%proceso%"),
            ),
            literal("review"),
        ),
        (status_text.like("%cotiz%"), literal("quoting")),
        else_=literal("other"),
    )


def _approved_quote_condition():
    status_text = func.lower(func.coalesce(Quote.status, literal("")))
    return or_(Quote.approved_on.is_not(None), status_text.like("%aprob%"))


def _is_convertible_status(status: str | None) -> bool:
    normalized = (status or "").strip().lower()
    return (
        "pend" in normalized
        or "revisi" in normalized
        or "proceso" in normalized
        or "cotiz" in normalized
    )


def _quote_status_filter(bucket: str):
    normalized = (bucket or "").strip().lower()
    status_text = func.lower(func.coalesce(Quote.status, literal("")))
    if normalized == "approved":
        return or_(Quote.approved_on.is_not(None), status_text.like("%aprob%"))
    if normalized == "cancelled":
        return status_text.like("%cancel%")
    if normalized == "expired":
        return status_text.like("%expir%")
    if normalized == "review":
        return or_(
            status_text.like("%revisi%"),
            status_text.like("%pend%"),
            status_text.like("%proceso%"),
        )
    if normalized == "quoting":
        return status_text.like("%cotiz%")
    if normalized == "rejected":
        return status_text.like("%rechaz%")
    return None


def _compute_projected_sales(actual_sales: list[float], index: int) -> float:
    if index == 0:
        return actual_sales[0]

    window = actual_sales[max(0, index - 3) : index]
    if not window:
        return actual_sales[index]

    average_sales = sum(window) / len(window)
    growth_rates = [
        (current - previous) / previous
        for previous, current in zip(window, window[1:], strict=False)
        if previous > 0
    ]
    avg_growth = sum(growth_rates) / len(growth_rates) if growth_rates else 0.0
    return max(average_sales * (1 + avg_growth), 0.0)


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
        join_condition = or_(
            Customer.id == Sale.customer_id,
            Customer.external_id == Sale.external_customer_id,
            cast(Customer.id, String) == Sale.external_customer_id,
        )
        stmt = (
            select(
                customer_key.label("customer"),
                func.count(Sale.id).label("sale_count"),
                func.coalesce(func.sum(Sale.total), 0).label("total_revenue"),
            )
            .outerjoin(Customer, join_condition)
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
        product_search: str | None = None,
    ) -> list[GrossMarginByProductResponse]:
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)

        filters = [
            "(c.approved_on IS NOT NULL OR LOWER(COALESCE(c.status, '')) LIKE '%aprob%')"
        ]
        params: dict = {}
        if start_dt is not None:
            filters.append("c.approved_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            filters.append("c.approved_on < :end_dt")
            params["end_dt"] = end_dt
        if product_search and product_search.strip():
            filters.append("(p.name ILIKE :search OR ci.sku ILIKE :search)")
            params["search"] = f"%{product_search.strip()}%"

        where_clause = " AND ".join(filters)
        params["limit"] = limit

        sql = text(
            f"""
            SELECT
                COALESCE(p.name, ci.sku, 'Sin producto') AS product,
                ci.sku,
                COALESCE(SUM(ci.qty_requested), 0) AS qty,
                COALESCE(SUM(ci.subtotal), 0) AS revenue,
                COALESCE(SUM(ci.purchase_subtotal), 0) AS cost,
                COALESCE(SUM(ci.subtotal), 0) - COALESCE(SUM(ci.purchase_subtotal), 0) AS gross_margin,
                CASE
                    WHEN COALESCE(SUM(ci.subtotal), 0) > 0
                    THEN ROUND(
                        ((COALESCE(SUM(ci.subtotal), 0) - COALESCE(SUM(ci.purchase_subtotal), 0))
                         / COALESCE(SUM(ci.subtotal), 0)) * 100,
                        2
                    )
                    ELSE NULL
                END AS margin_percent
            FROM cotizacion_items ci
            JOIN cotizaciones c ON ci.quote_id = c.id
            LEFT JOIN productos p ON ci.product_id = p.id
            WHERE {where_clause}
            GROUP BY COALESCE(p.name, ci.sku, 'Sin producto'), ci.sku
            ORDER BY gross_margin DESC
            LIMIT :limit
            """
        )

        rows = (await self.db.execute(sql, params)).all()
        return [
            GrossMarginByProductResponse(
                product=row.product,
                sku=row.sku,
                qty=_to_float(row.qty),
                revenue=_to_float(row.revenue),
                cost=_to_float(row.cost),
                gross_margin=_to_float(row.gross_margin),
                margin_percent=float(row.margin_percent)
                if row.margin_percent is not None
                else None,
            )
            for row in rows
        ]

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

    async def sales_summary(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> SalesSummaryResponse:
        sales_stmt = select(
            func.coalesce(func.sum(Sale.subtotal), 0).label("total_sales"),
            func.avg(Sale.margin_percent).label("average_margin_percent"),
        )
        sales_stmt = _apply_sold_on_filter(sales_stmt, start_date, end_date)
        sales_row = (await self.db.execute(sales_stmt)).one()

        # diff_vs_po: JOIN ventas → cotizaciones, PO = cotizacion.subtotal
        diff_stmt = (
            select(
                func.coalesce(func.sum(Quote.subtotal), 0).label("total_po"),
                func.coalesce(func.sum(Sale.subtotal), 0).label("total_venta"),
            )
            .join(Quote, Quote.id == Sale.quote_id)
            .where(Sale.quote_id.is_not(None))
            .where(Quote.subtotal.is_not(None))
            .where(Sale.subtotal.is_not(None))
        )
        diff_stmt = _apply_sold_on_filter(diff_stmt, start_date, end_date)
        diff_row = (await self.db.execute(diff_stmt)).one()

        status_bucket = _quote_status_bucket_expr()
        quote_counts_stmt = (
            select(
                status_bucket.label("status_bucket"),
                func.count(Quote.id).label("quote_count"),
            )
            .select_from(Quote)
            .group_by(status_bucket)
        )
        quote_counts_stmt = _apply_quote_created_filter(
            quote_counts_stmt, start_date, end_date
        )
        quote_count_rows = (await self.db.execute(quote_counts_stmt)).all()

        counts = {
            "approved": 0,
            "cancelled": 0,
            "expired": 0,
            "review": 0,
            "other": 0,
        }
        for row in quote_count_rows:
            counts[str(row.status_bucket)] = int(row.quote_count)

        total_quotes = sum(counts.values())
        conversion_rate = (
            counts["approved"] / total_quotes * 100.0 if total_quotes > 0 else 0.0
        )
        average_margin_percent = _to_float(sales_row.average_margin_percent) * 100.0

        total_po = _to_float(diff_row.total_po)
        total_sub = _to_float(diff_row.total_venta)
        diff_monto = total_sub - total_po
        diff_pct = (diff_monto / total_po * 100.0) if total_po > 0 else None

        return SalesSummaryResponse(
            start_date=start_date,
            end_date=end_date,
            total_sales=_to_float(sales_row.total_sales),
            pending_quotes=counts["review"],
            average_margin_percent=average_margin_percent,
            conversion_rate=conversion_rate,
            total_quotes=total_quotes,
            approved_quotes=counts["approved"],
            cancelled_quotes=counts["cancelled"],
            expired_quotes=counts["expired"],
            review_quotes=counts["review"],
            diff_vs_po_monto=round(diff_monto, 2),
            diff_vs_po_pct=round(diff_pct, 1) if diff_pct is not None else None,
        )

    async def top_customers_by_sales(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
        customer_search: str | None = None,
    ) -> list[SalesByCustomerResponse]:
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)

        filters = [
            "(co.approved_on IS NOT NULL OR LOWER(COALESCE(co.status, '')) LIKE '%aprob%')"
        ]
        params: dict = {}
        if start_dt is not None:
            filters.append("co.created_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            filters.append("co.created_on < :end_dt")
            params["end_dt"] = end_dt
        if customer_search and customer_search.strip():
            filters.append("cl.name ILIKE :search")
            params["search"] = f"%{customer_search.strip()}%"

        where_clause = " AND ".join(filters)
        params["limit"] = limit

        sql = text(
            f"""
            SELECT
                cl.name                                   AS customer,
                NULLIF(TRIM(COALESCE(cl.category, '')), '') AS category,
                COUNT(co.id)                              AS sale_count,
                COALESCE(SUM(co.subtotal), 0)             AS total_sales
            FROM cotizaciones co
            JOIN clientes cl ON cl.id = co.customer_id
            WHERE {where_clause}
            GROUP BY cl.id, cl.name, cl.category
            ORDER BY total_sales DESC
            LIMIT :limit
            """
        )
        rows = (await self.db.execute(sql, params)).all()
        return [
            SalesByCustomerResponse(
                customer=row.customer,
                category=row.category,
                sale_count=int(row.sale_count),
                total_revenue=_to_float(row.total_sales),
                average_ticket=(
                    _to_float(row.total_sales) / int(row.sale_count)
                    if int(row.sale_count) > 0
                    else 0.0
                ),
            )
            for row in rows
        ]

    async def sales_distribution_by_product(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
        product_search: str | None = None,
    ) -> list[SalesByProductDistributionResponse]:
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)

        base_filters = [
            "(c.approved_on IS NOT NULL OR LOWER(COALESCE(c.status, '')) LIKE '%aprob%')"
        ]
        params: dict = {}
        if start_dt is not None:
            base_filters.append("c.approved_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            base_filters.append("c.approved_on < :end_dt")
            params["end_dt"] = end_dt

        product_filters = list(base_filters)
        if product_search and product_search.strip():
            product_filters.append("(p.name ILIKE :search OR ci.sku ILIKE :search)")
            params["search"] = f"%{product_search.strip()}%"

        base_where = " AND ".join(base_filters)
        product_where = " AND ".join(product_filters)
        params["limit"] = limit

        sql = text(
            f"""
            WITH total_ventas AS (
                SELECT COALESCE(SUM(ci.accumulated_sales), 0) AS total
                FROM cotizacion_items ci
                JOIN cotizaciones c ON ci.quote_id = c.id
                WHERE {base_where}
            ),
            productos_venta AS (
                SELECT
                    COALESCE(p.name, ci.sku, 'Sin producto') AS product,
                    ci.sku,
                    COALESCE(SUM(ci.qty_packed), 0) AS qty,
                    COALESCE(SUM(ci.accumulated_sales), 0) AS revenue
                FROM cotizacion_items ci
                JOIN cotizaciones c ON ci.quote_id = c.id
                LEFT JOIN productos p ON ci.product_id = p.id
                WHERE {product_where}
                GROUP BY COALESCE(p.name, ci.sku, 'Sin producto'), ci.sku
                ORDER BY revenue DESC
                LIMIT :limit
            )
            SELECT
                pv.product,
                pv.sku,
                pv.qty,
                pv.revenue,
                CASE
                    WHEN tv.total > 0 THEN ROUND((pv.revenue / tv.total) * 100, 2)
                    ELSE 0
                END AS percentage
            FROM productos_venta pv
            CROSS JOIN total_ventas tv
            ORDER BY pv.revenue DESC
            """
        )

        rows = (await self.db.execute(sql, params)).all()
        return [
            SalesByProductDistributionResponse(
                product=row.product,
                sku=row.sku,
                qty=_to_float(row.qty),
                revenue=_to_float(row.revenue),
                percentage=float(row.percentage),
            )
            for row in rows
        ]

    async def sales_vs_projection_by_month(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[SalesProjectionByMonthResponse]:
        month_key_sold = func.to_char(func.date_trunc("month", Sale.sold_on), "YYYY-MM")

        actual_stmt = (
            select(
                month_key_sold.label("year_month"),
                func.count(Sale.id).label("num_ventas"),
                func.coalesce(func.sum(Sale.subtotal), 0).label("subtotal"),
                func.coalesce(func.sum(Sale.total), 0).label("total_con_iva"),
                func.coalesce(func.sum(Sale.gross_margin), 0).label("margen_bruto"),
                func.coalesce(func.sum(Sale.purchase_cost), 0).label("costo_compra"),
            )
            .select_from(Sale)
            .join(Quote, Quote.id == Sale.quote_id)
            .where(_approved_quote_condition())
            .where(Sale.sold_on.is_not(None))
            .group_by(month_key_sold)
            .order_by(month_key_sold.asc())
        )
        actual_stmt = _apply_sold_on_filter(actual_stmt, start_date, end_date)
        actual_rows = [
            row
            for row in (await self.db.execute(actual_stmt)).all()
            if row.year_month is not None
        ]

        actual_by_month: dict[str, dict] = {
            row.year_month: {
                "num_ventas": int(row.num_ventas),
                "subtotal": _to_float(row.subtotal),
                "total_con_iva": _to_float(row.total_con_iva),
                "margen_bruto": _to_float(row.margen_bruto),
                "costo_compra": _to_float(row.costo_compra),
            }
            for row in actual_rows
        }
        months = sorted(actual_by_month.keys())
        subtotal_bases = [actual_by_month[month]["subtotal"] for month in months]
        projected_series = [
            _compute_projected_sales(subtotal_bases, index)
            for index, _ in enumerate(months)
        ]

        _empty: dict = {
            "num_ventas": 0,
            "subtotal": 0.0,
            "total_con_iva": 0.0,
            "margen_bruto": 0.0,
            "costo_compra": 0.0,
        }
        return [
            SalesProjectionByMonthResponse(
                year_month=month,
                num_ventas=actual_by_month.get(month, _empty)["num_ventas"],
                subtotal=actual_by_month.get(month, _empty)["subtotal"],
                total_con_iva=actual_by_month.get(month, _empty)["total_con_iva"],
                margen_bruto=actual_by_month.get(month, _empty)["margen_bruto"],
                costo_compra=actual_by_month.get(month, _empty)["costo_compra"],
                projected_sales=projected_series[index],
            )
            for index, month in enumerate(months)
        ]

    async def quote_status_by_month(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[QuoteStatusByMonthResponse]:
        effective_created = func.coalesce(Quote.created_on, Quote.created_at)
        month_key = func.to_char(effective_created, "YYYY-MM")
        status_bucket = _quote_status_bucket_expr()
        amount_value = func.coalesce(Quote.subtotal, 0)
        amount_sum = func.coalesce(func.sum(amount_value), 0).label("amount_sum")

        stmt = (
            select(
                month_key.label("year_month"),
                status_bucket.label("status_bucket"),
                func.count(Quote.id).label("quote_count"),
                amount_sum,
            )
            .select_from(Quote)
            .group_by(month_key, status_bucket)
            .order_by(month_key.asc())
        )
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
        if start_dt is not None:
            stmt = stmt.where(effective_created >= start_dt)
        if end_dt is not None:
            stmt = stmt.where(effective_created < end_dt)
        rows = (await self.db.execute(stmt)).all()

        merged: dict[str, dict[str, dict[str, float | int]]] = {}
        for row in rows:
            if row.year_month is None:
                continue
            bucket = str(row.status_bucket)
            merged.setdefault(
                row.year_month,
                {
                    "approved": {"count": 0, "amount": 0.0},
                    "cancelled": {"count": 0, "amount": 0.0},
                    "expired": {"count": 0, "amount": 0.0},
                    "review": {"count": 0, "amount": 0.0},
                    "quoting": {"count": 0, "amount": 0.0},
                    "rejected": {"count": 0, "amount": 0.0},
                },
            )
            if bucket in merged[row.year_month]:
                merged[row.year_month][bucket]["count"] = int(row.quote_count)
                merged[row.year_month][bucket]["amount"] = _to_float(row.amount_sum)

        return [
            QuoteStatusByMonthResponse(
                year_month=year_month,
                approved_count=int(counts["approved"]["count"]),
                cancelled_count=int(counts["cancelled"]["count"]),
                expired_count=int(counts["expired"]["count"]),
                review_count=int(counts["review"]["count"]),
                quoting_count=int(counts["quoting"]["count"]),
                rejected_count=int(counts["rejected"]["count"]),
                approved_amount=float(counts["approved"]["amount"]),
                cancelled_amount=float(counts["cancelled"]["amount"]),
                expired_amount=float(counts["expired"]["amount"]),
                review_amount=float(counts["review"]["amount"]),
                quoting_amount=float(counts["quoting"]["amount"]),
                rejected_amount=float(counts["rejected"]["amount"]),
            )
            for year_month, counts in sorted(merged.items(), key=lambda item: item[0])
        ]

    async def recent_quotes(
        self,
        start_date: date | None,
        end_date: date | None,
        status: str | None,
        limit: int,
        search: str | None = None,
    ) -> list[RecentQuoteResponse]:
        customer_name_expr = func.coalesce(Customer.name, literal("Sin cliente"))
        stmt = (
            select(
                Quote.id.label("id"),
                Quote.name.label("name"),
                Quote.po_pr.label("po_pr"),
                Quote.created_at.label("created_at"),
                Quote.status.label("status"),
                Quote.total.label("total"),
                Quote.subtotal.label("subtotal"),
                customer_name_expr.label("customer_name"),
            )
            .select_from(Quote)
            .outerjoin(Customer, Customer.id == Quote.customer_id)
            .order_by(Quote.created_at.desc())
            .limit(limit)
        )
        if status:
            condition = _quote_status_filter(status)
            if condition is not None:
                stmt = stmt.where(condition)
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Quote.name.ilike(pattern),
                    Quote.po_pr.ilike(pattern),
                    Customer.name.ilike(pattern),
                )
            )
        rows = (await self.db.execute(stmt)).all()

        return [
            RecentQuoteResponse(
                id=row.id,
                name=row.name,
                po_pr=row.po_pr,
                created_on=row.created_at,
                customer_name=row.customer_name,
                status=row.status,
                total=float(row.total) if row.total is not None else None,
                subtotal=float(row.subtotal) if row.subtotal is not None else None,
                can_convert=_is_convertible_status(row.status),
            )
            for row in rows
        ]

    async def missing_demand_by_product(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
        product_search: str | None = None,
    ) -> list[MissingDemandResponse]:
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)

        filters = [
            "(c.approved_on IS NOT NULL OR LOWER(COALESCE(c.status, '')) LIKE '%aprob%')"
        ]
        params: dict = {}
        if start_dt is not None:
            filters.append("c.approved_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            filters.append("c.approved_on < :end_dt")
            params["end_dt"] = end_dt
        if product_search and product_search.strip():
            filters.append("(p.name ILIKE :search OR ci.sku ILIKE :search)")
            params["search"] = f"%{product_search.strip()}%"

        where_clause = " AND ".join(filters)
        params["limit"] = limit

        sql = text(
            f"""
            SELECT
                COALESCE(p.name, ci.sku, 'Sin producto') AS product,
                ci.sku,
                ci.category,
                COALESCE(SUM(ci.qty_requested), 0) - COALESCE(SUM(ci.qty_packed), 0) AS demanda_faltante,
                COALESCE(SUM(ci.subtotal), 0) AS valor_venta_pendiente,
                COALESCE(SUM(ci.purchase_subtotal), 0) AS costo_compra_estimado
            FROM cotizacion_items ci
            JOIN cotizaciones c ON ci.quote_id = c.id
            LEFT JOIN productos p ON ci.product_id = p.id
            WHERE {where_clause}
            GROUP BY COALESCE(p.name, ci.sku, 'Sin producto'), ci.sku, ci.category
            HAVING COALESCE(SUM(ci.qty_requested), 0) - COALESCE(SUM(ci.qty_packed), 0) > 0
            ORDER BY demanda_faltante DESC
            LIMIT :limit
            """
        )

        rows = (await self.db.execute(sql, params)).all()
        total_demand = sum(_to_float(row.demanda_faltante) for row in rows)
        cumulative = 0.0
        results: list[MissingDemandResponse] = []
        for row in rows:
            demand = _to_float(row.demanda_faltante)
            cumulative += demand
            pareto = (cumulative / total_demand * 100.0) if total_demand > 0 else 0.0
            results.append(
                MissingDemandResponse(
                    product=row.product,
                    sku=row.sku,
                    category=row.category,
                    demanda_faltante=demand,
                    valor_venta_pendiente=_to_float(row.valor_venta_pendiente),
                    costo_compra_estimado=_to_float(row.costo_compra_estimado),
                    pareto_percent=round(pareto, 2),
                )
            )
        return results

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

    async def sales_forecast_by_product(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
        months_window: int,
        product_search: str | None = None,
    ) -> list[SalesForecastByProductResponse]:
        # Promedio móvil de los últimos N meses por producto.
        # Usa cotizacion_items como fuente de unidades y ventas/cotizaciones para fecha.
        sql = text(
            """
            WITH ventas_producto_mes AS (
                SELECT
                    cl.product_id,
                    cl.sku,
                    cl.category,
                    COALESCE(p.name, cl.sku, 'Sin nombre') AS product_name,
                    DATE_TRUNC('month',
                        COALESCE(v.sold_on, q.approved_on, q.created_on)
                    ) AS mes,
                    SUM(COALESCE(cl.qty_packed, cl.qty_requested, 0)) AS unidades_vendidas
                FROM cotizacion_items cl
                LEFT JOIN cotizaciones q ON cl.quote_id = q.id
                LEFT JOIN ventas v ON v.quote_id = q.id
                LEFT JOIN productos p ON cl.product_id = p.id
                WHERE
                    (
                        v.id IS NOT NULL
                        OR q.approved_on IS NOT NULL
                        OR LOWER(COALESCE(v.status, q.status, '')) LIKE '%aprob%'
                    )
                    AND COALESCE(v.sold_on, q.approved_on, q.created_on) IS NOT NULL
                    AND (
                        :start_date IS NULL
                        OR COALESCE(v.sold_on, q.approved_on, q.created_on)
                            >= :start_date ::date
                    )
                    AND (
                        :end_date IS NULL
                        OR COALESCE(v.sold_on, q.approved_on, q.created_on)
                            <= :end_date ::date
                    )
                    AND (
                        :search IS NULL
                        OR COALESCE(p.name, cl.sku, '') ILIKE :search
                    )
                GROUP BY
                    cl.product_id,
                    cl.sku,
                    cl.category,
                    product_name,
                    DATE_TRUNC('month',
                        COALESCE(v.sold_on, q.approved_on, q.created_on)
                    )
            ),
            ranked AS (
                SELECT
                    product_id,
                    sku,
                    category,
                    product_name,
                    unidades_vendidas,
                    ROW_NUMBER() OVER (
                        PARTITION BY product_id, sku, category
                        ORDER BY mes DESC
                    ) AS rn
                FROM ventas_producto_mes
            ),
            forecast AS (
                SELECT
                    product_id,
                    sku,
                    category,
                    product_name,
                    AVG(unidades_vendidas) AS predicted_units
                FROM ranked
                WHERE rn <= :months_window
                GROUP BY product_id, sku, category, product_name
            )
            SELECT product_name, sku, category, predicted_units
            FROM forecast
            WHERE predicted_units > 0
            ORDER BY predicted_units DESC
            LIMIT :limit
            """
        ).bindparams(
            bindparam("start_date", type_=Date()),
            bindparam("end_date", type_=Date()),
            bindparam("months_window", type_=Integer()),
            bindparam("limit", type_=Integer()),
            bindparam("search", type_=String()),
        )

        rows = (
            await self.db.execute(
                sql,
                {
                    "start_date": start_date,
                    "end_date": end_date,
                    "months_window": months_window,
                    "limit": limit,
                    "search": f"%{product_search}%"
                    if product_search and product_search.strip()
                    else None,
                },
            )
        ).all()

        return [
            SalesForecastByProductResponse(
                product=row.product_name,
                sku=row.sku,
                category=row.category,
                predicted_units=float(row.predicted_units),
            )
            for row in rows
        ]

    async def at_risk_customers(self) -> list[AtRiskCustomerResponse]:
        """Detecta clientes cuya compra ha bajado respecto a periodos anteriores.

        Compara subtotal acumulado de cotizaciones Aprobadas en ventas:
        ultimos 90 dias vs todo el historial anterior a esos 90 dias.
        """
        sql = text(
            """
            WITH compras_cliente AS (
                SELECT
                    c.id          AS customer_id,
                    c.external_id AS external_id,
                    c.name        AS customer_name,
                    COALESCE(SUM(CASE
                        WHEN v.sold_on >= CURRENT_DATE - INTERVAL '90 days'
                        THEN v.subtotal
                    END), 0)    AS compras_ult_90,
                    COALESCE(SUM(CASE
                        WHEN v.sold_on < CURRENT_DATE - INTERVAL '90 days'
                        THEN v.subtotal
                    END), 0)    AS compras_90_previos,
                    MAX(v.sold_on) AS ultima_compra
                FROM clientes c
                JOIN cotizaciones q
                    ON q.customer_id = c.id
                    AND (q.approved_on IS NOT NULL OR LOWER(COALESCE(q.status, '')) LIKE '%aprob%')
                JOIN ventas v
                    ON v.quote_id = q.id
                WHERE v.subtotal IS NOT NULL
                GROUP BY
                    c.id,
                    c.external_id,
                    c.name
            )
            SELECT
                customer_id,
                external_id,
                customer_name,
                compras_ult_90,
                compras_90_previos,
                ultima_compra,
                CASE
                    WHEN compras_90_previos > 0 AND compras_ult_90 = 0 THEN 'Crítico'
                    WHEN compras_ult_90 < compras_90_previos * 0.5 THEN 'Alto'
                    WHEN compras_ult_90 < compras_90_previos * 0.8 THEN 'Medio'
                    ELSE 'Bajo'
                END AS riesgo_abandono
            FROM compras_cliente
            WHERE
                (compras_90_previos > 0 AND compras_ult_90 = 0)
                OR compras_ult_90 < compras_90_previos * 0.8
            ORDER BY compras_ult_90 DESC
            """
        )

        rows = (await self.db.execute(sql)).all()

        return [
            AtRiskCustomerResponse(
                customer_id=row.customer_id,
                external_id=row.external_id,
                customer_name=row.customer_name,
                compras_ult_90=float(row.compras_ult_90),
                compras_90_previos=float(row.compras_90_previos),
                ultima_compra=row.ultima_compra.date()
                if hasattr(row.ultima_compra, "date")
                else row.ultima_compra,
                riesgo_abandono=row.riesgo_abandono,
            )
            for row in rows
        ]

    async def payment_trend(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
    ) -> list[PaymentTrendResponse]:
        customer_name_expr = func.coalesce(Customer.name, literal("Sin cliente")).label(
            "customer_name"
        )
        avg_days_expr = func.avg(
            cast(CustomerOrder.paid_on - CustomerOrder.invoiced_on, Integer)
        ).label("avg_days")
        stmt = (
            select(
                customer_name_expr,
                avg_days_expr,
                func.max(CustomerOrder.paid_on).label("last_paid_on"),
            )
            .select_from(CustomerOrder)
            .outerjoin(Customer, Customer.id == CustomerOrder.customer_id)
            .where(CustomerOrder.paid_on.is_not(None))
            .where(CustomerOrder.invoiced_on.is_not(None))
            .group_by(customer_name_expr)
            .order_by(avg_days_expr.desc())
            .limit(limit)
        )

        if start_date is not None:
            stmt = stmt.where(CustomerOrder.paid_on >= start_date)
        if end_date is not None:
            stmt = stmt.where(CustomerOrder.paid_on <= end_date)

        rows = (await self.db.execute(stmt)).all()
        results: list[PaymentTrendResponse] = []
        for row in rows:
            avg_days = float(row.avg_days) if row.avg_days is not None else 0.0
            if avg_days <= 30:
                risk = "Bajo"
            elif avg_days <= 60:
                risk = "Medio"
            else:
                risk = "Alto"
            results.append(
                PaymentTrendResponse(
                    customer_name=row.customer_name,
                    promedio_dias_pago=avg_days,
                    ultimo_pago=row.last_paid_on.date()
                    if hasattr(row.last_paid_on, "date")
                    else row.last_paid_on,
                    riesgo_pago=risk,
                )
            )
        return results

    async def avg_sales_by_customer_type(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[AvgSalesByCustomerTypeResponse]:
        """Venta promedio por cliente desglosado por tipo (Local, Foraneo, Sin categoría).

        Misma lógica que sales_by_customer_type: parte de cotizaciones Aprobadas con
        LEFT JOIN a clientes. El promedio se calcula solo sobre cotizaciones con
        customer_id enlazado (denominador confiable).
        """
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
        filters = [
            "(co.approved_on IS NOT NULL OR LOWER(COALESCE(co.status, '')) LIKE '%aprob%')",
            "co.customer_id IS NOT NULL",
        ]
        params: dict = {}
        if start_dt is not None:
            filters.append("co.created_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            filters.append("co.created_on < :end_dt")
            params["end_dt"] = end_dt

        where_clause = " AND ".join(filters)
        sql = text(
            f"""
            WITH ventas_por_cliente AS (
                SELECT
                    CASE
                        WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Foraneo' THEN 'Foraneo'
                        WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Local'   THEN 'Local'
                        ELSE 'Sin categoría'
                    END                      AS tipo_cliente,
                    co.customer_id,
                    SUM(co.subtotal)         AS subtotal_cliente
                FROM cotizaciones co
                LEFT JOIN clientes cl ON co.customer_id = cl.id
                WHERE {where_clause}
                GROUP BY tipo_cliente, co.customer_id
            )
            SELECT
                tipo_cliente,
                COUNT(DISTINCT customer_id)                                AS numero_clientes,
                ROUND(SUM(subtotal_cliente) /
                      NULLIF(COUNT(DISTINCT customer_id), 0), 4)           AS venta_promedio_por_cliente
            FROM ventas_por_cliente
            GROUP BY tipo_cliente
            ORDER BY venta_promedio_por_cliente DESC
            """
        )
        rows = (await self.db.execute(sql, params)).all()

        label_map = {
            "foraneo": "Foráneo",
            "local": "Local",
            "sin categoría": "Sin categoría",
        }
        return [
            AvgSalesByCustomerTypeResponse(
                tipo_cliente=label_map.get(row.tipo_cliente.lower(), row.tipo_cliente),
                numero_clientes=int(row.numero_clientes),
                venta_promedio_por_cliente=_to_float(row.venta_promedio_por_cliente),
            )
            for row in rows
        ]

    async def monthly_growth_yoy_by_customer_type(
        self,
        selected_month: int | None = None,
    ) -> list[MonthlyGrowthYoYByCustomerTypeResponse]:
        today = date.today()
        month = selected_month if selected_month is not None else today.month
        year = today.year

        month_start = date(year, month, 1)
        month_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        last_year_start = date(year - 1, month, 1)
        last_year_end = (
            date(year, 1, 1) if month == 12 else date(year - 1, month + 1, 1)
        )

        sql = text(
            """
            SELECT
                CASE
                    WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Foraneo' THEN 'Foraneo'
                    WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Local'   THEN 'Local'
                    ELSE 'Sin categoria'
                END AS tipo_cliente,
                COALESCE(SUM(CASE
                    WHEN v.sold_on >= :mes_inicio AND v.sold_on < :mes_fin
                    THEN v.subtotal ELSE 0
                END), 0) AS ventas_mes_actual,
                COALESCE(SUM(CASE
                    WHEN v.sold_on >= :anio_ant_inicio AND v.sold_on < :anio_ant_fin
                    THEN v.subtotal ELSE 0
                END), 0) AS ventas_anio_pasado
            FROM ventas v
            LEFT JOIN cotizaciones co ON v.quote_id = co.id
            LEFT JOIN clientes cl     ON co.customer_id = cl.id
            WHERE v.sold_on >= :anio_ant_inicio AND v.sold_on < :mes_fin
              AND LOWER(COALESCE(v.status, '')) NOT LIKE '%cancel%'
            GROUP BY tipo_cliente
            ORDER BY ventas_mes_actual DESC
            """
        )

        params = {
            "mes_inicio": datetime.combine(month_start, time.min, tzinfo=timezone.utc),
            "mes_fin": datetime.combine(month_end, time.min, tzinfo=timezone.utc),
            "anio_ant_inicio": datetime.combine(
                last_year_start, time.min, tzinfo=timezone.utc
            ),
            "anio_ant_fin": datetime.combine(
                last_year_end, time.min, tzinfo=timezone.utc
            ),
        }

        _label_map = {
            "foraneo": "Foráneo",
            "local": "Local",
            "sin categoria": "Sin categoría",
        }

        rows = (await self.db.execute(sql, params)).all()
        results: list[MonthlyGrowthYoYByCustomerTypeResponse] = []
        for row in rows:
            current_value = _to_float(row.ventas_mes_actual)
            last_value = _to_float(row.ventas_anio_pasado)
            growth = (
                round(((current_value - last_value) / last_value) * 100.0, 2)
                if last_value > 0
                else None
            )
            results.append(
                MonthlyGrowthYoYByCustomerTypeResponse(
                    tipo_cliente=_label_map.get(
                        row.tipo_cliente.lower(), row.tipo_cliente
                    ),
                    ventas_mes_actual=current_value,
                    ventas_mismo_mes_anio_pasado=last_value,
                    tasa_crecimiento_pct=growth,
                )
            )
        return results

    async def quarterly_growth_by_customer_type(
        self,
        selected_quarter: int | None = None,
    ) -> list[QuarterlyGrowthByCustomerTypeResponse]:
        today = date.today()
        current_quarter = (today.month - 1) // 3 + 1
        quarter = selected_quarter if selected_quarter is not None else current_quarter

        q_start_month = (quarter - 1) * 3 + 1
        q_end_month = q_start_month + 3

        year = today.year
        quarter_start = date(year, q_start_month, 1)
        quarter_end = (
            date(year + 1, 1, 1) if q_end_month > 12 else date(year, q_end_month, 1)
        )
        last_year_start = date(year - 1, q_start_month, 1)
        last_year_end = (
            date(year, 1, 1) if q_end_month > 12 else date(year - 1, q_end_month, 1)
        )

        sql = text(
            """
            SELECT
                CASE
                    WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Foraneo' THEN 'Foraneo'
                    WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Local' THEN 'Local'
                    ELSE 'Sin categoria'
                END AS tipo_cliente,
                COALESCE(SUM(CASE WHEN v.sold_on >= :trim_inicio AND v.sold_on < :trim_fin
                    THEN v.subtotal ELSE 0 END), 0) AS ventas_trim_actual,
                COALESCE(SUM(CASE WHEN v.sold_on >= :anio_ant_inicio AND v.sold_on < :anio_ant_fin
                    THEN v.subtotal ELSE 0 END), 0) AS ventas_trim_anio_pasado
            FROM ventas v
            LEFT JOIN cotizaciones co ON v.quote_id = co.id
            LEFT JOIN clientes cl ON co.customer_id = cl.id
            WHERE v.sold_on >= :anio_ant_inicio AND v.sold_on < :trim_fin
              AND LOWER(COALESCE(v.status, '')) NOT LIKE '%cancel%'
            GROUP BY tipo_cliente
            ORDER BY ventas_trim_actual DESC
            """
        )
        params = {
            "trim_inicio": quarter_start,
            "trim_fin": quarter_end,
            "anio_ant_inicio": last_year_start,
            "anio_ant_fin": last_year_end,
        }
        _label_map = {
            "foraneo": "Foráneo",
            "local": "Local",
            "sin categoria": "Sin categoría",
        }
        rows = (await self.db.execute(sql, params)).all()
        results = []
        for row in rows:
            raw = (row.tipo_cliente or "").strip().lower()
            label = _label_map.get(raw, row.tipo_cliente)
            curr = float(row.ventas_trim_actual)
            prev = float(row.ventas_trim_anio_pasado)
            growth = round(((curr - prev) / prev) * 100, 2) if prev > 0 else None
            results.append(
                QuarterlyGrowthByCustomerTypeResponse(
                    tipo_cliente=label,
                    ventas_trim_actual=curr,
                    ventas_trim_anio_pasado=prev,
                    crecimiento_trimestral_pct=growth,
                )
            )
        return results

    async def products_by_customer_type(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[ProductsByCustomerTypeResponse]:
        """Cantidad de productos (qty_packed o qty_requested) por tipo de cliente.

        Solo incluye cotizaciones con status Aprobada.
        """
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
        filters = [
            "(c.approved_on IS NOT NULL OR LOWER(COALESCE(c.status, '')) LIKE '%aprob%')"
        ]
        params: dict = {}
        if start_dt is not None:
            filters.append("c.created_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            filters.append("c.created_on < :end_dt")
            params["end_dt"] = end_dt

        where_clause = " AND ".join(filters)
        sql = text(
            f"""
            SELECT
                COALESCE(NULLIF(TRIM(cl.category), ''), 'Sin categoría') AS tipo_cliente,
                COALESCE(SUM(ci.qty_requested), 0)     AS cantidad_solicitada,
                COALESCE(SUM(ci.qty_packed), 0)        AS cantidad_empacada
            FROM cotizacion_items ci
            INNER JOIN cotizaciones c ON ci.quote_id = c.id
            LEFT JOIN clientes cl ON c.customer_id = cl.id
            WHERE {where_clause}
            GROUP BY COALESCE(NULLIF(TRIM(cl.category), ''), 'Sin categoría')
            ORDER BY cantidad_solicitada DESC
            """
        )
        rows = (await self.db.execute(sql, params)).all()
        return [
            ProductsByCustomerTypeResponse(
                tipo_cliente=row.tipo_cliente,
                cantidad_solicitada=float(row.cantidad_solicitada),
                cantidad_empacada=float(row.cantidad_empacada),
            )
            for row in rows
        ]

    async def sales_by_customer_type(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[SalesByCustomerTypeResponse]:
        """Monto total vendido por tipo de cliente (Local, Foraneo, Sin categoría).

        Incluye los tres grupos en el denominador del porcentaje.
        LEFT JOIN para capturar cotizaciones sin cliente enlazado (Sin categoría).
        """
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
        filters = [
            "(co.approved_on IS NOT NULL OR LOWER(COALESCE(co.status, '')) LIKE '%aprob%')"
        ]
        params: dict = {}
        if start_dt is not None:
            filters.append("co.created_on >= :start_dt")
            params["start_dt"] = start_dt
        if end_dt is not None:
            filters.append("co.created_on < :end_dt")
            params["end_dt"] = end_dt

        where_clause = " AND ".join(filters)
        sql = text(
            f"""
            WITH ventas_por_tipo AS (
                SELECT
                    CASE
                        WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Foraneo' THEN 'Foraneo'
                        WHEN NULLIF(TRIM(COALESCE(cl.category, '')), '') = 'Local'   THEN 'Local'
                        ELSE 'Sin categoria'
                    END                             AS tipo_cliente,
                    COALESCE(SUM(co.subtotal), 0)   AS total_ventas
                FROM cotizaciones co
                LEFT JOIN clientes cl ON co.customer_id = cl.id
                WHERE {where_clause}
                GROUP BY tipo_cliente
            ),
            gran_total AS (
                SELECT SUM(total_ventas) AS grand_total FROM ventas_por_tipo
            )
            SELECT
                vt.tipo_cliente,
                vt.total_ventas,
                CASE
                    WHEN gt.grand_total > 0
                    THEN ROUND((vt.total_ventas / gt.grand_total) * 100, 2)
                    ELSE 0
                END AS porcentaje_ventas
            FROM ventas_por_tipo vt
            CROSS JOIN gran_total gt
            ORDER BY vt.total_ventas DESC
            """
        )

        _label_map = {
            "foraneo": "Foráneo",
            "local": "Local",
            "sin categoria": "Sin categoría",
        }

        rows = (await self.db.execute(sql, params)).all()
        return [
            SalesByCustomerTypeResponse(
                tipo_cliente=_label_map.get(row.tipo_cliente.lower(), row.tipo_cliente),
                total_ventas=_to_float(row.total_ventas),
                porcentaje_ventas=float(row.porcentaje_ventas),
            )
            for row in rows
        ]

    async def pending_payment_customers(self) -> list[PendingPaymentCustomerResponse]:
        """Clientes con pedidos pendientes de pago, ordenados por monto adeudado."""
        sql = text(
            """
            SELECT
                COALESCE(cl.name, 'Sin cliente') AS customer_name,
                cl.category                      AS tipo_cliente,
                COUNT(po.id)                     AS num_pedidos,
                SUM(COALESCE(po.total, 0))       AS total_adeudado,
                MIN(COALESCE(po.invoiced_on, po.ordered_on)) AS desde_fecha,
                CURRENT_DATE - MIN(COALESCE(po.invoiced_on, po.ordered_on))
                                                 AS dias_sin_pagar
            FROM pedidos_clientes po
            LEFT JOIN clientes cl ON po.customer_id = cl.id
            WHERE po.payment_status IN ('No pagada', 'Pagada Parcial')
              AND LOWER(COALESCE(po.order_status, '')) NOT IN ('cancelada', 'cancelado')
              AND COALESCE(po.total, 0) > 0
            GROUP BY cl.id, cl.name, cl.category
            ORDER BY total_adeudado DESC
            """
        )
        rows = (await self.db.execute(sql)).all()
        return [
            PendingPaymentCustomerResponse(
                customer_name=row.customer_name,
                tipo_cliente=row.tipo_cliente,
                num_pedidos=int(row.num_pedidos),
                total_adeudado=float(row.total_adeudado),
                desde_fecha=row.desde_fecha.date()
                if hasattr(row.desde_fecha, "date")
                else row.desde_fecha,
                dias_sin_pagar=int(row.dias_sin_pagar)
                if row.dias_sin_pagar is not None
                else None,
            )
            for row in rows
        ]

    async def customer_payment_stats(
        self, customer_id: str | None = None
    ) -> list[CustomerPaymentStatResponse]:
        """Top-10 (o cliente específico) con días sin pago y monto pendiente.

        Lógica de días:
        - Pedidos pagados: usa payment_time_days guardado.
        - Pedidos no pagados: CURRENT_DATE − COALESCE(pc.approved_on,
          cot.approved_on::date, pc.ordered_on, cot.created_on::date).
        Cuando no se filtra por cliente devuelve top-10 por max_dias_sin_pago
        ordenados por monto_pendiente_mxn DESC.
        """
        customer_filter = "AND c.id = :customer_id ::uuid" if customer_id else ""
        sql = text(
            f"""
            WITH datos_pago AS (
                SELECT
                    c.id                    AS cliente_id,
                    c.name                  AS cliente,
                    CASE
                        WHEN pc.paid_on IS NULL OR pc.payment_time_days IS NULL
                            THEN (CURRENT_DATE - COALESCE(
                                    pc.approved_on,
                                    cot.approved_on::date,
                                    pc.ordered_on,
                                    cot.created_on::date
                                ))
                        ELSE pc.payment_time_days
                    END                     AS dias_pago_efectivo,
                    CASE
                        WHEN pc.payment_status IN ('No pagada', 'Pagada Parcial')
                            THEN COALESCE(pc.total, 0)
                        ELSE 0
                    END                     AS monto_pendiente,
                    CASE
                        WHEN pc.paid_on IS NULL OR pc.payment_time_days IS NULL
                            THEN 1 ELSE 0
                    END                     AS es_sin_pagar,
                    CASE
                        WHEN pc.paid_on IS NULL OR pc.payment_time_days IS NULL
                            THEN (CURRENT_DATE - COALESCE(
                                    pc.approved_on,
                                    cot.approved_on::date,
                                    pc.ordered_on,
                                    cot.created_on::date
                                ))
                        ELSE NULL
                    END                     AS dias_sin_pago
                FROM clientes c
                JOIN cotizaciones cot
                    ON cot.customer_id = c.id
                    AND (cot.approved_on IS NOT NULL OR LOWER(COALESCE(cot.status, '')) LIKE '%aprob%')
                JOIN pedidos_clientes pc
                    ON pc.quote_id = cot.id
                WHERE (
                    pc.payment_time_days IS NOT NULL
                    OR pc.payment_status IN ('No pagada', 'Pagada Parcial')
                    OR (
                        pc.paid_on IS NULL
                        AND COALESCE(
                            pc.approved_on, cot.approved_on::date,
                            pc.ordered_on, cot.created_on::date
                        ) IS NOT NULL
                    )
                )
                AND (cot.approved_on IS NOT NULL OR LOWER(COALESCE(cot.status, '')) LIKE '%aprob%')
                {customer_filter}
            ),
            agregado AS (
                SELECT
                    cliente_id::text                            AS customer_id,
                    cliente                                     AS customer_name,
                    COUNT(*)                                    AS cotizaciones_base,
                    ROUND(AVG(dias_pago_efectivo)::numeric, 1) AS promedio_dias_pago,
                    ROUND(SUM(monto_pendiente)::numeric, 2)    AS monto_pendiente_mxn,
                    SUM(es_sin_pagar)::int                     AS cot_sin_pagar,
                    MAX(dias_sin_pago)::int                    AS max_dias_sin_pago
                FROM datos_pago
                WHERE dias_pago_efectivo IS NOT NULL
                GROUP BY cliente_id, cliente
                ORDER BY max_dias_sin_pago DESC NULLS LAST
                LIMIT 10
            )
            SELECT * FROM agregado
            ORDER BY monto_pendiente_mxn DESC
            """
        )
        params: dict = {}
        if customer_id:
            params["customer_id"] = customer_id
        rows = (await self.db.execute(sql, params)).all()
        return [
            CustomerPaymentStatResponse(
                customer_id=row.customer_id,
                customer_name=row.customer_name,
                cotizaciones_base=int(row.cotizaciones_base),
                promedio_dias_pago=float(row.promedio_dias_pago),
                monto_pendiente_mxn=float(row.monto_pendiente_mxn),
                cot_sin_pagar=int(row.cot_sin_pagar),
                max_dias_sin_pago=int(row.max_dias_sin_pago)
                if row.max_dias_sin_pago is not None
                else None,
            )
            for row in rows
        ]

    async def pending_payment_stats(
        self, customer_id: str | None = None
    ) -> list[PendingPaymentStatResponse]:
        """Top-10 (o cliente específico) con cotizaciones aprobadas sin pagar.

        Fuente: clientes → cotizaciones(Aprobada) → pedidos_clientes(No pagada|Parcial).
        Sin filtro: top-10 por monto_pendiente DESC.
        """
        customer_filter = "AND c.id = :customer_id ::uuid" if customer_id else ""
        limit_clause = "" if customer_id else "LIMIT 10"
        sql = text(
            f"""
            SELECT
                c.id::text                                                  AS customer_id,
                c.name                                                      AS customer_name,
                COUNT(DISTINCT cot.id)                                      AS cot_pendientes,
                ROUND(SUM(COALESCE(pc.total, 0))::numeric, 2)              AS monto_pendiente,
                MIN(COALESCE(
                    pc.invoiced_on,
                    pc.approved_on,
                    cot.approved_on::date,
                    pc.ordered_on,
                    cot.created_on::date
                ))                                                          AS fecha_mas_antigua,
                (CURRENT_DATE - MIN(COALESCE(
                    pc.invoiced_on,
                    pc.approved_on,
                    cot.approved_on::date,
                    pc.ordered_on,
                    cot.created_on::date
                )))::int                                                    AS dias_sin_pagar
            FROM clientes c
            JOIN cotizaciones cot
                ON cot.customer_id = c.id
                AND (cot.approved_on IS NOT NULL OR LOWER(COALESCE(cot.status, '')) LIKE '%aprob%')
            JOIN pedidos_clientes pc
                ON pc.quote_id = cot.id
                AND pc.payment_status IN ('No pagada', 'Pagada Parcial')
            WHERE 1=1
            {customer_filter}
            GROUP BY c.id, c.name
            ORDER BY monto_pendiente DESC
            {limit_clause}
            """
        )
        params: dict = {}
        if customer_id:
            params["customer_id"] = customer_id
        rows = (await self.db.execute(sql, params)).all()
        return [
            PendingPaymentStatResponse(
                customer_id=row.customer_id,
                customer_name=row.customer_name,
                cot_pendientes=int(row.cot_pendientes),
                monto_pendiente=float(row.monto_pendiente),
                fecha_mas_antigua=row.fecha_mas_antigua,
                dias_sin_pagar=int(row.dias_sin_pagar)
                if row.dias_sin_pagar is not None
                else None,
            )
            for row in rows
        ]

    async def search_customers_payment(
        self, q: str
    ) -> list[CustomerSearchItemResponse]:
        """Búsqueda de clientes por nombre o external_id (ILIKE, límite 10)."""
        like = f"%{q}%"
        sql = text(
            """
            SELECT id::text, name, external_id
            FROM clientes
            WHERE name ILIKE :like OR external_id ILIKE :like
            ORDER BY name
            LIMIT 10
            """
        )
        rows = (await self.db.execute(sql, {"like": like})).all()
        return [
            CustomerSearchItemResponse(
                id=row.id,
                name=row.name,
                external_id=row.external_id,
            )
            for row in rows
        ]

    async def approval_time_trend(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[ApprovalTimeTrendResponse]:
        """approved_on − created_on de cotizaciones aprobadas, agrupado por mes."""
        days_expr = (
            func.extract("epoch", Quote.approved_on - Quote.created_on) / 86400.0
        )
        month_key = func.to_char(Quote.approved_on, "YYYY-MM")

        stmt = (
            select(
                month_key.label("year_month"),
                func.avg(days_expr).label("avg_days"),
                func.stddev_pop(days_expr).label("stddev_days"),
                func.count(Quote.id).label("count"),
            )
            .where(Quote.approved_on.is_not(None))
            .where(Quote.created_on.is_not(None))
            .group_by(month_key)
            .order_by(month_key.asc())
        )
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

        rows = (await self.db.execute(stmt)).all()
        if not rows:
            return []

        result: list[ApprovalTimeTrendResponse] = []
        for row in rows:
            if row.year_month is None:
                continue
            avg = round(_to_float(row.avg_days), 1)
            std = round(_to_float(row.stddev_days), 1)
            result.append(
                ApprovalTimeTrendResponse(
                    year_month=row.year_month,
                    avg_days=avg,
                    upper_days=round(avg + std, 1),
                    lower_days=round(max(avg - std, 0.0), 1),
                    count=int(row.count),
                )
            )

        if len(result) >= 1:
            n = len(result)
            if n >= 2:
                xs = list(range(n))
                ys = [r.avg_days for r in result if r.avg_days is not None]
                x_mean = sum(xs) / n
                y_mean = sum(ys) / n
                num = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(xs, ys))
                den = sum((xi - x_mean) ** 2 for xi in xs)
                slope = num / den if den != 0 else 0.0
                intercept = y_mean - slope * x_mean
            else:
                slope = 0.0
                intercept = result[0].avg_days or 0.0

            # Anchor projection line at last actual point
            last = result[-1]
            result[-1] = ApprovalTimeTrendResponse(
                year_month=last.year_month,
                avg_days=last.avg_days,
                upper_days=last.upper_days,
                lower_days=last.lower_days,
                count=last.count,
                projected_days=last.avg_days,
            )

            last_ym = result[-1].year_month
            last_year, last_month = int(last_ym[:4]), int(last_ym[5:7])
            for i in range(1, 4):
                m = last_month + i
                y = last_year + (m - 1) // 12
                m = ((m - 1) % 12) + 1
                proj = round(max(slope * (n + i - 1) + intercept, 0.0), 1)
                result.append(
                    ApprovalTimeTrendResponse(
                        year_month=f"{y:04d}-{m:02d}",
                        count=0,
                        projected_days=proj,
                    )
                )

        return result
