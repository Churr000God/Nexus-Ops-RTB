from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.productos_pricing_schema import (
    BOMCreate,
    BOMRead,
    BrandCreate,
    BrandRead,
    CategoryCreate,
    CategoryRead,
    CategoryTreeNode,
    CategoryUpdate,
    CustomerContractPriceCreate,
    CustomerContractPriceRead,
    ProductAttributeCreate,
    ProductAttributeRead,
    ProductConfigurationCreate,
    ProductConfigurationRead,
    ProductCostHistoryRead,
    ProductCreate,
    ProductDetailRead,
    ProductListResponse,
    ProductRead,
    ProductUpdate,
    QuotePricingResult,
    SATProductKeyRead,
    SATUnitKeyRead,
)
from app.services.productos_service import ProductosService

router = APIRouter(prefix="/api/productos", tags=["productos"])


def _svc(db: AsyncSession = Depends(get_db)) -> ProductosService:
    return ProductosService(db)


# ─────────────────────────────────────────────────────────────────────────────
# Products
# ─────────────────────────────────────────────────────────────────────────────


@router.get("", response_model=ProductListResponse)
async def list_productos(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    category_id: UUID | None = Query(default=None),
    brand_id: UUID | None = Query(default=None),
    pricing_strategy: str | None = Query(default=None, pattern="^(MOVING_AVG|PASSTHROUGH)$"),
    solo_activos: bool = Query(default=True),
    search: str | None = Query(default=None, max_length=100),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> ProductListResponse:
    return await svc.get_products(
        limit=limit,
        offset=offset,
        category_id=category_id,
        brand_id=brand_id,
        pricing_strategy=pricing_strategy,
        solo_activos=solo_activos,
        search=search,
    )


@router.get("/{product_id}", response_model=ProductDetailRead)
async def get_producto(
    product_id: UUID,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> ProductDetailRead:
    result = await svc.get_product_by_id(product_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return result


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_producto(
    data: ProductCreate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> ProductRead:
    return await svc.create_product(data)


@router.patch("/{product_id}", response_model=ProductRead)
async def update_producto(
    product_id: UUID,
    data: ProductUpdate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> ProductRead:
    result = await svc.update_product(product_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return result


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_producto(
    product_id: UUID,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> Response:
    deleted = await svc.delete_product(product_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Pricing
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/{product_id}/pricing", response_model=QuotePricingResult)
async def get_producto_pricing(
    product_id: UUID,
    customer_id: UUID = Query(...),
    quantity: Decimal = Query(default=Decimal("1"), gt=0),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> QuotePricingResult:
    return await svc.get_quote_pricing(product_id, customer_id, quantity)


@router.get("/{product_id}/costo-historico", response_model=list[ProductCostHistoryRead])
async def get_costo_historico(
    product_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> list[ProductCostHistoryRead]:
    history = await svc.get_cost_history(product_id, limit)
    return [ProductCostHistoryRead.model_validate(h) for h in history]


# ─────────────────────────────────────────────────────────────────────────────
# Ariba contracts
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/{product_id}/contrato-ariba", response_model=CustomerContractPriceRead | None)
async def get_contrato_ariba(
    product_id: UUID,
    customer_id: UUID = Query(...),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> CustomerContractPriceRead | None:
    contract = await svc.get_current_contract(customer_id, product_id)
    if contract is None:
        return None
    return CustomerContractPriceRead.model_validate(contract)


@router.post(
    "/{product_id}/contrato-ariba",
    response_model=CustomerContractPriceRead,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_contrato_ariba(
    product_id: UUID,
    data: CustomerContractPriceCreate,
    svc: ProductosService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> CustomerContractPriceRead:
    if data.product_id != product_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="product_id en el body no coincide con el de la URL",
        )
    contract = await svc.upsert_contract_price(data, current_user.id)
    return CustomerContractPriceRead.model_validate(contract)


# ─────────────────────────────────────────────────────────────────────────────
# Attributes
# ─────────────────────────────────────────────────────────────────────────────


@router.put(
    "/{product_id}/atributos",
    response_model=list[ProductAttributeRead],
)
async def set_product_attributes(
    product_id: UUID,
    attrs: list[ProductAttributeCreate],
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> list[ProductAttributeRead]:
    result = await svc.set_product_attributes(product_id, attrs)
    return [ProductAttributeRead.model_validate(a) for a in result]


# ─────────────────────────────────────────────────────────────────────────────
# BOM
# ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "/{product_id}/bom",
    response_model=BOMRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_bom(
    product_id: UUID,
    data: BOMCreate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> BOMRead:
    bom = await svc.create_bom_version(product_id, data)
    return BOMRead.model_validate(bom)


# ─────────────────────────────────────────────────────────────────────────────
# Configurations
# ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "/{product_id}/configuraciones",
    response_model=ProductConfigurationRead,
    status_code=status.HTTP_201_CREATED,
)
async def get_or_create_configuration(
    product_id: UUID,
    data: ProductConfigurationCreate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> ProductConfigurationRead:
    config = await svc.get_or_create_configuration(product_id, data)
    return ProductConfigurationRead.model_validate(config)


# ─────────────────────────────────────────────────────────────────────────────
# Categories (sub-router agrupado aquí para simplicidad)
# ─────────────────────────────────────────────────────────────────────────────

cat_router = APIRouter(prefix="/api/categorias", tags=["productos"])


@cat_router.get("", response_model=list[CategoryTreeNode])
async def list_categorias(
    include_inactive: bool = Query(default=False),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> list[CategoryTreeNode]:
    return await svc.get_categories(include_inactive=include_inactive)


@cat_router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_categoria(
    data: CategoryCreate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> CategoryRead:
    cat = await svc.create_category(data)
    return CategoryRead.model_validate(cat)


@cat_router.patch("/{category_id}", response_model=CategoryRead)
async def update_categoria(
    category_id: UUID,
    data: CategoryUpdate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> CategoryRead:
    cat = await svc.update_category(category_id, data)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    return CategoryRead.model_validate(cat)


# ─────────────────────────────────────────────────────────────────────────────
# Brands
# ─────────────────────────────────────────────────────────────────────────────

brand_router = APIRouter(prefix="/api/marcas", tags=["productos"])


@brand_router.get("", response_model=list[BrandRead])
async def list_marcas(
    include_inactive: bool = Query(default=False),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> list[BrandRead]:
    brands = await svc.get_brands(include_inactive=include_inactive)
    return [BrandRead.model_validate(b) for b in brands]


@brand_router.post("", response_model=BrandRead, status_code=status.HTTP_201_CREATED)
async def create_marca(
    data: BrandCreate,
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> BrandRead:
    brand = await svc.create_brand(data)
    return BrandRead.model_validate(brand)


# ─────────────────────────────────────────────────────────────────────────────
# SAT catalogs
# ─────────────────────────────────────────────────────────────────────────────

sat_router = APIRouter(prefix="/api/sat", tags=["productos"])


@sat_router.get("/claves-producto", response_model=list[SATProductKeyRead])
async def search_sat_product_keys(
    q: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> list[SATProductKeyRead]:
    keys = await svc.search_sat_product_keys(q, limit)
    return [SATProductKeyRead.model_validate(k) for k in keys]


@sat_router.get("/claves-unidad", response_model=list[SATUnitKeyRead])
async def search_sat_unit_keys(
    q: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    svc: ProductosService = Depends(_svc),
    _: User = Depends(get_current_user),
) -> list[SATUnitKeyRead]:
    keys = await svc.search_sat_unit_keys(q, limit)
    return [SATUnitKeyRead.model_validate(k) for k in keys]
