from __future__ import annotations

import hashlib
import json
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ops_models import Product, Category, Brand
from app.models.productos_pricing_models import (
    BOM,
    BOMItem,
    CustomerContractPrice,
    ProductAttribute,
    ProductAttributeOption,
    ProductConfiguration,
    ProductCostHistory,
    SATProductKey,
    SATUnitKey,
)
from app.schemas.productos_pricing_schema import (
    BOMCreate,
    BrandCreate,
    CategoryCreate,
    CategoryTreeNode,
    CategoryUpdate,
    CustomerContractPriceCreate,
    ProductAttributeCreate,
    ProductConfigurationCreate,
    ProductCreate,
    ProductDetailRead,
    ProductListResponse,
    ProductRead,
    ProductUpdate,
    QuotePricingResult,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _make_config_hash(attributes: dict) -> str:
    """SHA256 del JSONB con claves ordenadas (determinístico)."""
    canonical = json.dumps(attributes, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _build_category_tree(
    flat: list[Category],
) -> list[CategoryTreeNode]:
    """Convierte lista plana de categorías en árbol jerárquico."""
    by_id: dict = {}
    for c in flat:
        # Construct from scalar fields only — avoids lazy-loading c.children
        by_id[c.id] = CategoryTreeNode(
            id=c.id,
            parent_id=c.parent_id,
            name=c.name,
            slug=c.slug,
            description=c.description,
            profit_margin_percent=c.profit_margin_percent,
            is_active=c.is_active,
        )
    roots: list[CategoryTreeNode] = []
    for c in flat:
        node = by_id[c.id]
        if c.parent_id is None:
            roots.append(node)
        elif c.parent_id in by_id:
            by_id[c.parent_id].children.append(node)
    return roots


# ─────────────────────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────────────────────


class ProductosService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Products list ─────────────────────────────────────────────────────────

    async def get_products(
        self,
        limit: int = 100,
        offset: int = 0,
        category_id: UUID | None = None,
        brand_id: UUID | None = None,
        pricing_strategy: str | None = None,
        solo_activos: bool = True,
        search: str | None = None,
    ) -> ProductListResponse:
        # is_active se deriva del campo status (no hay columna is_active en productos)
        # min_stock no existe en la tabla actual — se devuelve como NULL
        sql = text("""
            SELECT
                p.id,
                p.sku,
                p.internal_code,
                p.name,
                p.description,
                p.brand_id,
                p.brand,
                p.category_id,
                p.category,
                p.sat_product_key_id,
                p.sat_unit_id,
                p.status,
                p.sale_type,
                p.package_size,
                p.warehouse_location,
                p.image_url,
                p.datasheet_url,
                p.unit_price,
                p.unit_price_base,
                p.purchase_cost_parts,
                p.purchase_cost_ariba,
                p.is_configurable,
                p.is_assembled,
                p.pricing_strategy,
                p.moving_avg_months,
                p.current_avg_cost,
                p.current_avg_cost_currency,
                p.current_avg_cost_updated_at,
                p.theoretical_outflow,
                p.real_outflow,
                p.demand_90_days,
                p.demand_180_days,
                p.total_accumulated_sales,
                p.last_outbound_date,
                NULL::numeric AS min_stock,
                p.created_at,
                p.updated_at,
                (p.status NOT IN ('Dado de Baja','Descontinuado','Inactivo')
                 OR p.status IS NULL) AS is_active,
                CASE
                    WHEN p.pricing_strategy = 'PASSTHROUGH' THEN p.current_avg_cost
                    WHEN p.current_avg_cost IS NOT NULL AND c.profit_margin_percent IS NOT NULL
                        THEN ROUND(p.current_avg_cost * (1 + c.profit_margin_percent / 100), 4)
                    ELSE p.current_avg_cost
                END AS suggested_price
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.category_id
            WHERE (:solo_activos = FALSE
                   OR p.status NOT IN ('Dado de Baja','Descontinuado','Inactivo')
                   OR p.status IS NULL)
              AND (CAST(:category_id AS uuid) IS NULL OR p.category_id = CAST(:category_id AS uuid))
              AND (CAST(:brand_id AS uuid) IS NULL OR p.brand_id = CAST(:brand_id AS uuid))
              AND (CAST(:pricing_strategy AS text) IS NULL OR p.pricing_strategy = CAST(:pricing_strategy AS text))
              AND (CAST(:search AS text) IS NULL OR (
                      lower(p.name) LIKE lower('%' || CAST(:search AS text) || '%')
                   OR lower(COALESCE(p.sku, '')) LIKE lower('%' || CAST(:search AS text) || '%')
                   OR lower(COALESCE(p.internal_code, '')) LIKE lower('%' || CAST(:search AS text) || '%')
                  ))
            ORDER BY p.name
            LIMIT :limit OFFSET :offset
        """)

        count_sql = text("""
            SELECT COUNT(*)
            FROM productos p
            WHERE (:solo_activos = FALSE
                   OR p.status NOT IN ('Dado de Baja','Descontinuado','Inactivo')
                   OR p.status IS NULL)
              AND (CAST(:category_id AS uuid) IS NULL OR p.category_id = CAST(:category_id AS uuid))
              AND (CAST(:brand_id AS uuid) IS NULL OR p.brand_id = CAST(:brand_id AS uuid))
              AND (CAST(:pricing_strategy AS text) IS NULL OR p.pricing_strategy = CAST(:pricing_strategy AS text))
              AND (CAST(:search AS text) IS NULL OR (
                      lower(p.name) LIKE lower('%' || CAST(:search AS text) || '%')
                   OR lower(COALESCE(p.sku, '')) LIKE lower('%' || CAST(:search AS text) || '%')
                   OR lower(COALESCE(p.internal_code, '')) LIKE lower('%' || CAST(:search AS text) || '%')
                  ))
        """)

        params = dict(
            solo_activos=solo_activos,
            category_id=str(category_id) if category_id else None,
            brand_id=str(brand_id) if brand_id else None,
            pricing_strategy=pricing_strategy,
            search=search,
            limit=limit,
            offset=offset,
        )
        count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}

        rows = (await self.db.execute(sql, params)).mappings().all()
        total = (await self.db.execute(count_sql, count_params)).scalar_one()

        items = [ProductRead.model_validate(dict(r)) for r in rows]
        return ProductListResponse(total=total, items=items)

    # ── Product detail ────────────────────────────────────────────────────────

    async def get_product_by_id(self, product_id: UUID) -> ProductDetailRead | None:
        stmt = (
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.attributes).selectinload(
                    ProductAttribute.options
                ),
                selectinload(Product.boms).selectinload(BOM.items),
                selectinload(Product.cost_history),
                selectinload(Product.category_ref),
            )
        )
        result = await self.db.execute(stmt)
        product = result.scalar_one_or_none()
        if product is None:
            return None

        # Calcular suggested_price
        margin = (
            product.category_ref.profit_margin_percent
            if product.category_ref
            else None
        )
        if product.current_avg_cost is not None:
            if product.pricing_strategy == "PASSTHROUGH":
                suggested = Decimal(str(product.current_avg_cost))
            elif margin is not None:
                suggested = round(
                    Decimal(str(product.current_avg_cost))
                    * (1 + Decimal(str(margin)) / 100),
                    4,
                )
            else:
                suggested = Decimal(str(product.current_avg_cost))
        else:
            suggested = None

        # BOM activo
        active_bom = next((b for b in product.boms if b.is_active), None)

        # Enriquecer BOM items con nombre/sku del componente
        bom_data = None
        if active_bom:
            bom_data = active_bom  # schema valida con from_attributes

        # Contratos Ariba vigentes (solo conteo)
        contract_count_sql = text("""
            SELECT COUNT(*)
            FROM customer_contract_prices
            WHERE product_id = :pid
              AND is_current = TRUE
              AND valid_from <= CURRENT_DATE
              AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
        """)
        contract_count = (
            await self.db.execute(contract_count_sql, {"pid": str(product_id)})
        ).scalar_one()

        base = ProductRead(
            id=product.id,
            sku=product.sku,
            internal_code=product.internal_code,
            name=product.name,
            description=product.description,
            brand_id=product.brand_id,
            brand=product.brand,
            category_id=product.category_id,
            category=product.category,
            sat_product_key_id=product.sat_product_key_id,
            sat_unit_id=product.sat_unit_id,
            is_configurable=product.is_configurable,
            is_assembled=product.is_assembled,
            pricing_strategy=product.pricing_strategy,
            moving_avg_months=product.moving_avg_months,
            current_avg_cost=(
                Decimal(str(product.current_avg_cost))
                if product.current_avg_cost is not None
                else None
            ),
            current_avg_cost_currency=product.current_avg_cost_currency,
            current_avg_cost_updated_at=product.current_avg_cost_updated_at,
            suggested_price=suggested,
            is_active=(
                product.status not in ("Dado de Baja", "Descontinuado", "Inactivo")
                if product.status is not None
                else True
            ),
            status=product.status,
            package_size=(
                Decimal(str(product.package_size))
                if product.package_size is not None
                else None
            ),
            created_at=product.created_at,
            updated_at=product.updated_at,
        )

        from app.schemas.productos_pricing_schema import (
            BOMRead,
            ProductAttributeRead,
            ProductCostHistoryRead,
        )

        return ProductDetailRead(
            **base.model_dump(),
            attributes=[
                ProductAttributeRead.model_validate(a) for a in product.attributes
            ],
            active_bom=BOMRead.model_validate(active_bom) if active_bom else None,
            cost_history=[
                ProductCostHistoryRead.model_validate(h)
                for h in product.cost_history[:20]
            ],
            active_contract_count=contract_count,
        )

    # ── Create / Update product ───────────────────────────────────────────────

    async def create_product(self, data: ProductCreate) -> ProductRead:
        product = Product(
            sku=data.sku,
            internal_code=data.internal_code,
            name=data.name,
            description=data.description,
            brand_id=data.brand_id,
            category_id=data.category_id,
            sat_product_key_id=data.sat_product_key_id,
            sat_unit_id=data.sat_unit_id,
            status=data.status,
            sale_type=data.sale_type,
            package_size=str(data.package_size) if data.package_size else None,
            warehouse_location=data.warehouse_location,
            image_url=data.image_url,
            datasheet_url=data.datasheet_url,
            unit_price=float(data.unit_price) if data.unit_price is not None else None,
            purchase_cost_parts=float(data.purchase_cost_parts) if data.purchase_cost_parts is not None else None,
            purchase_cost_ariba=float(data.purchase_cost_ariba) if data.purchase_cost_ariba is not None else None,
            is_configurable=data.is_configurable,
            is_assembled=data.is_assembled,
            pricing_strategy=data.pricing_strategy,
            moving_avg_months=data.moving_avg_months,
        )
        self.db.add(product)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(product)
        return ProductRead.model_validate(product)

    async def delete_product(self, product_id: UUID) -> bool:
        result = await self.db.execute(
            select(Product).where(Product.id == product_id)
        )
        product = result.scalar_one_or_none()
        if product is None:
            return False
        await self.db.delete(product)
        await self.db.commit()
        return True

    async def update_product(
        self, product_id: UUID, data: ProductUpdate
    ) -> ProductRead | None:
        result = await self.db.execute(
            select(Product).where(Product.id == product_id)
        )
        product = result.scalar_one_or_none()
        if product is None:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "package_size" and value is not None:
                value = str(value)
            setattr(product, field, value)

        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(product)
        return ProductRead.model_validate(product)

    # ── Categories ────────────────────────────────────────────────────────────

    async def get_categories(
        self, include_inactive: bool = False
    ) -> list[CategoryTreeNode]:
        stmt = select(Category)
        if not include_inactive:
            stmt = stmt.where(Category.is_active.isnot(False))
        result = await self.db.execute(stmt)
        flat = result.scalars().all()
        return _build_category_tree(list(flat))

    async def create_category(self, data: CategoryCreate) -> Category:
        cat = Category(
            parent_id=data.parent_id,
            name=data.name,
            slug=data.slug,
            description=data.description,
            profit_margin_percent=(
                float(data.profit_margin_percent)
                if data.profit_margin_percent is not None
                else None
            ),
            is_active=data.is_active,
        )
        self.db.add(cat)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def update_category(
        self, category_id: UUID, data: CategoryUpdate
    ) -> Category | None:
        result = await self.db.execute(
            select(Category).where(Category.id == category_id)
        )
        cat = result.scalar_one_or_none()
        if cat is None:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "profit_margin_percent" and value is not None:
                value = float(value)
            setattr(cat, field, value)

        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    # ── Brands ────────────────────────────────────────────────────────────────

    async def get_brands(self, include_inactive: bool = False) -> list[Brand]:
        stmt = select(Brand)
        if not include_inactive:
            stmt = stmt.where(Brand.is_active.isnot(False))
        result = await self.db.execute(stmt.order_by(Brand.name))
        return list(result.scalars().all())

    async def create_brand(self, data: BrandCreate) -> Brand:
        brand = Brand(
            name=data.name,
            description=data.description,
            is_active=data.is_active,
        )
        self.db.add(brand)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(brand)
        return brand

    # ── Pricing function ──────────────────────────────────────────────────────

    async def get_quote_pricing(
        self,
        product_id: UUID,
        customer_id: UUID,
        quantity: Decimal = Decimal("1"),
    ) -> QuotePricingResult:
        sql = text("""
            SELECT
                suggested_unit_cost,
                suggested_unit_price,
                cost_basis,
                contract_price_id,
                pricing_source
            FROM fn_get_quote_pricing(
                CAST(:product_id AS uuid),
                CAST(:customer_id AS uuid),
                CAST(:quantity AS numeric)
            )
        """)
        row = (
            await self.db.execute(
                sql,
                {
                    "product_id": str(product_id),
                    "customer_id": str(customer_id),
                    "quantity": float(quantity),
                },
            )
        ).mappings().one()

        return QuotePricingResult(
            suggested_unit_cost=row["suggested_unit_cost"],
            suggested_unit_price=row["suggested_unit_price"],
            cost_basis=row["cost_basis"],
            contract_price_id=row["contract_price_id"],
            pricing_source=row["pricing_source"],
        )

    # ── Cost history ──────────────────────────────────────────────────────────

    async def get_cost_history(
        self, product_id: UUID, limit: int = 20
    ) -> list[ProductCostHistory]:
        stmt = (
            select(ProductCostHistory)
            .where(ProductCostHistory.product_id == product_id)
            .order_by(ProductCostHistory.recorded_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Ariba contracts ───────────────────────────────────────────────────────

    async def get_current_contract(
        self, customer_id: UUID, product_id: UUID
    ) -> CustomerContractPrice | None:
        today = date.today()
        stmt = (
            select(CustomerContractPrice)
            .where(
                CustomerContractPrice.customer_id == customer_id,
                CustomerContractPrice.product_id == product_id,
                CustomerContractPrice.is_current.is_(True),
                CustomerContractPrice.valid_from <= today,
                (
                    CustomerContractPrice.valid_to.is_(None)
                    | (CustomerContractPrice.valid_to >= today)
                ),
            )
            .order_by(CustomerContractPrice.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_contract_price(
        self, data: CustomerContractPriceCreate, changed_by_user_id: UUID
    ) -> CustomerContractPrice:
        today = date.today()

        # Cerrar contratos vigentes anteriores
        await self.db.execute(
            update(CustomerContractPrice)
            .where(
                CustomerContractPrice.customer_id == data.customer_id,
                CustomerContractPrice.product_id == data.product_id,
                CustomerContractPrice.is_current.is_(True),
            )
            .values(
                is_current=False,
                valid_to=today,
            )
        )

        # Crear nuevo contrato
        contract = CustomerContractPrice(
            customer_id=data.customer_id,
            product_id=data.product_id,
            contract_type=data.contract_type,
            fixed_sale_price=float(data.fixed_sale_price),
            currency=data.currency,
            valid_from=data.valid_from,
            valid_to=data.valid_to,
            is_current=True,
            last_change_notice=data.last_change_notice,
            last_changed_by=changed_by_user_id,
            notes=data.notes,
        )
        self.db.add(contract)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(contract)
        return contract

    # ── Product attributes ────────────────────────────────────────────────────

    async def set_product_attributes(
        self, product_id: UUID, attrs: list[ProductAttributeCreate]
    ) -> list[ProductAttribute]:
        # Reemplazar todos los atributos del producto
        existing = await self.db.execute(
            select(ProductAttribute).where(
                ProductAttribute.product_id == product_id
            )
        )
        for attr in existing.scalars().all():
            await self.db.delete(attr)

        new_attrs: list[ProductAttribute] = []
        for a in attrs:
            attr = ProductAttribute(
                product_id=product_id,
                name=a.name,
                data_type=a.data_type,
                is_required=a.is_required,
                sort_order=a.sort_order,
            )
            self.db.add(attr)
            await self.db.flush()
            for opt in a.options:
                self.db.add(
                    ProductAttributeOption(
                        attribute_id=attr.id,
                        value=opt.value,
                        extra_cost=float(opt.extra_cost),
                    )
                )
            new_attrs.append(attr)

        await self.db.flush()
        await self.db.commit()
        # Reload with eager-loaded options to avoid lazy-load in async context
        reloaded = await self.db.execute(
            select(ProductAttribute)
            .where(ProductAttribute.product_id == product_id)
            .options(selectinload(ProductAttribute.options))
            .order_by(ProductAttribute.sort_order)
        )
        return list(reloaded.scalars().all())

    # ── BOM ───────────────────────────────────────────────────────────────────

    async def create_bom_version(
        self, product_id: UUID, data: BOMCreate
    ) -> BOM:
        # Obtener siguiente número de versión
        max_version_result = await self.db.execute(
            select(func.max(BOM.version)).where(BOM.product_id == product_id)
        )
        max_version = max_version_result.scalar_one_or_none() or 0

        # Desactivar versiones anteriores
        await self.db.execute(
            update(BOM)
            .where(BOM.product_id == product_id, BOM.is_active.is_(True))
            .values(is_active=False)
        )

        # Crear nuevo BOM activo
        bom = BOM(
            product_id=product_id,
            version=max_version + 1,
            is_active=True,
            notes=data.notes,
        )
        self.db.add(bom)
        await self.db.flush()

        for item in data.items:
            self.db.add(
                BOMItem(
                    bom_id=bom.id,
                    component_id=item.component_id,
                    quantity=float(item.quantity),
                    notes=item.notes,
                )
            )

        await self.db.flush()
        await self.db.commit()
        # Reload with eager-loaded items to avoid lazy-load in async context
        reloaded = await self.db.execute(
            select(BOM).where(BOM.id == bom.id).options(selectinload(BOM.items))
        )
        return reloaded.scalar_one()

    # ── Product configurations ────────────────────────────────────────────────

    async def get_or_create_configuration(
        self, product_id: UUID, data: ProductConfigurationCreate
    ) -> ProductConfiguration:
        config_hash = _make_config_hash(data.attributes)

        stmt = select(ProductConfiguration).where(
            ProductConfiguration.product_id == product_id,
            ProductConfiguration.config_hash == config_hash,
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        # Calcular additional_cost desde opciones
        additional_cost = Decimal("0")
        for attr_name, attr_value in data.attributes.items():
            attr_result = await self.db.execute(
                select(ProductAttribute).where(
                    ProductAttribute.product_id == product_id,
                    ProductAttribute.name == attr_name,
                    ProductAttribute.data_type == "OPTION",
                )
            )
            attr = attr_result.scalar_one_or_none()
            if attr:
                opt_result = await self.db.execute(
                    select(ProductAttributeOption).where(
                        ProductAttributeOption.attribute_id == attr.id,
                        ProductAttributeOption.value == str(attr_value),
                    )
                )
                opt = opt_result.scalar_one_or_none()
                if opt:
                    additional_cost += Decimal(str(opt.extra_cost))

        config = ProductConfiguration(
            product_id=product_id,
            config_sku=data.config_sku,
            config_hash=config_hash,
            attributes=data.attributes,
            additional_cost=float(additional_cost),
            notes=data.notes,
        )
        self.db.add(config)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(config)
        return config

    # ── SAT catalogs ──────────────────────────────────────────────────────────

    async def search_sat_product_keys(self, q: str, limit: int = 20) -> list[SATProductKey]:
        stmt = (
            select(SATProductKey)
            .where(
                SATProductKey.is_active.is_(True),
                (
                    SATProductKey.code.ilike(f"%{q}%")
                    | SATProductKey.description.ilike(f"%{q}%")
                ),
            )
            .order_by(SATProductKey.code)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search_sat_unit_keys(self, q: str, limit: int = 20) -> list[SATUnitKey]:
        stmt = (
            select(SATUnitKey)
            .where(
                SATUnitKey.is_active.is_(True),
                (
                    SATUnitKey.code.ilike(f"%{q}%")
                    | SATUnitKey.description.ilike(f"%{q}%")
                ),
            )
            .order_by(SATUnitKey.code)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
