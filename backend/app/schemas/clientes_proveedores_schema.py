from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ─────────────────────────────────────────────────────────────────────────────
# SAT catálogos (lectura)
# ─────────────────────────────────────────────────────────────────────────────


class SATTaxRegimeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    regime_id: int
    code: str
    description: str
    applies_to: str


class SATCfdiUseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    use_id: str
    description: str
    applies_to: str


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — datos fiscales
# ─────────────────────────────────────────────────────────────────────────────


class CustomerTaxDataCreate(BaseModel):
    rfc: str = Field(..., min_length=12, max_length=13, description="RFC del cliente (12 moral / 13 física)")
    legal_name: str = Field(..., min_length=1, description="Razón social fiscal exacta SAT")
    tax_regime_id: int | None = None
    cfdi_use_id: str | None = Field(default=None, max_length=10)
    zip_code: str = Field(..., min_length=5, max_length=10)
    is_default: bool = True


class CustomerTaxDataRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tax_data_id: int
    customer_id: int
    rfc: str
    legal_name: str
    tax_regime_id: int | None
    cfdi_use_id: str | None
    zip_code: str
    is_default: bool


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — direcciones
# ─────────────────────────────────────────────────────────────────────────────


class CustomerAddressCreate(BaseModel):
    address_type: str = Field(..., pattern="^(FISCAL|DELIVERY|OTHER)$")
    tax_data_id: int | None = None
    label: str | None = None
    street: str = Field(..., min_length=1)
    exterior_number: str | None = None
    interior_number: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    country: str = "México"
    zip_code: str | None = None
    is_default: bool = False

    @model_validator(mode="after")
    def check_fiscal_requires_tax_data(self) -> CustomerAddressCreate:
        if self.address_type == "FISCAL" and self.tax_data_id is None:
            raise ValueError("Una dirección FISCAL requiere tax_data_id")
        if self.address_type != "FISCAL" and self.tax_data_id is not None:
            raise ValueError("Solo las direcciones FISCAL pueden tener tax_data_id")
        return self


class CustomerAddressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address_id: int
    customer_id: int
    address_type: str
    tax_data_id: int | None
    label: str | None
    street: str
    exterior_number: str | None
    interior_number: str | None
    neighborhood: str | None
    city: str | None
    state: str | None
    country: str
    zip_code: str | None
    is_default: bool


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — contactos
# ─────────────────────────────────────────────────────────────────────────────


class CustomerContactCreate(BaseModel):
    full_name: str = Field(..., min_length=1)
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class CustomerContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contact_id: int
    customer_id: int
    full_name: str
    role_title: str | None
    email: str | None
    phone: str | None
    is_primary: bool


# ─────────────────────────────────────────────────────────────────────────────
# Clientes — cabecera
# ─────────────────────────────────────────────────────────────────────────────


class CustomerCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=40, description="Código interno corto, ej. FEMSA")
    business_name: str = Field(..., min_length=1, description="Nombre comercial (no razón social fiscal)")
    customer_type: str = Field(default="COMPANY", pattern="^(COMPANY|PERSON)$")
    locality: str = Field(default="LOCAL", pattern="^(LOCAL|FOREIGN)$")
    payment_terms_days: int = Field(default=0, ge=0, le=365)
    credit_limit: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="MXN", min_length=3, max_length=3)
    notes: str | None = None


class CustomerUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=1)
    customer_type: str | None = Field(default=None, pattern="^(COMPANY|PERSON)$")
    locality: str | None = Field(default=None, pattern="^(LOCAL|FOREIGN)$")
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    credit_limit: Decimal | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    is_active: bool | None = None
    notes: str | None = None


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    code: str
    business_name: str
    customer_type: str
    locality: str
    payment_terms_days: int
    credit_limit: Decimal | None
    currency: str
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class CustomerDetail(CustomerRead):
    """Ficha completa: cabecera + datos fiscales + direcciones + contactos."""

    tax_data: list[CustomerTaxDataRead] = []
    addresses: list[CustomerAddressRead] = []
    contacts: list[CustomerContactRead] = []


class CustomerListResponse(BaseModel):
    total: int
    items: list[CustomerRead]


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — datos fiscales
# ─────────────────────────────────────────────────────────────────────────────


class SupplierTaxDataCreate(BaseModel):
    rfc: str = Field(..., min_length=12, max_length=13)
    legal_name: str = Field(..., min_length=1)
    tax_regime_id: int | None = None
    zip_code: str = Field(..., min_length=5, max_length=10)
    is_default: bool = True


class SupplierTaxDataRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tax_data_id: int
    supplier_id: int
    rfc: str
    legal_name: str
    tax_regime_id: int | None
    zip_code: str
    is_default: bool


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — direcciones
# ─────────────────────────────────────────────────────────────────────────────


class SupplierAddressCreate(BaseModel):
    address_type: str = Field(..., pattern="^(FISCAL|PICKUP|OTHER)$")
    tax_data_id: int | None = None
    label: str | None = None
    street: str = Field(..., min_length=1)
    exterior_number: str | None = None
    interior_number: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    country: str = "México"
    zip_code: str | None = None
    is_default: bool = False

    @model_validator(mode="after")
    def check_fiscal_requires_tax_data(self) -> SupplierAddressCreate:
        if self.address_type == "FISCAL" and self.tax_data_id is None:
            raise ValueError("Una dirección FISCAL requiere tax_data_id")
        if self.address_type != "FISCAL" and self.tax_data_id is not None:
            raise ValueError("Solo las direcciones FISCAL pueden tener tax_data_id")
        return self


class SupplierAddressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address_id: int
    supplier_id: int
    address_type: str
    tax_data_id: int | None
    label: str | None
    street: str
    exterior_number: str | None
    interior_number: str | None
    neighborhood: str | None
    city: str | None
    state: str | None
    country: str
    zip_code: str | None
    is_default: bool


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — contactos
# ─────────────────────────────────────────────────────────────────────────────


class SupplierContactCreate(BaseModel):
    full_name: str = Field(..., min_length=1)
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class SupplierContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contact_id: int
    supplier_id: int
    full_name: str
    role_title: str | None
    email: str | None
    phone: str | None
    is_primary: bool


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — catálogo de productos
# ─────────────────────────────────────────────────────────────────────────────


class SupplierProductCreate(BaseModel):
    product_id: UUID | None = None
    supplier_sku: str | None = None
    unit_cost: Decimal = Field(..., ge=0)
    currency: str = Field(default="MXN", min_length=3, max_length=3)
    lead_time_days: int | None = Field(default=None, ge=0, le=365)
    moq: Decimal | None = Field(default=None, ge=0)
    is_available: bool = True
    is_preferred: bool = False
    valid_from: date | None = None


class SupplierProductPriceUpdate(BaseModel):
    """Actualizar precio de un proveedor preservando el histórico."""

    unit_cost: Decimal = Field(..., ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    supplier_sku: str | None = None
    lead_time_days: int | None = Field(default=None, ge=0, le=365)
    moq: Decimal | None = Field(default=None, ge=0)
    is_preferred: bool | None = None


class SupplierProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_product_id: int
    supplier_id: int
    product_id: UUID | None
    supplier_sku: str | None
    unit_cost: Decimal
    currency: str
    lead_time_days: int | None
    moq: Decimal | None
    is_available: bool
    is_preferred: bool
    valid_from: date
    valid_to: date | None
    is_current: bool
    created_at: datetime


class CatalogoItemRead(BaseModel):
    """Vista cruzada: producto × proveedor (para /proveedores/catalogo)."""

    supplier_product_id: int
    supplier_id: int
    supplier_code: str
    supplier_name: str
    supplier_sku: str | None
    product_id: UUID | None
    product_name: str | None
    product_sku: str | None
    unit_cost: Decimal
    currency: str
    lead_time_days: int | None
    moq: Decimal | None
    is_available: bool
    is_preferred: bool
    valid_from: date


class CatalogoListResponse(BaseModel):
    total: int
    items: list[CatalogoItemRead]


# ─────────────────────────────────────────────────────────────────────────────
# Proveedores — cabecera
# ─────────────────────────────────────────────────────────────────────────────


class SupplierCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    business_name: str = Field(..., min_length=1)
    supplier_type: str = Field(default="GOODS", pattern="^(GOODS|SERVICES|BOTH)$")
    locality: str = Field(default="LOCAL", pattern="^(LOCAL|FOREIGN)$")
    is_occasional: bool = False
    payment_terms_days: int = Field(default=0, ge=0, le=365)
    avg_payment_time_days: int | None = Field(default=None, ge=0, le=365)
    currency: str = Field(default="MXN", min_length=3, max_length=3)
    notes: str | None = None


class SupplierUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=1)
    supplier_type: str | None = Field(default=None, pattern="^(GOODS|SERVICES|BOTH)$")
    locality: str | None = Field(default=None, pattern="^(LOCAL|FOREIGN)$")
    is_occasional: bool | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    avg_payment_time_days: int | None = Field(default=None, ge=0, le=365)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    is_active: bool | None = None
    notes: str | None = None


class SupplierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_id: int
    code: str
    business_name: str
    supplier_type: str
    locality: str
    is_occasional: bool
    payment_terms_days: int
    avg_payment_time_days: int | None
    currency: str
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class SupplierDetail(SupplierRead):
    """Ficha completa: cabecera + datos fiscales + direcciones + contactos + catálogo vigente."""

    tax_data: list[SupplierTaxDataRead] = []
    addresses: list[SupplierAddressRead] = []
    contacts: list[SupplierContactRead] = []
    current_products: list[SupplierProductRead] = []


class SupplierListResponse(BaseModel):
    total: int
    items: list[SupplierRead]
