from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.venta_schema import (
    ApprovedVsCancelledByMonthResponse,
    AtRiskCustomerResponse,
    AvgSalesByCustomerTypeResponse,
    GrossMarginByProductResponse,
    MissingDemandResponse,
    MonthlyGrowthYoYByCustomerTypeResponse,
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
    CustomerPaymentStatResponse,
    CustomerSearchItemResponse,
    PendingPaymentStatResponse,
    SalesSummaryResponse,
)
from app.services.ventas_service import VentasService

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


@router.get("/", response_model=list[SaleResponse])
async def list_sales(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SaleResponse]:
    service = VentasService(db)
    return await service.list_sales(
        start_date=start_date, end_date=end_date, limit=limit, offset=offset
    )


@router.get("/summary", response_model=SalesSummaryResponse)
async def sales_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SalesSummaryResponse:
    service = VentasService(db)
    return await service.sales_summary(start_date=start_date, end_date=end_date)


@router.get("/by-month", response_model=list[SalesByMonthResponse])
async def sales_by_month(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByMonthResponse]:
    service = VentasService(db)
    return await service.sales_by_month(start_date=start_date, end_date=end_date)


@router.get("/sales-vs-projection", response_model=list[SalesProjectionByMonthResponse])
async def sales_vs_projection(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesProjectionByMonthResponse]:
    service = VentasService(db)
    return await service.sales_vs_projection_by_month(
        start_date=start_date, end_date=end_date
    )


@router.get("/by-customer", response_model=list[SalesByCustomerResponse])
async def sales_by_customer(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByCustomerResponse]:
    service = VentasService(db)
    return await service.sales_by_customer(
        start_date=start_date, end_date=end_date, limit=limit
    )


@router.get("/sales-by-customer-type", response_model=list[SalesByCustomerTypeResponse])
async def sales_by_customer_type(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByCustomerTypeResponse]:
    service = VentasService(db)
    return await service.sales_by_customer_type(
        start_date=start_date, end_date=end_date
    )


@router.get("/top-customers", response_model=list[SalesByCustomerResponse])
async def top_customers(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    customer_search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByCustomerResponse]:
    service = VentasService(db)
    return await service.top_customers_by_sales(
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        customer_search=customer_search,
    )


@router.get(
    "/gross-margin-by-product", response_model=list[GrossMarginByProductResponse]
)
async def gross_margin_by_product(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    product_search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[GrossMarginByProductResponse]:
    service = VentasService(db)
    return await service.gross_margin_by_product(
        start_date=start_date, end_date=end_date, limit=limit, product_search=product_search
    )


@router.get(
    "/product-distribution",
    response_model=list[SalesByProductDistributionResponse],
)
async def product_distribution(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    product_search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByProductDistributionResponse]:
    service = VentasService(db)
    return await service.sales_distribution_by_product(
        start_date=start_date, end_date=end_date, limit=limit, product_search=product_search
    )


@router.get(
    "/approved-vs-cancelled", response_model=list[ApprovedVsCancelledByMonthResponse]
)
async def approved_vs_cancelled(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ApprovedVsCancelledByMonthResponse]:
    service = VentasService(db)
    return await service.approved_vs_cancelled_by_month(
        start_date=start_date, end_date=end_date
    )


@router.get("/quote-status-by-month", response_model=list[QuoteStatusByMonthResponse])
async def quote_status_by_month(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[QuoteStatusByMonthResponse]:
    service = VentasService(db)
    return await service.quote_status_by_month(start_date=start_date, end_date=end_date)


@router.get("/recent-quotes", response_model=list[RecentQuoteResponse])
async def recent_quotes(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[RecentQuoteResponse]:
    service = VentasService(db)
    return await service.recent_quotes(
        start_date=start_date, end_date=end_date, status=status, limit=limit, search=search
    )


@router.get("/missing-demand", response_model=list[MissingDemandResponse])
async def missing_demand(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    product_search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MissingDemandResponse]:
    service = VentasService(db)
    return await service.missing_demand_by_product(
        start_date=start_date, end_date=end_date, limit=limit, product_search=product_search
    )


@router.get("/product-forecast", response_model=list[SalesForecastByProductResponse])
async def product_forecast(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    months_window: int = Query(default=3, ge=1, le=12),
    product_search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesForecastByProductResponse]:
    service = VentasService(db)
    return await service.sales_forecast_by_product(
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        months_window=months_window,
        product_search=product_search,
    )


@router.get("/at-risk-customers", response_model=list[AtRiskCustomerResponse])
async def at_risk_customers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AtRiskCustomerResponse]:
    """Clientes en riesgo de abandono comparando compras de los ultimos 90 dias
    contra los 90 dias previos.
    """
    service = VentasService(db)
    return await service.at_risk_customers()


@router.get("/payment-trend", response_model=list[PaymentTrendResponse])
async def payment_trend(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PaymentTrendResponse]:
    service = VentasService(db)
    return await service.payment_trend(
        start_date=start_date, end_date=end_date, limit=limit
    )


@router.get(
    "/products-by-customer-type",
    response_model=list[ProductsByCustomerTypeResponse],
)
async def products_by_customer_type(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProductsByCustomerTypeResponse]:
    service = VentasService(db)
    return await service.products_by_customer_type(
        start_date=start_date, end_date=end_date
    )


@router.get(
    "/avg-sales-by-customer-type",
    response_model=list[AvgSalesByCustomerTypeResponse],
)
async def avg_sales_by_customer_type(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AvgSalesByCustomerTypeResponse]:
    """Venta promedio por cliente desglosado por tipo (Local vs Foraneo).

    Solo considera cotizaciones con estado Aprobada.
    """
    service = VentasService(db)
    return await service.avg_sales_by_customer_type(
        start_date=start_date, end_date=end_date
    )


@router.get(
    "/quarterly-growth-by-customer-type",
    response_model=list[QuarterlyGrowthByCustomerTypeResponse],
)
async def quarterly_growth_by_customer_type(
    selected_quarter: int | None = Query(default=None, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[QuarterlyGrowthByCustomerTypeResponse]:
    service = VentasService(db)
    return await service.quarterly_growth_by_customer_type(selected_quarter=selected_quarter)


@router.get(
    "/monthly-growth-yoy-by-customer-type",
    response_model=list[MonthlyGrowthYoYByCustomerTypeResponse],
)
async def monthly_growth_yoy_by_customer_type(
    selected_month: int | None = Query(default=None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MonthlyGrowthYoYByCustomerTypeResponse]:
    service = VentasService(db)
    return await service.monthly_growth_yoy_by_customer_type(
        selected_month=selected_month
    )


@router.get("/pending-payments", response_model=list[PendingPaymentCustomerResponse])
async def pending_payment_customers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PendingPaymentCustomerResponse]:
    service = VentasService(db)
    return await service.pending_payment_customers()


@router.get(
    "/customer-payment-stats",
    response_model=list[CustomerPaymentStatResponse],
)
async def customer_payment_stats(
    customer_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CustomerPaymentStatResponse]:
    service = VentasService(db)
    return await service.customer_payment_stats(customer_id=customer_id)


@router.get(
    "/customer-search",
    response_model=list[CustomerSearchItemResponse],
)
async def customer_search(
    q: str = Query(min_length=2, max_length=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CustomerSearchItemResponse]:
    service = VentasService(db)
    return await service.search_customers_payment(q=q)


@router.get(
    "/pending-payment-stats",
    response_model=list[PendingPaymentStatResponse],
)
async def pending_payment_stats(
    customer_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PendingPaymentStatResponse]:
    service = VentasService(db)
    return await service.pending_payment_stats(customer_id=customer_id)
