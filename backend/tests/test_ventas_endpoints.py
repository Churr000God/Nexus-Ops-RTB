from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.ops_models import (
    CancelledQuote,
    Customer,
    CustomerOrder,
    Product,
    Quote,
    QuoteItem,
    Sale,
)


@pytest.mark.asyncio
async def test_sales_by_month(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    customer = Customer(external_id="CUST-1", name="ACME")
    db_session.add(customer)
    await db_session.flush()

    sale_apr = Sale(
        name="Sale Apr",
        sold_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
        customer_id=customer.id,
        subtotal=1000,
        purchase_cost=800,
    )
    sale_may = Sale(
        name="Sale May",
        sold_on=datetime(2026, 5, 5, 12, 0, tzinfo=timezone.utc),
        customer_id=customer.id,
        subtotal=500,
        purchase_cost=450,
    )
    db_session.add_all([sale_apr, sale_may])
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/ventas/by-month", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert {row["year_month"] for row in data} == {"2026-04", "2026-05"}
    apr = next(row for row in data if row["year_month"] == "2026-04")
    assert apr["sale_count"] == 1
    assert apr["total_revenue"] == 1160.0
    assert apr["total_gross_margin"] == 200.0


@pytest.mark.asyncio
async def test_sales_by_customer(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    acme = Customer(external_id="CUST-1", name="ACME")
    globex = Customer(external_id="CUST-2", name="Globex")
    db_session.add_all([acme, globex])
    await db_session.flush()

    db_session.add_all(
        [
            Sale(
                name="Sale 1",
                sold_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
                customer_id=acme.id,
                subtotal=1000,
            ),
            Sale(
                name="Sale 2",
                sold_on=datetime(2026, 4, 11, 12, 0, tzinfo=timezone.utc),
                customer_id=acme.id,
                subtotal=500,
            ),
            Sale(
                name="Sale 3",
                sold_on=datetime(2026, 4, 12, 12, 0, tzinfo=timezone.utc),
                customer_id=globex.id,
                subtotal=100,
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/ventas/by-customer?limit=10", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["customer"] == "ACME"
    assert data[0]["sale_count"] == 2
    assert data[0]["total_revenue"] == 1740.0
    assert data[0]["average_ticket"] == 870.0


@pytest.mark.asyncio
async def test_gross_margin_by_product(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    customer = Customer(external_id="CUST-1", name="ACME")
    product = Product(sku="SKU-1", internal_code="P-1", name="Widget")
    quote = Quote(
        name="Q-1",
        customer=customer,
        approved_on=datetime(2026, 4, 15, 8, 0, tzinfo=timezone.utc),
    )
    item = QuoteItem(
        quote=quote,
        product=product,
        sku="SKU-1",
        qty_requested=10,
        qty_packed=10,
        unit_cost_sale=100,
        unit_cost_purchase=70,
    )
    db_session.add_all([customer, product, quote, item])
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/ventas/gross-margin-by-product?start_date=2026-04-01&end_date=2026-04-30",
            headers=auth_header,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["product"] == "Widget"
    assert data[0]["qty"] == 10.0
    assert data[0]["revenue"] == 1000.0
    assert data[0]["cost"] == 700.0
    assert data[0]["gross_margin"] == 300.0
    assert round(data[0]["margin_percent"], 2) == 30.0


@pytest.mark.asyncio
async def test_approved_vs_cancelled_by_month(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    quote_approved = Quote(
        name="Q-OK",
        approved_on=datetime(2026, 4, 1, 8, 0, tzinfo=timezone.utc),
    )
    quote_cancelled = Quote(name="Q-CANCEL")
    cancelled = CancelledQuote(
        quote=quote_cancelled,
        quote_number="Q-CANCEL",
        cancelled_on=date(2026, 4, 2),
        reason="x",
    )
    db_session.add_all([quote_approved, quote_cancelled, cancelled])
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/ventas/approved-vs-cancelled?start_date=2026-04-01&end_date=2026-04-30",
            headers=auth_header,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data == [
        {"year_month": "2026-04", "approved_count": 1, "cancelled_count": 1}
    ]


@pytest.mark.asyncio
async def test_dashboard_overview(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    sale = Sale(
        name="S1",
        sold_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
        subtotal=1000,
        purchase_cost=750,
    )
    quote = Quote(
        name="Q1", approved_on=datetime(2026, 4, 9, 8, 0, tzinfo=timezone.utc)
    )
    cancelled = CancelledQuote(
        quote_number="QX", cancelled_on=date(2026, 4, 8), reason="x"
    )
    db_session.add_all([sale, quote, cancelled])
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/dashboard?start_date=2026-04-01&end_date=2026-04-30",
            headers=auth_header,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sale_count"] == 1
    assert data["total_revenue"] == 1160.0
    assert data["total_gross_margin"] == 250.0
    assert data["approved_quotes"] == 1
    assert data["cancelled_quotes"] == 1


@pytest.mark.asyncio
async def test_sales_summary_and_top_customers(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    acme = Customer(external_id="CUST-SUM-1", name="ACME")
    globex = Customer(external_id="CUST-SUM-2", name="Globex")
    db_session.add_all([acme, globex])
    await db_session.flush()

    approved_quote = Quote(
        name="Q-Approved",
        customer_id=acme.id,
        status="Aprobada",
        created_on=datetime(2026, 4, 3, 9, 0, tzinfo=timezone.utc),
        approved_on=datetime(2026, 4, 4, 9, 0, tzinfo=timezone.utc),
        subtotal=1000,
    )
    db_session.add(approved_quote)
    await db_session.flush()

    db_session.add_all(
        [
            Sale(
                name="Sale Summary 1",
                sold_on=datetime(2026, 4, 5, 12, 0, tzinfo=timezone.utc),
                customer_id=acme.id,
                quote_id=approved_quote.id,
                subtotal=1000,
                purchase_cost=750,
            ),
            Sale(
                name="Sale Summary 2",
                sold_on=datetime(2026, 4, 6, 12, 0, tzinfo=timezone.utc),
                customer_id=globex.id,
                subtotal=500,
                purchase_cost=350,
            ),
            Quote(
                name="Q-Pending",
                customer_id=acme.id,
                status="En revisión",
                created_on=datetime(2026, 4, 7, 9, 0, tzinfo=timezone.utc),
                subtotal=400,
            ),
            Quote(
                name="Q-Expired",
                customer_id=globex.id,
                status="Expirada",
                created_on=datetime(2026, 4, 8, 9, 0, tzinfo=timezone.utc),
                subtotal=300,
            ),
            Quote(
                name="Q-Cancelled",
                customer_id=globex.id,
                status="Cancelada",
                created_on=datetime(2026, 4, 9, 9, 0, tzinfo=timezone.utc),
                subtotal=200,
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        summary_resp = await client.get(
            "/api/ventas/summary?start_date=2026-04-01&end_date=2026-04-30",
            headers=auth_header,
        )
        top_customers_resp = await client.get(
            "/api/ventas/top-customers?start_date=2026-04-01&end_date=2026-04-30&limit=10",
            headers=auth_header,
        )

    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["total_sales"] == 1500.0
    assert summary["pending_quotes"] == 1
    assert summary["average_margin_percent"] == pytest.approx(27.5, rel=1e-9)
    assert summary["conversion_rate"] == 25.0
    assert summary["total_quotes"] == 4
    assert summary["approved_quotes"] == 1
    assert summary["cancelled_quotes"] == 1
    assert summary["expired_quotes"] == 1
    assert summary["review_quotes"] == 1

    assert top_customers_resp.status_code == 200
    top_customers = top_customers_resp.json()
    assert top_customers[0]["customer"] == "ACME"
    assert top_customers[0]["total_revenue"] == 1000.0


@pytest.mark.asyncio
async def test_sales_projection_and_product_distribution(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    customer = Customer(external_id="CUST-PROJ-1", name="Projection Co")
    product_a = Product(sku="SKU-P1", internal_code="P-101", name="Laptop Pro X1")
    product_b = Product(sku="SKU-P2", internal_code="P-102", name="Monitor 4K")
    db_session.add_all([customer, product_a, product_b])
    await db_session.flush()

    approved_quotes = [
        Quote(
            name="Q-Jan",
            customer_id=customer.id,
            status="Aprobada",
            created_on=datetime(2026, 1, 10, 9, 0, tzinfo=timezone.utc),
            approved_on=datetime(2026, 1, 11, 9, 0, tzinfo=timezone.utc),
            subtotal=100,
        ),
        Quote(
            name="Q-Feb",
            customer_id=customer.id,
            status="Aprobada",
            created_on=datetime(2026, 2, 10, 9, 0, tzinfo=timezone.utc),
            approved_on=datetime(2026, 2, 11, 9, 0, tzinfo=timezone.utc),
            subtotal=200,
        ),
        Quote(
            name="Q-Mar",
            customer_id=customer.id,
            status="Aprobada",
            created_on=datetime(2026, 3, 10, 9, 0, tzinfo=timezone.utc),
            approved_on=datetime(2026, 3, 11, 9, 0, tzinfo=timezone.utc),
            subtotal=300,
        ),
        Quote(
            name="Q-Apr",
            customer_id=customer.id,
            status="Aprobada",
            created_on=datetime(2026, 4, 10, 9, 0, tzinfo=timezone.utc),
            approved_on=datetime(2026, 4, 11, 9, 0, tzinfo=timezone.utc),
            subtotal=400,
        ),
    ]
    db_session.add_all(approved_quotes)
    await db_session.flush()

    db_session.add_all(
        [
            Sale(
                name="Jan Sale",
                sold_on=datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc),
                customer_id=customer.id,
                quote_id=approved_quotes[0].id,
                subtotal=100,
                purchase_cost=70,
            ),
            Sale(
                name="Feb Sale",
                sold_on=datetime(2026, 2, 10, 12, 0, tzinfo=timezone.utc),
                customer_id=customer.id,
                quote_id=approved_quotes[1].id,
                subtotal=200,
                purchase_cost=140,
            ),
            Sale(
                name="Mar Sale",
                sold_on=datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc),
                customer_id=customer.id,
                quote_id=approved_quotes[2].id,
                subtotal=300,
                purchase_cost=210,
            ),
            Sale(
                name="Apr Sale",
                sold_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
                customer_id=customer.id,
                quote_id=approved_quotes[3].id,
                subtotal=400,
                purchase_cost=280,
            ),
        ]
    )

    db_session.add_all(
        [
            QuoteItem(
                quote_id=approved_quotes[3].id,
                product_id=product_a.id,
                sku="SKU-P1",
                qty_requested=10,
                qty_packed=10,
                unit_cost_sale=100,
                unit_cost_purchase=70,
            ),
            QuoteItem(
                quote_id=approved_quotes[3].id,
                product_id=product_b.id,
                sku="SKU-P2",
                qty_requested=5,
                qty_packed=5,
                unit_cost_sale=100,
                unit_cost_purchase=60,
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        projection_resp = await client.get(
            "/api/ventas/sales-vs-projection?start_date=2026-01-01&end_date=2026-04-30",
            headers=auth_header,
        )
        distribution_resp = await client.get(
            "/api/ventas/product-distribution?start_date=2026-04-01&end_date=2026-04-30&limit=10",
            headers=auth_header,
        )

    assert projection_resp.status_code == 200
    projection = projection_resp.json()
    assert [row["year_month"] for row in projection] == [
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
    ]
    assert projection[3]["actual_sales"] == 400.0
    assert projection[3]["projected_sales"] == 350.0

    assert distribution_resp.status_code == 200
    distribution = distribution_resp.json()
    assert distribution[0]["product"] == "Laptop Pro X1"
    assert distribution[0]["revenue"] == 1000.0
    assert round(distribution[0]["percentage"], 2) == 66.67
    assert round(distribution[1]["percentage"], 2) == 33.33


@pytest.mark.asyncio
async def test_quote_status_by_month_and_recent_quotes(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    customer = Customer(external_id="CUST-Q-1", name="TechCorp SA")
    db_session.add(customer)
    await db_session.flush()

    db_session.add_all(
        [
            Quote(
                name="COT-2024-0160",
                customer_id=customer.id,
                status="Pendiente",
                created_on=None,
                created_at=datetime(2026, 4, 19, 10, 0, tzinfo=timezone.utc),
                subtotal=12345,
            ),
            Quote(
                name="COT-2024-0155",
                customer_id=customer.id,
                status="En Cotización",
                created_on=datetime(2026, 4, 15, 9, 0, tzinfo=timezone.utc),
                created_at=datetime(2026, 4, 15, 9, 0, tzinfo=timezone.utc),
                subtotal=1111,
            ),
            Quote(
                name="COT-2024-0156",
                customer_id=customer.id,
                status="Pendiente",
                created_on=datetime(2026, 4, 18, 9, 0, tzinfo=timezone.utc),
                created_at=datetime(2026, 4, 18, 9, 0, tzinfo=timezone.utc),
                subtotal=45200,
            ),
            Quote(
                name="COT-2024-0157",
                customer_id=customer.id,
                status="Aprobada",
                created_on=datetime(2026, 4, 17, 9, 0, tzinfo=timezone.utc),
                approved_on=datetime(2026, 4, 17, 12, 0, tzinfo=timezone.utc),
                created_at=datetime(2026, 4, 17, 9, 0, tzinfo=timezone.utc),
                subtotal=28700,
            ),
            Quote(
                name="COT-2024-0158",
                customer_id=customer.id,
                status="Expirada",
                created_on=datetime(2026, 4, 16, 9, 0, tzinfo=timezone.utc),
                created_at=datetime(2026, 4, 16, 9, 0, tzinfo=timezone.utc),
                subtotal=63800,
            ),
            Quote(
                name="COT-2024-0159",
                customer_id=customer.id,
                status="Rechazada",
                created_on=datetime(2026, 3, 16, 9, 0, tzinfo=timezone.utc),
                created_at=datetime(2026, 3, 16, 9, 0, tzinfo=timezone.utc),
                subtotal=15200,
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        status_resp = await client.get(
            "/api/ventas/quote-status-by-month?start_date=2026-03-01&end_date=2026-04-30",
            headers=auth_header,
        )
        recent_resp = await client.get(
            "/api/ventas/recent-quotes?limit=10",
            headers=auth_header,
        )

    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert [row["year_month"] for row in status_data] == ["2026-03", "2026-04"]

    march = status_data[0]
    assert march["approved_count"] == 0
    assert march["cancelled_count"] == 0
    assert march["expired_count"] == 0
    assert march["review_count"] == 0
    assert march["quoting_count"] == 0
    assert march["rejected_count"] == 1
    assert march["approved_amount"] == 0.0
    assert march["cancelled_amount"] == 0.0
    assert march["expired_amount"] == 0.0
    assert march["review_amount"] == 0.0
    assert march["quoting_amount"] == 0.0
    assert march["rejected_amount"] == pytest.approx(17632.0)

    april = status_data[1]
    assert april["approved_count"] == 1
    assert april["cancelled_count"] == 0
    assert april["expired_count"] == 1
    assert april["review_count"] == 2
    assert april["quoting_count"] == 1
    assert april["rejected_count"] == 0
    assert april["approved_amount"] == pytest.approx(33292.0)
    assert april["cancelled_amount"] == 0.0
    assert april["expired_amount"] == pytest.approx(74008.0)
    assert april["review_amount"] == pytest.approx(66752.2)
    assert april["quoting_amount"] == pytest.approx(1288.76)
    assert april["rejected_amount"] == 0.0

    assert recent_resp.status_code == 200
    recent_quotes = recent_resp.json()
    assert recent_quotes[0]["name"] == "COT-2024-0160"
    assert recent_quotes[0]["created_on"] is not None
    assert recent_quotes[0]["customer_name"] == "TechCorp SA"
    assert recent_quotes[0]["can_convert"] is True
    assert recent_quotes[1]["name"] == "COT-2024-0156"
    assert recent_quotes[1]["can_convert"] is True
    assert recent_quotes[2]["can_convert"] is False


@pytest.mark.asyncio
async def test_payment_trend(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    customer = Customer(external_id="CUST-PAY-1", name="Pagos SA")
    db_session.add(customer)
    await db_session.flush()

    db_session.add_all(
        [
            CustomerOrder(
                name="ORD-1",
                customer_id=customer.id,
                invoiced_on=date(2026, 1, 1),
                paid_on=date(2026, 1, 11),
            ),
            CustomerOrder(
                name="ORD-2",
                customer_id=customer.id,
                invoiced_on=date(2026, 2, 1),
                paid_on=date(2026, 2, 21),
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/ventas/payment-trend?start_date=2026-01-01&end_date=2026-04-30&limit=20",
            headers=auth_header,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["customer_name"] == "Pagos SA"
    assert data[0]["promedio_dias_pago"] == pytest.approx(15.0)
    assert data[0]["ultimo_pago"] == "2026-02-21"
    assert data[0]["riesgo_pago"] == "Bajo"


@pytest.mark.asyncio
async def test_monthly_growth_yoy_by_customer_type(
    db_session: AsyncSession, auth_header: dict[str, str]
) -> None:
    local_customer = Customer(
        external_id="CUST-LOCAL", name="Local SA", category="Local"
    )
    foraneo_customer = Customer(
        external_id="CUST-FOR", name="Foraneo SA", category="Foraneo"
    )
    db_session.add_all([local_customer, foraneo_customer])
    await db_session.flush()

    db_session.add_all(
        [
            Sale(
                name="Local current",
                sold_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
                customer_id=local_customer.id,
                status="Aprobada",
                subtotal=1000,
            ),
            Sale(
                name="Local last year",
                sold_on=datetime(2025, 4, 11, 12, 0, tzinfo=timezone.utc),
                customer_id=local_customer.id,
                status="Aprobada",
                subtotal=500,
            ),
            Sale(
                name="Foraneo current",
                sold_on=datetime(2026, 4, 5, 12, 0, tzinfo=timezone.utc),
                customer_id=foraneo_customer.id,
                status="Aprobada",
                subtotal=200,
            ),
            Sale(
                name="Foraneo last year",
                sold_on=datetime(2025, 4, 7, 12, 0, tzinfo=timezone.utc),
                customer_id=foraneo_customer.id,
                status="Aprobada",
                subtotal=400,
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/ventas/monthly-growth-yoy-by-customer-type?end_date=2026-04-15",
            headers=auth_header,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert {row["tipo_cliente"] for row in data} == {"Local", "Foraneo"}

    local_row = next(row for row in data if row["tipo_cliente"] == "Local")
    assert local_row["ventas_mes_actual"] == 1160.0
    assert local_row["ventas_mismo_mes_anio_pasado"] == 580.0
    assert local_row["tasa_crecimiento_pct"] == 100.0

    for_row = next(row for row in data if row["tipo_cliente"] == "Foraneo")
    assert for_row["ventas_mes_actual"] == 232.0
    assert for_row["ventas_mismo_mes_anio_pasado"] == 464.0
    assert for_row["tasa_crecimiento_pct"] == -50.0
