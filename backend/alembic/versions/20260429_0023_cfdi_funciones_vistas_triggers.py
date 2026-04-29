"""cfdi: funciones, vistas y triggers

Cambios:
  1. fn_assign_cfdi_folio(p_series TEXT)  — asignación atómica de folio con FOR UPDATE
  2. fn_cfdi_auto_paid()                  — trigger: marca CFDI como PAID cuando
                                             la suma de pagos cubre el total
  3. trg_cfdi_auto_paid                   — dispara fn_cfdi_auto_paid AFTER INSERT/UPDATE
                                             en cfdi_payments
  4. v_cfdi_ppd_pending_payment           — CFDIs PPD con saldo pendiente (cuentas x cobrar)
  5. v_cfdi_status_summary                — resumen por tipo / serie / status

Revision ID: 20260429_0023
Revises: 20260429_0022
Create Date: 2026-04-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260429_0023"
down_revision: str = "20260429_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. fn_assign_cfdi_folio ─────────────────────────────────────────────────
    # Asigna el siguiente folio disponible para la serie indicada de forma
    # atómica: el SELECT … FOR UPDATE bloquea la fila durante la transacción,
    # evitando folios duplicados bajo alta concurrencia.
    # Retorna (series_id, folio) — el folio asignado es el valor ANTES del
    # incremento (i.e., el folio que le corresponde al nuevo CFDI).
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_assign_cfdi_folio(p_series TEXT)
        RETURNS TABLE (out_series_id BIGINT, out_folio BIGINT)
        LANGUAGE plpgsql AS $$
        BEGIN
            UPDATE cfdi_series
               SET next_folio = next_folio + 1,
                   updated_at = now()
             WHERE series    = p_series
               AND is_active = TRUE
         RETURNING series_id,
                   next_folio - 1   -- folio que se acaba de asignar
            INTO out_series_id, out_folio;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'Serie de CFDI no encontrada o inactiva: %', p_series;
            END IF;

            RETURN NEXT;
        END;
        $$;
    """)

    # ── 2. fn_cfdi_auto_paid ────────────────────────────────────────────────────
    # Trigger que recalcula el total pagado de un CFDI cada vez que se inserta
    # o actualiza un cfdi_payments. Si la suma de amount_paid >= total del CFDI
    # y el CFDI no está cancelado, lo marca como PAID.
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_cfdi_auto_paid()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_total  NUMERIC(14,4);
            v_paid   NUMERIC(14,4);
        BEGIN
            SELECT total INTO v_total
              FROM cfdi
             WHERE cfdi_id = NEW.cfdi_id;

            SELECT COALESCE(SUM(amount_paid), 0) INTO v_paid
              FROM cfdi_payments
             WHERE cfdi_id = NEW.cfdi_id;

            IF v_total IS NOT NULL AND v_total > 0 AND v_paid >= v_total THEN
                UPDATE cfdi
                   SET status     = 'PAID',
                       updated_at = now()
                 WHERE cfdi_id = NEW.cfdi_id
                   AND status NOT IN ('CANCELLED','SUPERSEDED','PAID');
            END IF;

            RETURN NEW;
        END;
        $$;
    """)

    # ── 3. trg_cfdi_auto_paid ───────────────────────────────────────────────────
    op.execute("DROP TRIGGER IF EXISTS trg_cfdi_auto_paid ON cfdi_payments")
    op.execute("""
        CREATE TRIGGER trg_cfdi_auto_paid
        AFTER INSERT OR UPDATE ON cfdi_payments
        FOR EACH ROW EXECUTE FUNCTION fn_cfdi_auto_paid()
    """)

    # ── 4. v_cfdi_ppd_pending_payment ───────────────────────────────────────────
    # Facturas (Tipo I, método PPD) que aún tienen saldo pendiente de pago.
    # Alimenta el panel de cuentas por cobrar y genera alertas de seguimiento.
    # Solo incluye CFDIs activos (excluye CANCELLED y SUPERSEDED).
    op.execute("""
        CREATE OR REPLACE VIEW v_cfdi_ppd_pending_payment AS
        SELECT
            c.cfdi_id,
            c.uuid,
            c.cfdi_number,
            cs.series                                       AS series_code,
            c.folio,
            c.issue_date,
            c.receiver_name                                 AS customer_name,
            c.receiver_rfc                                  AS customer_rfc,
            c.total,
            COALESCE(SUM(cp.amount_paid), 0)                AS paid_amount,
            c.total - COALESCE(SUM(cp.amount_paid), 0)      AS remaining_balance,
            (CURRENT_DATE - c.issue_date)                   AS days_since_issue,
            c.status
        FROM cfdi c
        LEFT JOIN cfdi_series   cs ON cs.series_id = c.series_id
        LEFT JOIN cfdi_payments cp ON cp.cfdi_id   = c.cfdi_id
        WHERE c.cfdi_type      = 'I'
          AND c.payment_method = 'PPD'
          AND c.status NOT IN ('CANCELLED','SUPERSEDED','PAID')
        GROUP BY
            c.cfdi_id, c.uuid, c.cfdi_number,
            cs.series, c.folio, c.issue_date,
            c.receiver_name, c.receiver_rfc, c.total, c.status
        HAVING c.total > COALESCE(SUM(cp.amount_paid), 0)
        ORDER BY c.issue_date ASC
    """)

    # ── 5. v_cfdi_status_summary ────────────────────────────────────────────────
    # Resumen operativo: cuántos CFDIs hay por tipo, serie y status, con totales.
    # Útil para el dashboard de facturación y los KPIs de tesorería.
    op.execute("""
        CREATE OR REPLACE VIEW v_cfdi_status_summary AS
        SELECT
            cfdi_type,
            COALESCE(series, 'SIN_SERIE')   AS series,
            status,
            COUNT(*)                        AS num_cfdis,
            SUM(total)                      AS total_amount,
            MIN(issue_date)                 AS oldest_issue_date,
            MAX(issue_date)                 AS latest_issue_date
        FROM cfdi
        GROUP BY cfdi_type, series, status
        ORDER BY cfdi_type, series, status
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_cfdi_status_summary")
    op.execute("DROP VIEW IF EXISTS v_cfdi_ppd_pending_payment")
    op.execute("DROP TRIGGER IF EXISTS trg_cfdi_auto_paid ON cfdi_payments")
    op.execute("DROP FUNCTION IF EXISTS fn_cfdi_auto_paid()")
    op.execute("DROP FUNCTION IF EXISTS fn_assign_cfdi_folio(TEXT)")
