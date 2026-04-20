from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.ops_models import (
    CancelledQuote,
    Customer,
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
