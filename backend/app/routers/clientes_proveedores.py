from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permission
from app.models.user_model import User
from app.schemas.clientes_proveedores_schema import (
    CustomerAddressCreate,
    CustomerAddressRead,
    CustomerContactCreate,
    CustomerContactRead,
    CustomerCreate,
    CustomerDetail,
    CustomerListResponse,
    CustomerRead,
    CustomerTaxDataCreate,
    CustomerTaxDataRead,
    CustomerUpdate,
    SATCfdiUseRead,
    SATTaxRegimeRead,
    SupplierAddressCreate,
    SupplierAddressRead,
    SupplierContactCreate,
    SupplierContactRead,
    SupplierCreate,
    SupplierDetail,
    SupplierListResponse,
    SupplierProductCreate,
    SupplierProductPriceUpdate,
    SupplierProductRead,
    SupplierRead,
    SupplierTaxDataCreate,
    SupplierTaxDataRead,
    SupplierUpdate,
)
from app.services.clientes_proveedores_service import ClientesProveedoresService

# Catálogos SAT (select en DB)
from sqlalchemy import select
from app.models.clientes_proveedores_models import SATTaxRegime, SATCfdiUse

clientes_router = APIRouter(prefix="/api/clientes", tags=["clientes"])
proveedores_router = APIRouter(prefix="/api/proveedores", tags=["proveedores"])
sat_cp_router = APIRouter(prefix="/api/sat", tags=["sat-cp"])


def _svc(db: AsyncSession = Depends(get_db)) -> ClientesProveedoresService:
    return ClientesProveedoresService(db)


# ─────────────────────────────────────────────────────────────────────────────
# SAT catálogos (auxiliares para formularios)
# ─────────────────────────────────────────────────────────────────────────────


@sat_cp_router.get("/regimenes-fiscales", response_model=list[SATTaxRegimeRead])
async def list_regimenes(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("customer.view")),
) -> list[SATTaxRegimeRead]:
    rows = (await db.execute(select(SATTaxRegime).order_by(SATTaxRegime.code))).scalars().all()
    return [SATTaxRegimeRead.model_validate(r) for r in rows]


@sat_cp_router.get("/usos-cfdi", response_model=list[SATCfdiUseRead])
async def list_usos_cfdi(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("customer.view")),
) -> list[SATCfdiUseRead]:
    rows = (await db.execute(select(SATCfdiUse).order_by(SATCfdiUse.use_id))).scalars().all()
    return [SATCfdiUseRead.model_validate(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — listado y detalle
# ─────────────────────────────────────────────────────────────────────────────


@clientes_router.get("", response_model=CustomerListResponse)
async def list_clientes(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=100),
    solo_activos: bool = Query(default=True),
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.view")),
) -> CustomerListResponse:
    return await svc.list_customers(
        limit=limit, offset=offset, search=search, solo_activos=solo_activos
    )


@clientes_router.get("/{customer_id}", response_model=CustomerDetail)
async def get_cliente(
    customer_id: int,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.view")),
) -> CustomerDetail:
    result = await svc.get_customer_detail(customer_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — creación y edición
# ─────────────────────────────────────────────────────────────────────────────


@clientes_router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_cliente(
    data: CustomerCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> CustomerRead:
    return await svc.create_customer(data)


@clientes_router.patch("/{customer_id}", response_model=CustomerRead)
async def update_cliente(
    customer_id: int,
    data: CustomerUpdate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> CustomerRead:
    result = await svc.update_customer(customer_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — datos fiscales
# ─────────────────────────────────────────────────────────────────────────────


@clientes_router.post(
    "/{customer_id}/tax-data",
    response_model=CustomerTaxDataRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_tax_data(
    customer_id: int,
    data: CustomerTaxDataCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> CustomerTaxDataRead:
    return await svc.add_customer_tax_data(customer_id, data)


@clientes_router.put(
    "/{customer_id}/tax-data/{tax_data_id}",
    response_model=CustomerTaxDataRead,
)
async def update_tax_data(
    customer_id: int,
    tax_data_id: int,
    data: CustomerTaxDataCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> CustomerTaxDataRead:
    result = await svc.update_customer_tax_data(customer_id, tax_data_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Datos fiscales no encontrados")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — direcciones
# ─────────────────────────────────────────────────────────────────────────────


@clientes_router.post(
    "/{customer_id}/addresses",
    response_model=CustomerAddressRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_address(
    customer_id: int,
    data: CustomerAddressCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> CustomerAddressRead:
    return await svc.add_customer_address(customer_id, data)


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — contactos
# ─────────────────────────────────────────────────────────────────────────────


@clientes_router.post(
    "/{customer_id}/contacts",
    response_model=CustomerContactRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact(
    customer_id: int,
    data: CustomerContactCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> CustomerContactRead:
    return await svc.add_customer_contact(customer_id, data)


@clientes_router.delete(
    "/{customer_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_contact(
    customer_id: int,
    contact_id: int,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("customer.manage")),
) -> Response:
    deleted = await svc.delete_customer_contact(customer_id, contact_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contacto no encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — listado y detalle
# ─────────────────────────────────────────────────────────────────────────────


@proveedores_router.get("", response_model=SupplierListResponse)
async def list_proveedores(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=100),
    solo_activos: bool = Query(default=True),
    supplier_type: str | None = Query(default=None, pattern="^(GOODS|SERVICES|BOTH)$"),
    locality: str | None = Query(default=None, pattern="^(LOCAL|FOREIGN)$"),
    is_occasional: bool | None = Query(default=None),
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.view")),
) -> SupplierListResponse:
    return await svc.list_suppliers(
        limit=limit,
        offset=offset,
        search=search,
        solo_activos=solo_activos,
        supplier_type=supplier_type,
        locality=locality,
        is_occasional=is_occasional,
    )


@proveedores_router.get("/{supplier_id}", response_model=SupplierDetail)
async def get_proveedor(
    supplier_id: int,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.view")),
) -> SupplierDetail:
    result = await svc.get_supplier_detail(supplier_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — creación y edición
# ─────────────────────────────────────────────────────────────────────────────


@proveedores_router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_proveedor(
    data: SupplierCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierRead:
    return await svc.create_supplier(data)


@proveedores_router.patch("/{supplier_id}", response_model=SupplierRead)
async def update_proveedor(
    supplier_id: int,
    data: SupplierUpdate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierRead:
    result = await svc.update_supplier(supplier_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — datos fiscales
# ─────────────────────────────────────────────────────────────────────────────


@proveedores_router.post(
    "/{supplier_id}/tax-data",
    response_model=SupplierTaxDataRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_supplier_tax_data(
    supplier_id: int,
    data: SupplierTaxDataCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierTaxDataRead:
    return await svc.add_supplier_tax_data(supplier_id, data)


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — direcciones
# ─────────────────────────────────────────────────────────────────────────────


@proveedores_router.post(
    "/{supplier_id}/addresses",
    response_model=SupplierAddressRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_supplier_address(
    supplier_id: int,
    data: SupplierAddressCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierAddressRead:
    return await svc.add_supplier_address(supplier_id, data)


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — contactos
# ─────────────────────────────────────────────────────────────────────────────


@proveedores_router.post(
    "/{supplier_id}/contacts",
    response_model=SupplierContactRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_supplier_contact(
    supplier_id: int,
    data: SupplierContactCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierContactRead:
    return await svc.add_supplier_contact(supplier_id, data)


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — catálogo de productos
# ─────────────────────────────────────────────────────────────────────────────


@proveedores_router.post(
    "/{supplier_id}/products",
    response_model=SupplierProductRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_supplier_product(
    supplier_id: int,
    data: SupplierProductCreate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierProductRead:
    return await svc.add_supplier_product(supplier_id, data)


@proveedores_router.put(
    "/{supplier_id}/products/{supplier_product_id}/price",
    response_model=SupplierProductRead,
)
async def update_supplier_product_price(
    supplier_id: int,
    supplier_product_id: int,
    data: SupplierProductPriceUpdate,
    svc: ClientesProveedoresService = Depends(_svc),
    _: User = Depends(require_permission("supplier.manage")),
) -> SupplierProductRead:
    result = await svc.update_supplier_product_price(supplier_id, supplier_product_id, data)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Precio vigente no encontrado",
        )
    return result
