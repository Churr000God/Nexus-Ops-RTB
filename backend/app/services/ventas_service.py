from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import (
    Date,
    Integer,
    Select,
    String,
    and_,
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
    Product,
    Quote,
    QuoteItem,
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
    PaymentTrendResponse,
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
            .where(_approved_quote_condition())
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
        )

    async def top_customers_by_sales(
        self,
        start_date: date | None,
        end_date: date | None,
        limit: int,
    ) -> list[SalesByCustomerResponse]:
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)
        sales_join = Sale.quote_id == Quote.id
        if start_dt is not None:
            sales_join = and_(sales_join, Sale.sold_on >= start_dt)
        if end_dt is not None:
            sales_join = and_(sales_join, Sale.sold_on < end_dt)

        total_sales_expr = func.coalesce(func.sum(Sale.subtotal), 0)

        stmt = (
            select(
                Customer.name.label("customer"),
                func.count(Sale.id).label("sale_count"),
                total_sales_expr.label("total_sales"),
            )
            .select_from(Customer)
            .outerjoin(Quote, Quote.customer_id == Customer.id)
            .outerjoin(Sale, sales_join)
            .group_by(Customer.id, Customer.name)
            .having(total_sales_expr > 0)
            .order_by(total_sales_expr.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            SalesByCustomerResponse(
                customer=row.customer,
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
    ) -> list[SalesByProductDistributionResponse]:
        product_key = func.coalesce(
            Product.name, QuoteItem.sku, literal("Sin producto")
        )
        stmt = (
            select(
                product_key.label("product"),
                func.coalesce(func.sum(QuoteItem.subtotal), 0).label("revenue"),
            )
            .select_from(QuoteItem)
            .join(Quote, Quote.id == QuoteItem.quote_id)
            .outerjoin(Product, Product.id == QuoteItem.product_id)
            .where(_approved_quote_condition())
            .group_by(product_key)
            .order_by(func.coalesce(func.sum(QuoteItem.subtotal), 0).desc())
            .limit(limit)
        )
        stmt = _apply_approved_on_filter(stmt, start_date, end_date)
        rows = (await self.db.execute(stmt)).all()
        total_revenue = sum(_to_float(row.revenue) for row in rows)

        return [
            SalesByProductDistributionResponse(
                product=row.product,
                revenue=_to_float(row.revenue),
                percentage=(
                    _to_float(row.revenue) / total_revenue * 100.0
                    if total_revenue > 0
                    else 0.0
                ),
            )
            for row in rows
        ]

    async def sales_vs_projection_by_month(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[SalesProjectionByMonthResponse]:
        month_key = func.to_char(
            func.coalesce(Quote.approved_on, Quote.created_on), "YYYY-MM"
        )

        actual_stmt = (
            select(
                month_key.label("year_month"),
                func.coalesce(func.sum(Quote.subtotal), 0).label("actual_sales"),
            )
            .select_from(Quote)
            .join(Sale, Sale.quote_id == Quote.id)
            .where(_approved_quote_condition())
            .order_by(month_key.asc())
            .group_by(month_key)
        )
        actual_stmt = _apply_quote_created_filter(actual_stmt, start_date, end_date)
        actual_rows = [
            row
            for row in (await self.db.execute(actual_stmt)).all()
            if row.year_month is not None
        ]

        projection_stmt = (
            select(
                month_key.label("year_month"),
                func.coalesce(func.sum(Quote.subtotal), 0).label("projected_base"),
            )
            .select_from(Quote)
            .where(_approved_quote_condition())
            .order_by(month_key.asc())
            .group_by(month_key)
        )
        projection_stmt = _apply_quote_created_filter(
            projection_stmt, start_date, end_date
        )
        projection_rows = [
            row
            for row in (await self.db.execute(projection_stmt)).all()
            if row.year_month is not None
        ]

        actual_by_month = {
            row.year_month: _to_float(row.actual_sales) for row in actual_rows
        }
        projected_base_by_month = {
            row.year_month: _to_float(row.projected_base) for row in projection_rows
        }
        months = sorted(
            set(actual_by_month.keys()) | set(projected_base_by_month.keys())
        )
        projected_bases = [projected_base_by_month.get(month, 0.0) for month in months]
        projected_series = [
            _compute_projected_sales(projected_bases, index)
            for index, _ in enumerate(months)
        ]

        return [
            SalesProjectionByMonthResponse(
                year_month=month,
                actual_sales=actual_by_month.get(month, 0.0),
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
        amount_value = func.coalesce(Quote.total, Quote.subtotal, 0)
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
    ) -> list[RecentQuoteResponse]:
        customer_name_expr = func.coalesce(Customer.name, literal("Sin cliente"))
        stmt = (
            select(
                Quote.id.label("id"),
                Quote.name.label("name"),
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
        rows = (await self.db.execute(stmt)).all()

        return [
            RecentQuoteResponse(
                id=row.id,
                name=row.name,
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
    ) -> list[MissingDemandResponse]:
        status_text = func.lower(func.coalesce(Quote.status, literal("")))
        active_condition = or_(
            status_text.like("%aprob%"),
            status_text.like("%pend%"),
            status_text.like("%seguim%"),
        )
        product_key = func.coalesce(
            Product.name, QuoteItem.sku, literal("Sin producto")
        )
        stmt = (
            select(
                product_key.label("product"),
                QuoteItem.sku.label("sku"),
                QuoteItem.category.label("category"),
                func.coalesce(func.sum(QuoteItem.qty_missing), 0).label(
                    "demanda_faltante"
                ),
                func.coalesce(func.sum(QuoteItem.subtotal), 0).label(
                    "valor_venta_pendiente"
                ),
                func.coalesce(func.sum(QuoteItem.purchase_subtotal), 0).label(
                    "costo_compra_estimado"
                ),
            )
            .select_from(QuoteItem)
            .join(Quote, Quote.id == QuoteItem.quote_id)
            .outerjoin(Product, Product.id == QuoteItem.product_id)
            .where(active_condition)
            .where(QuoteItem.qty_missing > 0)
            .group_by(product_key, QuoteItem.sku, QuoteItem.category)
            .order_by(func.coalesce(func.sum(QuoteItem.qty_missing), 0).desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
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
        )

        rows = (
            await self.db.execute(
                sql,
                {
                    "start_date": start_date,
                    "end_date": end_date,
                    "months_window": months_window,
                    "limit": limit,
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

        Compara compras de los ultimos 90 dias contra los 90 dias previos.
        """
        sql = text(
            """
            WITH compras_cliente AS (
                SELECT
                    v.customer_id,
                    COALESCE(c.name, 'Sin cliente') AS customer_name,
                    SUM(CASE
                        WHEN v.sold_on >= CURRENT_DATE - INTERVAL '90 days'
                        THEN COALESCE(v.total, 0)
                        ELSE 0
                    END) AS compras_ult_90,
                    SUM(CASE
                        WHEN v.sold_on >= CURRENT_DATE - INTERVAL '180 days'
                         AND v.sold_on < CURRENT_DATE - INTERVAL '90 days'
                        THEN COALESCE(v.total, 0)
                        ELSE 0
                    END) AS compras_90_previos,
                    MAX(v.sold_on) AS ultima_compra
                FROM ventas v
                LEFT JOIN clientes c
                    ON v.customer_id = c.id
                WHERE v.status NOT IN ('cancelada', 'cancelado')
                GROUP BY
                    v.customer_id,
                    c.name
            )
            SELECT
                customer_id,
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
            ORDER BY
                CASE
                    WHEN compras_90_previos > 0 AND compras_ult_90 = 0 THEN 1
                    WHEN compras_ult_90 < compras_90_previos * 0.5 THEN 2
                    WHEN compras_ult_90 < compras_90_previos * 0.8 THEN 3
                    ELSE 4
                END,
                ultima_compra ASC
            """
        )

        rows = (await self.db.execute(sql)).all()

        return [
            AtRiskCustomerResponse(
                customer_id=row.customer_id,
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
        """Venta promedio por cliente desglosado por tipo (Local vs Foraneo).

        Solo considera cotizaciones aprobadas.
        """
        approved_condition = _approved_quote_condition()
        start_dt, end_dt = _date_range_to_datetimes(start_date, end_date)

        quote_join = Quote.customer_id == Customer.id
        if start_dt is not None:
            quote_join = and_(
                quote_join,
                func.coalesce(Quote.created_on, Quote.created_at) >= start_dt,
            )
        if end_dt is not None:
            quote_join = and_(
                quote_join,
                func.coalesce(Quote.created_on, Quote.created_at) < end_dt,
            )

        ventas_por_cliente = (
            select(
                Customer.id.label("customer_id"),
                Customer.category.label("tipo_cliente"),
                func.coalesce(func.sum(Quote.subtotal), 0).label(
                    "ventas_totales_cliente"
                ),
            )
            .select_from(Customer)
            .outerjoin(Quote, and_(quote_join, approved_condition))
            .where(Customer.category.in_(["Local", "Foraneo"]))
            .group_by(Customer.id, Customer.category)
        ).cte("ventas_por_cliente")

        stmt = (
            select(
                ventas_por_cliente.c.tipo_cliente,
                func.count(ventas_por_cliente.c.customer_id).label("numero_clientes"),
                func.avg(ventas_por_cliente.c.ventas_totales_cliente).label(
                    "venta_promedio_por_cliente"
                ),
            )
            .group_by(ventas_por_cliente.c.tipo_cliente)
            .order_by(ventas_por_cliente.c.tipo_cliente)
        )

        rows = (await self.db.execute(stmt)).all()
        return [
            AvgSalesByCustomerTypeResponse(
                tipo_cliente=row.tipo_cliente,
                numero_clientes=int(row.numero_clientes),
                venta_promedio_por_cliente=_to_float(row.venta_promedio_por_cliente),
            )
            for row in rows
            if row.tipo_cliente is not None
        ]

    async def monthly_growth_yoy_by_customer_type(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[MonthlyGrowthYoYByCustomerTypeResponse]:
        base_date = end_date or start_date or date.today()
        month_start = date(base_date.year, base_date.month, 1)
        month_start_last_year = date(base_date.year - 1, base_date.month, 1)

        def add_month(d: date) -> date:
            if d.month == 12:
                return date(d.year + 1, 1, 1)
            return date(d.year, d.month + 1, 1)

        month_end = add_month(month_start)
        month_end_last_year = add_month(month_start_last_year)

        month_start_dt = datetime.combine(month_start, time.min, tzinfo=timezone.utc)
        month_end_dt = datetime.combine(month_end, time.min, tzinfo=timezone.utc)
        last_start_dt = datetime.combine(
            month_start_last_year, time.min, tzinfo=timezone.utc
        )
        last_end_dt = datetime.combine(
            month_end_last_year, time.min, tzinfo=timezone.utc
        )

        status_text = func.lower(func.coalesce(Sale.status, literal("")))
        not_cancelled = status_text.not_like("%cancel%")
        approved = status_text.like("%aprob%")
        sale_amount = func.coalesce(Sale.total, Sale.subtotal * 1.16, 0)

        ventas_mes_actual = func.coalesce(
            func.sum(
                case(
                    (
                        and_(
                            Sale.sold_on >= month_start_dt, Sale.sold_on < month_end_dt
                        ),
                        sale_amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("ventas_mes_actual")
        ventas_mes_anio_pasado = func.coalesce(
            func.sum(
                case(
                    (
                        and_(Sale.sold_on >= last_start_dt, Sale.sold_on < last_end_dt),
                        sale_amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("ventas_mismo_mes_anio_pasado")

        stmt = (
            select(
                Customer.category.label("tipo_cliente"),
                ventas_mes_actual,
                ventas_mes_anio_pasado,
            )
            .select_from(Customer)
            .outerjoin(
                Sale,
                and_(
                    Sale.customer_id == Customer.id,
                    Sale.sold_on >= last_start_dt,
                    Sale.sold_on < month_end_dt,
                    approved,
                    not_cancelled,
                ),
            )
            .where(Customer.category.in_(["Local", "Foraneo"]))
            .group_by(Customer.category)
            .order_by(Customer.category)
        )

        rows = (await self.db.execute(stmt)).all()
        results: list[MonthlyGrowthYoYByCustomerTypeResponse] = []
        for row in rows:
            current_value = _to_float(row.ventas_mes_actual)
            last_value = _to_float(row.ventas_mismo_mes_anio_pasado)
            growth = (
                round(((current_value - last_value) / last_value) * 100.0, 2)
                if last_value > 0
                else None
            )
            results.append(
                MonthlyGrowthYoYByCustomerTypeResponse(
                    tipo_cliente=str(row.tipo_cliente),
                    ventas_mes_actual=current_value,
                    ventas_mismo_mes_anio_pasado=last_value,
                    tasa_crecimiento_pct=growth,
                )
            )
        return results

    async def quarterly_growth_by_customer_type(
        self,
    ) -> list[QuarterlyGrowthByCustomerTypeResponse]:
        """Crecimiento trimestral por tipo de cliente (Local vs Foraneo).

        Compara el trimestre actual contra el mismo trimestre del año anterior.
        Solo considera cotizaciones aprobadas.
        """
        sql = text(
            """
            WITH ventas_periodo AS (
                SELECT
                    cl.category AS tipo_cliente,
                    SUM(CASE
                        WHEN DATE_TRUNC('quarter', COALESCE(q.approved_on, q.created_on))
                            = DATE_TRUNC('quarter', CURRENT_DATE)
                        THEN COALESCE(q.subtotal, 0)
                        ELSE 0
                    END) AS ventas_trim_actual,
                    SUM(CASE
                        WHEN DATE_TRUNC('quarter', COALESCE(q.approved_on, q.created_on))
                            = DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '1 year')
                        THEN COALESCE(q.subtotal, 0)
                        ELSE 0
                    END) AS ventas_trim_anio_pasado
                FROM cotizaciones q
                LEFT JOIN clientes cl ON q.customer_id = cl.id
                WHERE (
                    q.approved_on IS NOT NULL
                    OR LOWER(COALESCE(q.status, '')) LIKE '%aprob%'
                )
                AND cl.category IN ('Local', 'Foraneo')
                GROUP BY cl.category
            )
            SELECT
                tipo_cliente,
                ventas_trim_actual,
                ventas_trim_anio_pasado,
                CASE
                    WHEN ventas_trim_anio_pasado = 0 THEN NULL
                    ELSE ROUND(
                        ((ventas_trim_actual - ventas_trim_anio_pasado)
                        / ventas_trim_anio_pasado) * 100, 2
                    )
                END AS crecimiento_trimestral_pct
            FROM ventas_periodo
            ORDER BY crecimiento_trimestral_pct DESC NULLS LAST
            """
        )

        rows = (await self.db.execute(sql)).all()
        return [
            QuarterlyGrowthByCustomerTypeResponse(
                tipo_cliente=row.tipo_cliente,
                ventas_trim_actual=float(row.ventas_trim_actual),
                ventas_trim_anio_pasado=float(row.ventas_trim_anio_pasado),
                crecimiento_trimestral_pct=(
                    float(row.crecimiento_trimestral_pct)
                    if row.crecimiento_trimestral_pct is not None
                    else None
                ),
            )
            for row in rows
            if row.tipo_cliente is not None
        ]

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
            "LOWER(c.status) = 'aprobada'",
            "cl.category IN ('Local', 'Foraneo')",
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
                cl.category AS tipo_cliente,
                SUM(COALESCE(ci.qty_packed, ci.qty_requested, 0)) AS cantidad_productos
            FROM cotizacion_items ci
            INNER JOIN cotizaciones c ON ci.quote_id = c.id
            LEFT JOIN clientes cl ON c.customer_id = cl.id
            WHERE {where_clause}
            GROUP BY cl.category
            ORDER BY cl.category
            """
        )
        rows = (await self.db.execute(sql, params)).all()
        return [
            ProductsByCustomerTypeResponse(
                tipo_cliente=row.tipo_cliente,
                cantidad_productos=float(row.cantidad_productos),
            )
            for row in rows
        ]

    async def sales_by_customer_type(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> list[SalesByCustomerTypeResponse]:
        """Monto total vendido por tipo de cliente (Local vs Foraneo).

        Se calcula desde cotizaciones aprobadas (Quote.subtotal) para no depender
        de que exista un registro en la tabla ventas.
        """
        stmt = (
            select(
                Customer.category.label("tipo_cliente"),
                func.coalesce(func.sum(Quote.subtotal), 0).label("total_ventas"),
            )
            .select_from(Quote)
            .join(Customer, Customer.id == Quote.customer_id)
            .where(_approved_quote_condition())
            .where(Customer.category.in_(["Local", "Foraneo"]))
            .group_by(Customer.category)
            .order_by(func.coalesce(func.sum(Quote.subtotal), 0).desc())
        )
        stmt = _apply_quote_created_filter(stmt, start_date, end_date)

        rows = (await self.db.execute(stmt)).all()
        total = sum(_to_float(row.total_ventas) for row in rows)

        return [
            SalesByCustomerTypeResponse(
                tipo_cliente=row.tipo_cliente,
                total_ventas=_to_float(row.total_ventas),
                porcentaje_ventas=(
                    round(_to_float(row.total_ventas) / total * 100, 2)
                    if total > 0
                    else 0.0
                ),
            )
            for row in rows
            if row.tipo_cliente is not None
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
