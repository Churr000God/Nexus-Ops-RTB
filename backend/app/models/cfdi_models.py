"""Modelos SQLAlchemy — Módulo CFDI 4.0 (tablas nuevas).

Tablas aquí: cfdi_issuer_config, cfdi_series, cfdi_pac_log.

Las tablas cfdi, cfdi_items, cfdi_credit_notes, cfdi_payments,
payments y payment_applications viven en ventas_logistica_models.py
y se extienden con nuevas columnas via migración 0022.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    SmallInteger,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


# ---------------------------------------------------------------------------
# CfdiIssuerConfig — datos fiscales de RTB y credenciales PAC
# ---------------------------------------------------------------------------


class CfdiIssuerConfig(Base):
    """Configuración del emisor (RTB) para CFDI 4.0.

    Soporta múltiples filas históricas: renovación CSD (~4 años),
    cambio de PAC, etc. Solo una fila puede tener is_active=True.
    """

    __tablename__ = "cfdi_issuer_config"

    config_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    rfc: Mapped[str] = mapped_column(Text, nullable=False)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    tax_regime_id: Mapped[int | None] = mapped_column(
        SmallInteger, ForeignKey("sat_tax_regimes.regime_id")
    )
    zip_code: Mapped[str] = mapped_column(Text, nullable=False)
    # CSD: certificado en base64, clave .key encriptada, hash de contraseña
    csd_certificate_b64: Mapped[str | None] = mapped_column(Text)
    csd_key_encrypted: Mapped[str | None] = mapped_column(Text)
    csd_password_hash: Mapped[str | None] = mapped_column(Text)
    csd_serial_number: Mapped[str | None] = mapped_column(Text)
    csd_valid_from: Mapped[date | None] = mapped_column(Date)
    csd_valid_to: Mapped[date | None] = mapped_column(Date)
    # PAC
    pac_provider: Mapped[str | None] = mapped_column(Text)
    pac_username: Mapped[str | None] = mapped_column(Text)
    pac_endpoint_url: Mapped[str | None] = mapped_column(Text)
    pac_credentials_enc: Mapped[str | None] = mapped_column(Text)
    pac_environment: Mapped[str] = mapped_column(Text, nullable=False, default="SANDBOX")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# CfdiSeries — series y consecutivos de folio
# ---------------------------------------------------------------------------


class CfdiSeries(Base):
    """Series de CFDI con folio consecutivo atómico.

    fn_assign_cfdi_folio(series) incrementa next_folio con FOR UPDATE.
    Seed: A (I), NC (E), CP (P), EXP (I).
    """

    __tablename__ = "cfdi_series"
    __table_args__ = (UniqueConstraint("series", "cfdi_type", name="uq_cfdi_series_type"),)

    series_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    series: Mapped[str] = mapped_column(Text, nullable=False)
    cfdi_type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    next_folio: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# CfdiPacLog — audit log de operaciones PAC
# ---------------------------------------------------------------------------


class CfdiPacLog(Base):
    """Registro inmutable de cada llamada HTTP al PAC.

    No se elimina ni modifica. Permite auditar timbrados, cancelaciones
    y reintentos con sus respuestas completas.
    """

    __tablename__ = "cfdi_pac_log"

    log_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    cfdi_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id"), nullable=False)
    operation: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    uuid_received: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    pac_response: Mapped[dict | None] = mapped_column(JSONB)
    pac_provider: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
