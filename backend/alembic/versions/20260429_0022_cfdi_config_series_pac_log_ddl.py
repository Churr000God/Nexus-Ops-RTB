"""cfdi: configuración emisor, series, log PAC y columnas CFDI 4.0

Cambios:
  1. CREATE TABLE cfdi_issuer_config  — datos fiscales RTB + credenciales PAC encriptadas
  2. CREATE TABLE cfdi_series         — series (A/NC/CP/EXP) con consecutivo de folio
  3. CREATE TABLE cfdi_pac_log        — audit log de cada operación con el PAC
  4. ALTER TABLE cfdi                 — agrega campos CFDI 4.0:
       series_id, folio, cfdi_version, issuer_rfc/name/tax_regime,
       receiver_rfc/name/tax_regime/zip, sello_cfdi, sello_sat,
       certificate_number, timbre_date, xml_path, pdf_path, issuer_config_id
  5. ALTER cfdi.status CHECK          — añade 'TIMBRADO' y 'PAID'
  6. ALTER TABLE cfdi_items           — agrega sat_product_key_id, sat_unit_key_id, iva_pct
  7. ALTER TABLE cfdi_credit_notes    — agrega relation_type (c_TipoRelacion SAT)
  8. Seed cfdi_series                 — 4 series default: A (I), NC (E), CP (P), EXP (I)
  9. RBAC                             — 4 permisos: cfdi.view, cfdi.issue, cfdi.cancel,
                                         cfdi.config.manage

Revision ID: 20260429_0022
Revises: 20260428_0021
Create Date: 2026-04-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260429_0022"
down_revision: str = "20260428_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. cfdi_issuer_config ───────────────────────────────────────────────────
    # Almacena los datos fiscales de RTB (emisor) y las credenciales del PAC.
    # Las credenciales sensibles (clave CSD, password PAC) se almacenan
    # encriptadas; la contraseña del CSD se guarda como hash bcrypt — nunca
    # en texto plano. La tabla admite múltiples filas históricas (renovación
    # de CSD cada ~4 años, cambio de PAC, etc.).
    op.execute("""
        CREATE TABLE cfdi_issuer_config (
            config_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            rfc                     TEXT NOT NULL,
            legal_name              TEXT NOT NULL,
            tax_regime_id           SMALLINT REFERENCES sat_tax_regimes(regime_id),
            zip_code                TEXT NOT NULL,
            -- CSD: el certificado se guarda en base64; la clave .key encriptada
            csd_certificate_b64     TEXT,
            csd_key_encrypted       TEXT,
            csd_password_hash       TEXT,
            csd_serial_number       TEXT,
            csd_valid_from          DATE,
            csd_valid_to            DATE,
            -- PAC: proveedor, endpoint y credenciales
            pac_provider            TEXT CHECK (
                                        pac_provider IN (
                                            'DIVERZA','EDICOM','FACTURAMA','STUB'
                                        )
                                    ),
            pac_username            TEXT,
            pac_endpoint_url        TEXT,
            pac_credentials_enc     TEXT,
            pac_environment         TEXT NOT NULL DEFAULT 'SANDBOX'
                                        CHECK (pac_environment IN ('SANDBOX','PRODUCTION')),
            is_active               BOOLEAN NOT NULL DEFAULT TRUE,
            valid_from              DATE,
            valid_to                DATE,
            created_by              UUID REFERENCES users(id),
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_cfdi_issuer_config_active ON cfdi_issuer_config(is_active)")

    # ── 2. cfdi_series ──────────────────────────────────────────────────────────
    # Cada fila es una serie (A, NC, CP, EXP) con su tipo de CFDI y el siguiente
    # folio a asignar. fn_assign_cfdi_folio (migración 0023) usa FOR UPDATE para
    # garantizar unicidad bajo concurrencia.
    op.execute("""
        CREATE TABLE cfdi_series (
            series_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            series          TEXT NOT NULL,
            cfdi_type       TEXT NOT NULL
                                CHECK (cfdi_type IN ('I','E','P','T')),
            description     TEXT,
            next_folio      BIGINT NOT NULL DEFAULT 1
                                CHECK (next_folio >= 1),
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (series, cfdi_type)
        )
    """)

    # ── 3. cfdi_pac_log ─────────────────────────────────────────────────────────
    # Audit log inmutable de cada llamada HTTP al PAC (timbrado, cancelación,
    # consulta de status, reenvío de XML). No se elimina ni se actualiza.
    op.execute("""
        CREATE TABLE cfdi_pac_log (
            log_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            cfdi_id         BIGINT NOT NULL REFERENCES cfdi(cfdi_id),
            operation       TEXT NOT NULL
                                CHECK (operation IN (
                                    'TIMBRAR','CANCELAR','CONSULTAR','REENVIAR'
                                )),
            success         BOOLEAN NOT NULL DEFAULT FALSE,
            uuid_received   TEXT,
            error_code      TEXT,
            error_message   TEXT,
            pac_response    JSONB,
            pac_provider    TEXT,
            user_id         UUID REFERENCES users(id),
            requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_cfdi_pac_log_cfdi   ON cfdi_pac_log(cfdi_id)")
    op.execute("CREATE INDEX ix_cfdi_pac_log_req_at ON cfdi_pac_log(requested_at)")

    # ── 4. ALTER TABLE cfdi — columnas CFDI 4.0 ─────────────────────────────────
    # Agrega los campos obligatorios del estándar SAT CFDI 4.0 que no existían
    # en la definición original del módulo de ventas.
    op.execute("""
        ALTER TABLE cfdi
            ADD COLUMN IF NOT EXISTS series_id          BIGINT
                                        REFERENCES cfdi_series(series_id),
            ADD COLUMN IF NOT EXISTS folio              BIGINT,
            ADD COLUMN IF NOT EXISTS cfdi_version       TEXT NOT NULL DEFAULT '4.0',
            ADD COLUMN IF NOT EXISTS issuer_config_id   BIGINT
                                        REFERENCES cfdi_issuer_config(config_id),
            -- Snapshot fiscal del emisor (RTB) al momento de timbrado
            ADD COLUMN IF NOT EXISTS issuer_rfc         TEXT,
            ADD COLUMN IF NOT EXISTS issuer_name        TEXT,
            ADD COLUMN IF NOT EXISTS issuer_tax_regime  TEXT,
            -- Snapshot fiscal del receptor (cliente) al momento de timbrado
            ADD COLUMN IF NOT EXISTS receiver_rfc       TEXT,
            ADD COLUMN IF NOT EXISTS receiver_name      TEXT,
            ADD COLUMN IF NOT EXISTS receiver_tax_regime TEXT,
            ADD COLUMN IF NOT EXISTS receiver_zip       TEXT,
            -- Datos del timbre fiscal digital (TFD) devueltos por el PAC
            ADD COLUMN IF NOT EXISTS sello_cfdi         TEXT,
            ADD COLUMN IF NOT EXISTS sello_sat          TEXT,
            ADD COLUMN IF NOT EXISTS certificate_number TEXT,
            ADD COLUMN IF NOT EXISTS timbre_date        TIMESTAMPTZ,
            -- Rutas de almacenamiento del XML y PDF firmados
            ADD COLUMN IF NOT EXISTS xml_path           TEXT,
            ADD COLUMN IF NOT EXISTS pdf_path           TEXT
    """)

    # ── 5. Ampliar CHECK de cfdi.status ─────────────────────────────────────────
    # La restricción original sólo contemplaba DRAFT/ISSUED/CANCELLED/SUPERSEDED.
    # Agregamos TIMBRADO (post-stamp SAT) y PAID (complementos de pago completos).
    op.execute("ALTER TABLE cfdi DROP CONSTRAINT IF EXISTS cfdi_status_check")
    op.execute("""
        ALTER TABLE cfdi
            ADD CONSTRAINT cfdi_status_check
                CHECK (status IN (
                    'DRAFT','ISSUED','TIMBRADO','CANCELLED','SUPERSEDED','PAID'
                ))
    """)

    # ── 6. ALTER TABLE cfdi_items — claves SAT e IVA explícito ─────────────────
    op.execute("""
        ALTER TABLE cfdi_items
            ADD COLUMN IF NOT EXISTS sat_product_key_id UUID
                                        REFERENCES sat_product_keys(id),
            ADD COLUMN IF NOT EXISTS sat_unit_key_id    UUID
                                        REFERENCES sat_unit_keys(id),
            ADD COLUMN IF NOT EXISTS iva_pct            NUMERIC(6,4) NOT NULL DEFAULT 0.16
    """)

    # ── 7. ALTER TABLE cfdi_credit_notes — tipo de relación SAT ────────────────
    # c_TipoRelacion: 01 nota de crédito, 03 devolución, 04 sustitución, etc.
    op.execute("""
        ALTER TABLE cfdi_credit_notes
            ADD COLUMN IF NOT EXISTS relation_type TEXT
                CHECK (relation_type IN ('01','02','03','04','05','06','07'))
    """)

    # ── 8. Seed cfdi_series — series default de RTB ────────────────────────────
    op.execute("""
        INSERT INTO cfdi_series (series, cfdi_type, description) VALUES
            ('A',   'I', 'Facturas de venta — serie principal'),
            ('NC',  'E', 'Notas de crédito (devoluciones / descuentos)'),
            ('CP',  'P', 'Complementos de pago PPD'),
            ('EXP', 'I', 'Facturas de exportación')
        ON CONFLICT (series, cfdi_type) DO NOTHING
    """)

    # ── 9. RBAC: permisos del módulo CFDI ──────────────────────────────────────
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
            ('cfdi.view',           'Ver comprobantes fiscales digitales'),
            ('cfdi.issue',          'Emitir y timbrar CFDI'),
            ('cfdi.cancel',         'Cancelar CFDI ante el SAT'),
            ('cfdi.config.manage',  'Gestionar configuración fiscal y credenciales PAC')
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM permissions WHERE code IN ('cfdi.view','cfdi.issue','cfdi.cancel','cfdi.config.manage')")

    op.execute("DELETE FROM cfdi_series WHERE series IN ('A','NC','CP','EXP') AND cfdi_type IN ('I','E','P')")

    op.execute("""
        ALTER TABLE cfdi_credit_notes
            DROP COLUMN IF EXISTS relation_type
    """)

    op.execute("""
        ALTER TABLE cfdi_items
            DROP COLUMN IF EXISTS sat_product_key_id,
            DROP COLUMN IF EXISTS sat_unit_key_id,
            DROP COLUMN IF EXISTS iva_pct
    """)

    op.execute("ALTER TABLE cfdi DROP CONSTRAINT IF EXISTS cfdi_status_check")
    op.execute("""
        ALTER TABLE cfdi
            ADD CONSTRAINT cfdi_status_check
                CHECK (status IN ('DRAFT','ISSUED','CANCELLED','SUPERSEDED'))
    """)

    op.execute("""
        ALTER TABLE cfdi
            DROP COLUMN IF EXISTS series_id,
            DROP COLUMN IF EXISTS folio,
            DROP COLUMN IF EXISTS cfdi_version,
            DROP COLUMN IF EXISTS issuer_config_id,
            DROP COLUMN IF EXISTS issuer_rfc,
            DROP COLUMN IF EXISTS issuer_name,
            DROP COLUMN IF EXISTS issuer_tax_regime,
            DROP COLUMN IF EXISTS receiver_rfc,
            DROP COLUMN IF EXISTS receiver_name,
            DROP COLUMN IF EXISTS receiver_tax_regime,
            DROP COLUMN IF EXISTS receiver_zip,
            DROP COLUMN IF EXISTS sello_cfdi,
            DROP COLUMN IF EXISTS sello_sat,
            DROP COLUMN IF EXISTS certificate_number,
            DROP COLUMN IF EXISTS timbre_date,
            DROP COLUMN IF EXISTS xml_path,
            DROP COLUMN IF EXISTS pdf_path
    """)

    op.execute("DROP INDEX IF EXISTS ix_cfdi_pac_log_req_at")
    op.execute("DROP INDEX IF EXISTS ix_cfdi_pac_log_cfdi")
    op.execute("DROP TABLE IF EXISTS cfdi_pac_log")
    op.execute("DROP TABLE IF EXISTS cfdi_series")
    op.execute("DROP TABLE IF EXISTS cfdi_issuer_config")
