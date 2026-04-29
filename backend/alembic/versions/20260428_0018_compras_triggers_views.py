"""compras: triggers, vista v_purchase_chain y seed de catálogos SAT

Cambios:
  1.  fn_update_pri_quantity_ordered    — sync quantity_ordered en purchase_request_items
  2.  trg_pri_quantity_ordered          — dispara al insertar/actualizar/borrar purchase_order_items
  3.  fn_validate_po_has_request        — valida que PO GOODS tenga items vinculados a PR
  4.  trg_validate_po_has_request       — dispara antes de confirmar purchase_orders
  5.  fn_create_inv_movement_from_receipt — crea movimiento RECEIPT en movimientos_inventario
  6.  trg_inv_movement_from_receipt     — dispara al insertar goods_receipt_items
  7.  fn_validate_invoice_chain         — valida goods_receipt antes de pagar factura de bienes
  8.  trg_validate_invoice_chain        — dispara antes de UPDATE payment_status en supplier_invoices
  9.  fn_update_poi_received            — sync quantity_received en purchase_order_items
  10. trg_poi_received                  — dispara al insertar/actualizar goods_receipt_items
  11. VIEW v_purchase_chain             — trazabilidad completa PR→PO→GR→INV→PAID
  12. Seed sat_payment_forms            — 8 formas de pago SAT (c_FormaPago)
  13. Seed sat_payment_methods          — PUE y PPD (c_MetodoPago)
  14. Permisos RBAC nuevos del módulo de compras

Revision ID: 20260428_0018
Revises: 20260428_0017
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0018"
down_revision: str = "20260428_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1-2. fn_update_pri_quantity_ordered + trigger ─────────────────────────
    # Mantiene purchase_request_items.quantity_ordered sincronizado con las PO
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_pri_quantity_ordered()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.request_item_id IS NOT NULL THEN
                    UPDATE purchase_request_items
                       SET quantity_ordered = quantity_ordered + NEW.quantity_ordered,
                           updated_at = NOW()
                     WHERE request_item_id = NEW.request_item_id;
                END IF;
                RETURN NEW;

            ELSIF TG_OP = 'UPDATE' THEN
                IF NEW.request_item_id IS NOT NULL THEN
                    UPDATE purchase_request_items
                       SET quantity_ordered = quantity_ordered
                                            + (NEW.quantity_ordered - OLD.quantity_ordered),
                           updated_at = NOW()
                     WHERE request_item_id = NEW.request_item_id;
                END IF;
                RETURN NEW;

            ELSIF TG_OP = 'DELETE' THEN
                IF OLD.request_item_id IS NOT NULL THEN
                    UPDATE purchase_request_items
                       SET quantity_ordered = GREATEST(0,
                               quantity_ordered - OLD.quantity_ordered),
                           updated_at = NOW()
                     WHERE request_item_id = OLD.request_item_id;
                END IF;
                RETURN OLD;
            END IF;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER trg_pri_quantity_ordered
        AFTER INSERT OR UPDATE OF quantity_ordered OR DELETE
        ON purchase_order_items
        FOR EACH ROW EXECUTE FUNCTION fn_update_pri_quantity_ordered()
    """)

    # ── 3-4. fn_validate_po_has_request + trigger ─────────────────────────────
    # Impide confirmar una PO de GOODS sin items vinculados a una PR
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_validate_po_has_request()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.status = 'CONFIRMED' AND OLD.status <> 'CONFIRMED'
               AND NEW.po_type = 'GOODS' THEN
                IF NOT EXISTS (
                    SELECT 1 FROM purchase_order_items
                     WHERE po_id = NEW.po_id
                       AND request_item_id IS NOT NULL
                ) THEN
                    RAISE EXCEPTION
                        'PO de bienes no puede confirmarse sin items vinculados a una purchase_request.';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER trg_validate_po_has_request
        BEFORE UPDATE OF status
        ON purchase_orders
        FOR EACH ROW EXECUTE FUNCTION fn_validate_po_has_request()
    """)

    # ── 5-6. fn_create_inv_movement_from_receipt + trigger ────────────────────
    # Al recibir mercancía, crea un movimiento RECEIPT y recalcula el costo promedio
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_create_inv_movement_from_receipt()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_receipt_number TEXT;
            v_current_qty    NUMERIC;
            v_current_cost   NUMERIC;
            v_new_avg_cost   NUMERIC;
        BEGIN
            -- Solo aplica para items con producto (no servicios)
            IF NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            SELECT receipt_number INTO v_receipt_number
              FROM goods_receipts WHERE receipt_id = NEW.receipt_id;

            -- Insertar movimiento RECEIPT en movimientos_inventario
            INSERT INTO movimientos_inventario (
                id, product_id, movement_type, qty_in, unit_cost,
                moved_on, origin, observations, created_at
            ) VALUES (
                gen_random_uuid(),
                NEW.product_id,
                'RECEIPT',
                NEW.quantity_received,
                NEW.unit_cost,
                NOW(),
                'GR-' || COALESCE(v_receipt_number, NEW.receipt_id::TEXT),
                'Generado automáticamente por recepción de mercancía',
                NOW()
            );

            -- Recalcular costo promedio móvil en inventario
            SELECT COALESCE(real_qty, 0), COALESCE(unit_cost, 0)
              INTO v_current_qty, v_current_cost
              FROM inventario
             WHERE product_id = NEW.product_id
             LIMIT 1;

            IF v_current_qty + NEW.quantity_received > 0 THEN
                v_new_avg_cost := (
                    (v_current_qty * v_current_cost)
                    + (NEW.quantity_received * COALESCE(NEW.unit_cost, 0))
                ) / (v_current_qty + NEW.quantity_received);

                UPDATE inventario
                   SET real_qty         = COALESCE(real_qty, 0) + NEW.quantity_received,
                       inbound_real     = COALESCE(inbound_real, 0) + NEW.quantity_received,
                       unit_cost        = v_new_avg_cost,
                       stock_total_cost = (COALESCE(real_qty, 0) + NEW.quantity_received)
                                          * v_new_avg_cost,
                       last_inbound_on  = CURRENT_DATE,
                       updated_on       = NOW()
                 WHERE product_id = NEW.product_id;
            END IF;

            RETURN NEW;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER trg_inv_movement_from_receipt
        AFTER INSERT
        ON goods_receipt_items
        FOR EACH ROW EXECUTE FUNCTION fn_create_inv_movement_from_receipt()
    """)

    # ── 7-8. fn_validate_invoice_chain + trigger ──────────────────────────────
    # Antes de marcar una factura de BIENES como PAID, verifica que exista una GR
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_validate_invoice_chain()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.payment_status = 'PAID' AND OLD.payment_status <> 'PAID' THEN
                IF NEW.invoice_type IN ('GOODS','MIXED') THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM goods_receipts
                         WHERE supplier_invoice_id = NEW.invoice_id
                    ) THEN
                        RAISE EXCEPTION
                            'No se puede marcar como PAID factura de bienes sin recepción registrada.';
                    END IF;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER trg_validate_invoice_chain
        BEFORE UPDATE OF payment_status
        ON supplier_invoices
        FOR EACH ROW EXECUTE FUNCTION fn_validate_invoice_chain()
    """)

    # ── 9-10. fn_update_poi_received + trigger ────────────────────────────────
    # Sincroniza quantity_received en purchase_order_items al recibir mercancía
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_poi_received()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE purchase_order_items
                   SET quantity_received = quantity_received + NEW.quantity_received,
                       updated_at = NOW()
                 WHERE po_item_id = NEW.po_item_id;
                RETURN NEW;

            ELSIF TG_OP = 'UPDATE' THEN
                UPDATE purchase_order_items
                   SET quantity_received = quantity_received
                                         + (NEW.quantity_received - OLD.quantity_received),
                       updated_at = NOW()
                 WHERE po_item_id = NEW.po_item_id;
                RETURN NEW;

            ELSIF TG_OP = 'DELETE' THEN
                UPDATE purchase_order_items
                   SET quantity_received = GREATEST(0,
                           quantity_received - OLD.quantity_received),
                       updated_at = NOW()
                 WHERE po_item_id = OLD.po_item_id;
                RETURN OLD;
            END IF;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER trg_poi_received
        AFTER INSERT OR UPDATE OF quantity_received OR DELETE
        ON goods_receipt_items
        FOR EACH ROW EXECUTE FUNCTION fn_update_poi_received()
    """)

    # ── 11. VIEW v_purchase_chain ─────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_purchase_chain AS
        SELECT
            pr.request_number,
            pr.request_date,
            pr.status                           AS request_status,
            pri.request_item_id,
            pri.line_number                     AS pri_line,
            pri.item_type,
            COALESCE(p.sku, pri.service_description) AS item_description,
            pri.quantity_requested,
            pri.quantity_ordered,
            po.po_number,
            po.po_type,
            po.status                           AS po_status,
            poi.quantity_ordered                AS po_qty_ordered,
            poi.unit_cost                       AS po_unit_cost,
            gr.receipt_number,
            gr.receipt_date,
            gri.quantity_received               AS gr_qty_received,
            si.invoice_number,
            si.invoice_date,
            si.invoice_type,
            si.status                           AS invoice_status,
            si.payment_status,
            si.sat_payment_form_id,
            si.sat_payment_method_id,
            si.is_credit,
            si.payment_date
        FROM purchase_requests pr
        JOIN purchase_request_items pri  ON pri.request_id      = pr.request_id
        LEFT JOIN purchase_order_items poi ON poi.request_item_id = pri.request_item_id
        LEFT JOIN purchase_orders po    ON po.po_id              = poi.po_id
        LEFT JOIN goods_receipt_items gri ON gri.po_item_id      = poi.po_item_id
        LEFT JOIN goods_receipts gr     ON gr.receipt_id          = gri.receipt_id
        LEFT JOIN supplier_invoices si  ON si.po_id               = po.po_id
        LEFT JOIN productos p           ON p.id                   = pri.product_id
    """)

    # ── 12. Seed sat_payment_forms ────────────────────────────────────────────
    op.execute("""
        INSERT INTO sat_payment_forms (form_id, description) VALUES
            ('01', 'Efectivo'),
            ('02', 'Cheque nominativo'),
            ('03', 'Transferencia electrónica de fondos'),
            ('04', 'Tarjeta de crédito'),
            ('05', 'Monedero electrónico'),
            ('06', 'Dinero electrónico'),
            ('28', 'Tarjeta de débito'),
            ('99', 'Por definir')
        ON CONFLICT (form_id) DO NOTHING
    """)

    # ── 13. Seed sat_payment_methods ──────────────────────────────────────────
    op.execute("""
        INSERT INTO sat_payment_methods (method_id, description) VALUES
            ('PUE', 'Pago en una sola exhibición'),
            ('PPD', 'Pago en parcialidades o diferido')
        ON CONFLICT (method_id) DO NOTHING
    """)

    # ── 14. Permisos RBAC del módulo de compras ───────────────────────────────
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
            ('compras.view',    'Ver solicitudes, OCs, recepciones y facturas'),
            ('compras.create',  'Crear solicitudes de material y OCs'),
            ('compras.confirm', 'Confirmar y gestionar OCs'),
            ('compras.receive', 'Registrar recepciones de mercancía'),
            ('compras.invoice', 'Capturar facturas de proveedor y pagos'),
            ('gastos.view',     'Ver gastos operativos'),
            ('gastos.create',   'Crear y editar gastos operativos')
        ON CONFLICT (code) DO NOTHING
    """)

    # Asignar todos los permisos al rol ADMIN
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
          FROM roles r, permissions p
         WHERE r.code = 'ADMIN'
           AND p.code IN (
               'compras.view','compras.create','compras.confirm',
               'compras.receive','compras.invoice',
               'gastos.view','gastos.create'
           )
        ON CONFLICT DO NOTHING
    """)

    # Asignar permisos de lectura al rol READ_ONLY
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
          FROM roles r, permissions p
         WHERE r.code = 'READ_ONLY'
           AND p.code IN ('compras.view','gastos.view')
        ON CONFLICT DO NOTHING
    """)

    # Asignar permisos operativos al rol PURCHASING
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
          FROM roles r, permissions p
         WHERE r.code = 'PURCHASING'
           AND p.code IN (
               'compras.view','compras.create','compras.confirm',
               'compras.receive','compras.invoice',
               'gastos.view','gastos.create'
           )
        ON CONFLICT DO NOTHING
    """)

    # Asignar vista de compras al rol ACCOUNTING
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
          FROM roles r, permissions p
         WHERE r.code = 'ACCOUNTING'
           AND p.code IN ('compras.view','compras.invoice','gastos.view','gastos.create')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_purchase_chain")
    op.execute("DROP TRIGGER IF EXISTS trg_poi_received ON goods_receipt_items")
    op.execute("DROP FUNCTION IF EXISTS fn_update_poi_received")
    op.execute("DROP TRIGGER IF EXISTS trg_validate_invoice_chain ON supplier_invoices")
    op.execute("DROP FUNCTION IF EXISTS fn_validate_invoice_chain")
    op.execute("DROP TRIGGER IF EXISTS trg_inv_movement_from_receipt ON goods_receipt_items")
    op.execute("DROP FUNCTION IF EXISTS fn_create_inv_movement_from_receipt")
    op.execute("DROP TRIGGER IF EXISTS trg_validate_po_has_request ON purchase_orders")
    op.execute("DROP FUNCTION IF EXISTS fn_validate_po_has_request")
    op.execute("DROP TRIGGER IF EXISTS trg_pri_quantity_ordered ON purchase_order_items")
    op.execute("DROP FUNCTION IF EXISTS fn_update_pri_quantity_ordered")
    op.execute("""
        DELETE FROM role_permissions
         WHERE permission_id IN (
             SELECT permission_id FROM permissions
              WHERE code IN (
                  'compras.view','compras.create','compras.confirm',
                  'compras.receive','compras.invoice',
                  'gastos.view','gastos.create'
              )
         )
    """)
    op.execute("""
        DELETE FROM permissions
         WHERE code IN (
             'compras.view','compras.create','compras.confirm',
             'compras.receive','compras.invoice',
             'gastos.view','gastos.create'
         )
    """)
    op.execute("DELETE FROM sat_payment_methods")
    op.execute("DELETE FROM sat_payment_forms")
