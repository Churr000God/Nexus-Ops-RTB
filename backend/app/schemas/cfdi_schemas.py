"""Schemas Pydantic — Módulo CFDI 4.0."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Enums / Literals
# ---------------------------------------------------------------------------

CfdiType = Literal["I", "E", "P", "T"]
CfdiStatus = Literal["DRAFT", "ISSUED", "TIMBRADO", "PAID", "CANCELLED", "SUPERSEDED"]
CfdiCancelReason = Literal["01", "02", "03", "04"]
RelationType = Literal["01", "02", "03", "04", "05", "06", "07"]
PacProvider = Literal["DIVERZA", "EDICOM", "FACTURAMA", "STUB"]
PacEnvironment = Literal["SANDBOX", "PRODUCTION"]


# ---------------------------------------------------------------------------
# Issuer Config
# ---------------------------------------------------------------------------


class CfdiIssuerConfigIn(BaseModel):
    rfc: str = Field(min_length=12, max_length=13)
    legal_name: str
    tax_regime_id: int | None = None
    zip_code: str = Field(min_length=5, max_length=5)
    csd_certificate_b64: str | None = None
    csd_key_encrypted: str | None = None
    csd_password_hash: str | None = None
    csd_serial_number: str | None = None
    csd_valid_from: date | None = None
    csd_valid_to: date | None = None
    pac_provider: PacProvider | None = None
    pac_username: str | None = None
    pac_endpoint_url: str | None = None
    pac_credentials_enc: str | None = None
    pac_environment: PacEnvironment = "SANDBOX"
    valid_from: date | None = None
    valid_to: date | None = None


class CfdiIssuerConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    config_id: int
    rfc: str
    legal_name: str
    tax_regime_id: int | None
    zip_code: str
    csd_serial_number: str | None
    csd_valid_from: date | None
    csd_valid_to: date | None
    pac_provider: str | None
    pac_environment: str
    is_active: bool
    valid_from: date | None
    valid_to: date | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Series
# ---------------------------------------------------------------------------


class CfdiSeriesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    series_id: int
    series: str
    cfdi_type: str
    description: str | None
    next_folio: int
    is_active: bool


class CfdiSeriesIn(BaseModel):
    series: str = Field(min_length=1, max_length=10)
    cfdi_type: CfdiType
    description: str | None = None


class CfdiSeriesUpdate(BaseModel):
    description: str | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# CFDI Items
# ---------------------------------------------------------------------------


class CfdiItemIn(BaseModel):
    order_item_id: int | None = None
    product_id: UUID | None = None
    sat_product_key_id: UUID | None = None
    sat_unit_key_id: UUID | None = None
    unit_key: str | None = None
    product_key: str | None = None
    description: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    discount_amount: float = Field(ge=0, default=0)
    iva_pct: float = Field(ge=0, le=1, default=0.16)
    sort_order: int = 0


class CfdiItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cfdi_item_id: int
    order_item_id: int | None
    product_id: UUID | None
    sat_product_key_id: UUID | None
    sat_unit_key_id: UUID | None
    unit_key: str | None
    product_key: str | None
    description: str
    quantity: float
    unit_price: float
    discount_amount: float
    iva_pct: float
    subtotal: float
    tax_amount: float
    total: float
    sort_order: int


# ---------------------------------------------------------------------------
# CFDI — crear borrador
# ---------------------------------------------------------------------------


class CfdiCreateIn(BaseModel):
    cfdi_number: str
    cfdi_type: CfdiType = "I"
    series: str
    order_id: int | None = None
    customer_id: int
    issue_date: date
    currency: str = "MXN"
    exchange_rate: float = Field(gt=0, default=1.0)
    payment_method: Literal["PUE", "PPD"] | None = None
    payment_form: str | None = None
    cfdi_use: str | None = None
    # Snapshots fiscales — se rellenan desde los datos del cliente si no se mandan
    issuer_rfc: str | None = None
    issuer_name: str | None = None
    issuer_tax_regime: str | None = None
    receiver_rfc: str | None = None
    receiver_name: str | None = None
    receiver_tax_regime: str | None = None
    receiver_zip: str | None = None
    items: list[CfdiItemIn] = Field(min_length=1)

    @model_validator(mode="after")
    def ppd_requires_payment_form(self) -> CfdiCreateIn:
        if self.payment_method == "PPD" and not self.payment_form:
            raise ValueError("payment_form es obligatorio cuando payment_method=PPD")
        return self


# ---------------------------------------------------------------------------
# CFDI — respuesta
# ---------------------------------------------------------------------------


class CfdiListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cfdi_id: int
    cfdi_number: str
    uuid: str | None
    cfdi_type: str
    series: str | None
    folio: int | None
    issue_date: date
    receiver_name: str | None
    receiver_rfc: str | None
    total: float
    currency: str
    payment_method: str | None
    status: str
    timbre_date: datetime | None


class CfdiOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cfdi_id: int
    cfdi_number: str
    uuid: str | None
    cfdi_type: str
    series: str | None
    series_id: int | None
    folio: int | None
    cfdi_version: str
    issue_date: date
    # Snapshots
    issuer_rfc: str | None
    issuer_name: str | None
    issuer_tax_regime: str | None
    receiver_rfc: str | None
    receiver_name: str | None
    receiver_tax_regime: str | None
    receiver_zip: str | None
    # Totales
    subtotal: float
    tax_amount: float
    total: float
    currency: str
    exchange_rate: float
    payment_method: str | None
    payment_form: str | None
    cfdi_use: str | None
    status: str
    # TFD
    sello_cfdi: str | None
    sello_sat: str | None
    certificate_number: str | None
    timbre_date: datetime | None
    xml_path: str | None
    pdf_path: str | None
    # Cancelación
    sat_cancellation_motive: str | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    replaces_cfdi_id: int | None
    replaced_by_cfdi_id: int | None
    # Relaciones
    order_id: int | None
    customer_id: int
    issuer_config_id: int | None
    created_at: datetime
    updated_at: datetime
    items: list[CfdiItemOut] = []


# ---------------------------------------------------------------------------
# Timbrar
# ---------------------------------------------------------------------------


class CfdiStampResponse(BaseModel):
    cfdi_id: int
    uuid: str
    status: str
    timbre_date: datetime
    certificate_number: str


# ---------------------------------------------------------------------------
# Cancelar
# ---------------------------------------------------------------------------


class CfdiCancelIn(BaseModel):
    reason: CfdiCancelReason
    substitute_cfdi_number: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def reason_01_requires_substitute(self) -> CfdiCancelIn:
        if self.reason == "01" and not self.substitute_cfdi_number:
            raise ValueError("substitute_cfdi_number es obligatorio cuando reason='01'")
        return self


class CfdiCancelResponse(BaseModel):
    cfdi_id: int
    status: str
    sat_status: str | None


# ---------------------------------------------------------------------------
# Nota de crédito (Tipo E)
# ---------------------------------------------------------------------------


class CfdiCreditNoteIn(BaseModel):
    original_cfdi_id: int
    cfdi_number: str
    series: str = "NC"
    issue_date: date
    relation_type: RelationType = "01"
    reason: str
    amount: float = Field(gt=0)
    items: list[CfdiItemIn] = Field(min_length=1)
    notes: str | None = None


class CfdiCreditNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    credit_note_id: int
    cfdi_id: int
    original_cfdi_id: int
    relation_type: str | None
    reason: str
    amount: float
    issued_at: datetime
    notes: str | None


# ---------------------------------------------------------------------------
# Complemento de pago (Tipo P)
# ---------------------------------------------------------------------------


class CfdiPaymentComplementIn(BaseModel):
    cfdi_id: int                        # CFDI Tipo I PPD que se está pagando
    payment_date: date
    payment_form: str                   # c_FormaPago (03=transferencia, 01=efectivo…)
    currency: str = "MXN"
    exchange_rate: float = Field(gt=0, default=1.0)
    amount_paid: float = Field(gt=0)
    bank_reference: str | None = None
    cfdi_number: str | None = None      # número del CFDI Tipo P a crear


class CfdiPaymentComplementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cfdi_payment_id: int
    cfdi_id: int
    payment_date: date
    payment_form: str
    currency: str
    amount_paid: float
    partial_number: int
    previous_balance: float
    remaining_balance: float
    bank_reference: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# PPD pendientes
# ---------------------------------------------------------------------------


class CfdiPpdPending(BaseModel):
    cfdi_id: int
    uuid: str | None
    cfdi_number: str
    series_code: str | None
    folio: int | None
    issue_date: date
    customer_name: str | None
    customer_rfc: str | None
    total: float
    paid_amount: float
    remaining_balance: float
    days_since_issue: int
    status: str


# ---------------------------------------------------------------------------
# PAC Log
# ---------------------------------------------------------------------------


class CfdiPacLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: int
    cfdi_id: int
    operation: str
    success: bool
    uuid_received: str | None
    error_code: str | None
    error_message: str | None
    pac_provider: str | None
    requested_at: datetime
