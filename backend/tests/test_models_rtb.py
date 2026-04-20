from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_models import (
    Brand,
    Customer,
    InventoryGrowth,
    InventoryItem,
    InventoryMovement,
    NonConformity,
    Product,
    PurchaseInvoice,
    Quote,
    QuoteItem,
    Supplier,
    SupplierProduct,
)
from app.services.rollups import (
    AbcRollupService,
    AgingRollupService,
    InventorySnapshotsService,
)


@pytest.mark.asyncio
async def test_generated_columns_purchase_invoice(db_session: AsyncSession) -> None:
    invoice = PurchaseInvoice(
        quote_number="Q-1",
        invoice_number="F-1",
        subtotal=100,
        shipping_cost=10,
        invoice_discount=5,
        shipping_insurance_discount=0,
    )
    db_session.add(invoice)
    await db_session.commit()
    await db_session.refresh(invoice)

    assert float(invoice.iva) == 17.6
    assert float(invoice.total) == 122.6


@pytest.mark.asyncio
async def test_triggers_quote_and_product_rollups(db_session: AsyncSession) -> None:
    customer = Customer(external_id="C-1", name="ACME")
    product = Product(sku="SKU-1", internal_code="P-1", name="Widget")
    quote = Quote(
        name="Q-1",
        customer=customer,
        status="Aprobada",
        created_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
    )
    item = QuoteItem(
        quote=quote,
        product=product,
        sku="SKU-1",
        qty_requested=10,
        qty_packed=6,
        unit_cost_sale=100,
        unit_cost_purchase=70,
        last_updated_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([customer, product, quote, item])
    await db_session.commit()

    await db_session.refresh(quote)
    await db_session.refresh(product)

    assert quote.missing_products == 4
    assert float(quote.packed_percent) == 60.0
    assert quote.order_status == "Parcial"

    assert float(product.theoretical_outflow) == 10.0
    assert float(product.real_outflow) == 6.0
    assert float(product.total_accumulated_sales) == 1000.0


@pytest.mark.asyncio
async def test_triggers_product_pricing(db_session: AsyncSession) -> None:
    brand = Brand(name="Marca 1", markup_percent=0.1)
    supplier = Supplier(external_id="S-1", name="Proveedor 1")
    product = Product(sku="SKU-1", internal_code="P-1", name="Widget", brand_ref=brand)
    db_session.add_all([brand, supplier, product])
    await db_session.flush()

    db_session.add(
        SupplierProduct(
            product_id=product.id,
            supplier_id=supplier.id,
            price=100,
            supplier_type="Principal",
        )
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert float(product.unit_price_base) == 100.0
    assert float(product.unit_price) == 110.0


@pytest.mark.asyncio
async def test_triggers_inventory_rollups_and_nonconformity(
    db_session: AsyncSession,
) -> None:
    product = Product(sku="SKU-1", internal_code="P-1", name="Widget")
    inventory = InventoryItem(product=product, unit_cost=10, min_stock=5)
    db_session.add_all([product, inventory])
    await db_session.flush()

    db_session.add(
        InventoryMovement(
            product_id=product.id,
            movement_type="Entrada",
            qty_in=10,
            moved_on=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()
    await db_session.refresh(inventory)

    assert float(inventory.inbound_real) == 10.0
    assert float(inventory.outbound_real) == 0.0
    assert float(inventory.nonconformity_adjustment) == 0.0
    assert float(inventory.real_qty) == 10.0
    assert float(inventory.stock_total_cost) == 100.0
    assert inventory.status_real == "En stock"
    assert inventory.stock_alert == "OK"

    nc = NonConformity(
        folio="NC-1",
        detected_on=date(2026, 4, 11),
        quantity=2,
        action_taken="Ajuste",
        adjustment_type="Salida",
        inventory_item_id=inventory.id,
        product_id=product.id,
    )
    db_session.add(nc)
    await db_session.commit()
    await db_session.refresh(nc)
    await db_session.refresh(inventory)

    assert float(nc.inventory_adjustment) == -2.0
    assert float(inventory.real_qty) == 8.0
    assert float(inventory.stock_total_cost) == 80.0


@pytest.mark.asyncio
async def test_rollup_services(db_session: AsyncSession) -> None:
    product = Product(sku="SKU-1", internal_code="P-1", name="Widget")
    inventory = InventoryItem(
        product=product,
        last_outbound_on=date.today() - timedelta(days=40),
        total_accumulated_sales=60000,
        stock_total_cost=100,
    )
    db_session.add_all([product, inventory])
    await db_session.commit()

    await AgingRollupService(db_session).recompute()
    await AbcRollupService(db_session).recompute()
    await db_session.refresh(inventory)

    assert inventory.aging_classification == "Rotación baja"
    assert inventory.abc_classification == "A"

    created = await InventorySnapshotsService(db_session).snapshot_month(
        date(2026, 4, 1)
    )
    created_ids = {row.id for row in created}
    stmt = select(InventoryGrowth).where(InventoryGrowth.id.in_(created_ids))
    rows = (await db_session.execute(stmt)).scalars().all()
    assert len(rows) == len(created)
