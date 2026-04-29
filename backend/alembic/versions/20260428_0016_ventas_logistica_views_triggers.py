"""ventas_logistica: vistas derivadas, triggers y seeds RBAC

Cambios:
  1.  fn_sync_shipped_qty          — trigger: sincroniza quantity_shipped en order_items
  2.  trg_sync_shipped_qty         — trigger en shipment_items (INSERT/UPDATE/DELETE)
  3.  fn_on_shipment_delivered     — trigger: actualiza delivery_date + inserta milestone
  4.  trg_shipment_delivered       — trigger en shipments AFTER UPDATE
  5.  fn_packing_inv_movement      — trigger: genera movimiento ISSUE en inventario al empacar
  6.  trg_packing_inv_movement     — trigger en order_items AFTER UPDATE OF quantity_packed
  7.  fn_create_order_from_quote   — trigger: crea orders+order_items al aprobar quote
  8.  trg_create_order_from_quote  — trigger en quotes AFTER UPDATE
  9.  VIEW v_order_packing_progress
  10. VIEW v_order_payment_status
  11. VIEW v_orders_incomplete_tracking
  12. VIEW v_shipments_overview
  13. VIEW v_cfdi_cancellations
  14. Permisos RBAC nuevos: delivery_note.*, shipment.*, route.*, order.create/manage
  15. Rol DRIVER + asignación de permisos
  16. Asignación de permisos nuevos a roles existentes

Revision ID: 20260428_0016
Revises: 20260428_0015
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0016"
down_revision: str = "20260428_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1-2. fn_sync_shipped_qty + trigger ────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_sync_shipped_qty()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE order_items
                SET quantity_shipped = quantity_shipped + NEW.quantity,
                    updated_at = NOW()
                WHERE order_item_id = NEW.order_item_id;

            ELSIF TG_OP = 'UPDATE' THEN
                UPDATE order_items
                SET quantity_shipped = quantity_shipped + (NEW.quantity - OLD.quantity),
                    updated_at = NOW()
                WHERE order_item_id = NEW.order_item_id;

            ELSIF TG_OP = 'DELETE' THEN
                UPDATE order_items
                SET quantity_shipped = GREATEST(0, quantity_shipped - OLD.quantity),
                    updated_at = NOW()
                WHERE order_item_id = OLD.order_item_id;
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$
    """)

    op.execute("""
        CREATE TRIGGER trg_sync_shipped_qty
        AFTER INSERT OR UPDATE OR DELETE ON shipment_items
        FOR EACH ROW EXECUTE FUNCTION fn_sync_shipped_qty()
    """)

    # ── 3-4. fn_on_shipment_delivered + trigger ────────��──────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_on_shipment_delivered()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.status = 'DELIVERED'
               AND (OLD.status IS DISTINCT FROM 'DELIVERED') THEN

                UPDATE orders
                SET delivery_date = COALESCE(NEW.actual_arrival, CURRENT_DATE),
                    status = CASE
                        WHEN status NOT IN ('INVOICED','PARTIALLY_PAID','PAID','CANCELLED')
                        THEN 'DELIVERED'
                        ELSE status
                    END,
                    updated_at = NOW()
                WHERE order_id = NEW.order_id;

                INSERT INTO order_milestones (order_id, milestone_type, notes)
                VALUES (
                    NEW.order_id,
                    'DELIVERED',
                    'Entregado vía envío ' || NEW.shipment_number
                );
            END IF;
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        CREATE TRIGGER trg_shipment_delivered
        AFTER UPDATE ON shipments
        FOR EACH ROW EXECUTE FUNCTION fn_on_shipment_delivered()
    """)

    # ── 5-6. fn_packing_inv_movement + trigger ──────��─────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_packing_inv_movement()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_qty_delta NUMERIC(14,4);
        BEGIN
            v_qty_delta := NEW.quantity_packed - OLD.quantity_packed;
            IF v_qty_delta = 0 OR NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            INSERT INTO movimientos_inventario (
                id, product_id, movement_type, qty_out,
                moved_on, origin, observations
            )
            VALUES (
                gen_random_uuid(),
                NEW.product_id,
                'ISSUE',
                v_qty_delta,
                NOW(),
                'Pedido ' || NEW.order_id::text,
                'Empacado order_item ' || NEW.order_item_id::text
            );
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        CREATE TRIGGER trg_packing_inv_movement
        AFTER UPDATE OF quantity_packed ON order_items
        FOR EACH ROW EXECUTE FUNCTION fn_packing_inv_movement()
    """)

    # ── 7-8. fn_create_order_from_quote + trigger ──────���──────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_create_order_from_quote()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_order_id BIGINT;
        BEGIN
            IF NEW.status = 'APPROVED'
               AND (OLD.status IS DISTINCT FROM 'APPROVED') THEN

                INSERT INTO orders (
                    order_number,
                    quote_id, customer_id, sales_rep_id, status,
                    order_date, shipping_address_id,
                    currency, exchange_rate, payment_terms,
                    subtotal, tax_amount, total
                )
                VALUES (
                    'ORD-TEMP',
                    NEW.quote_id, NEW.customer_id, NEW.sales_rep_id, 'CREATED',
                    CURRENT_DATE, NEW.shipping_address_id,
                    NEW.currency, NEW.exchange_rate, NEW.payment_terms,
                    NEW.subtotal, NEW.tax_amount, NEW.total
                )
                RETURNING order_id INTO v_order_id;

                -- Asignar número definitivo usando el ID generado
                UPDATE orders
                SET order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-'
                                   || LPAD(v_order_id::text, 5, '0')
                WHERE order_id = v_order_id;

                -- Copiar partidas
                INSERT INTO order_items (
                    order_id, quote_item_id, product_id, sku, description,
                    quantity_ordered, unit_price, discount_pct, tax_rate,
                    subtotal, tax_amount, total, sort_order
                )
                SELECT
                    v_order_id, qi.quote_item_id, qi.product_id, qi.sku, qi.description,
                    qi.quantity, qi.unit_price, qi.discount_pct, qi.tax_rate,
                    qi.subtotal, qi.tax_amount, qi.total, qi.sort_order
                FROM quote_items qi
                WHERE qi.quote_id = NEW.quote_id;

                -- Milestone inicial
                INSERT INTO order_milestones (order_id, milestone_type, notes)
                VALUES (
                    v_order_id,
                    'CREATED',
                    'Pedido creado automáticamente desde cotización ' || NEW.quote_number
                );
            END IF;
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        CREATE TRIGGER trg_create_order_from_quote
        AFTER UPDATE ON quotes
        FOR EACH ROW EXECUTE FUNCTION fn_create_order_from_quote()
    """)

    # ── 9. v_order_packing_progress ───────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_order_packing_progress AS
        SELECT
            o.order_id,
            o.order_number,
            c.business_name                                                AS customer,
            o.status,
            o.packing_status,
            COALESCE(SUM(oi.quantity_ordered), 0)                      AS qty_ordered,
            COALESCE(SUM(oi.quantity_packed), 0)                       AS qty_packed,
            ROUND(
                CASE WHEN COALESCE(SUM(oi.quantity_ordered), 0) = 0 THEN 0
                     ELSE SUM(oi.quantity_packed) * 100.0
                          / SUM(oi.quantity_ordered)
                END, 2
            )                                                           AS packed_pct,
            CASE
                WHEN COALESCE(SUM(oi.quantity_packed), 0) = 0               THEN 'NOT_STARTED'
                WHEN SUM(oi.quantity_packed) >= SUM(oi.quantity_ordered)     THEN 'COMPLETE'
                ELSE 'IN_PROGRESS'
            END                                                         AS computed_status,
            u.full_name                                                 AS assigned_packer
        FROM orders o
        JOIN customers c          ON c.customer_id = o.customer_id
        LEFT JOIN order_items oi  ON oi.order_id = o.order_id
        LEFT JOIN users u         ON u.id = o.packer_id
        GROUP BY o.order_id, o.order_number, c.business_name,
                 o.status, o.packing_status, u.full_name
    """)

    # ── 10. v_order_payment_status ────────────────────────────��───────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_order_payment_status AS
        SELECT
            o.order_id,
            o.order_number,
            o.customer_id,
            c.business_name                                                AS customer,
            o.total,
            COALESCE(SUM(pa.amount_applied), 0)                        AS amount_paid,
            o.total - COALESCE(SUM(pa.amount_applied), 0)              AS amount_pending,
            CASE
                WHEN COALESCE(SUM(pa.amount_applied), 0) <= 0          THEN 'UNPAID'
                WHEN COALESCE(SUM(pa.amount_applied), 0) >= o.total    THEN 'PAID'
                ELSE 'PARTIAL'
            END                                                         AS computed_payment_status,
            MIN(p.payment_date)                                        AS first_payment_date,
            MAX(p.payment_date)                                        AS last_payment_date,
            COUNT(DISTINCT p.payment_id)                               AS num_payments
        FROM orders o
        JOIN customers c                 ON c.customer_id = o.customer_id
        LEFT JOIN payment_applications pa ON pa.order_id = o.order_id
        LEFT JOIN payments p              ON p.payment_id = pa.payment_id
        GROUP BY o.order_id, o.order_number, o.customer_id, c.business_name, o.total
    """)

    # ── 11. v_orders_incomplete_tracking ──────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_orders_incomplete_tracking AS
        SELECT
            o.order_id,
            o.order_number,
            c.business_name                                                    AS customer,
            o.status,
            o.order_date,
            (CURRENT_DATE - o.order_date)                                   AS days_open,
            COALESCE(SUM(oi.quantity_ordered), 0)                           AS qty_total,
            COALESCE(SUM(oi.quantity_shipped), 0)                           AS qty_shipped,
            COALESCE(SUM(oi.quantity_ordered), 0)
                - COALESCE(SUM(oi.quantity_shipped), 0)                     AS qty_pending_to_ship,
            CASE
                WHEN SUM(oi.quantity_ordered) > 0
                     AND SUM(oi.quantity_ordered) = SUM(oi.quantity_shipped)
                THEN o.delivery_date
            END                                                             AS completion_date
        FROM orders o
        JOIN customers c          ON c.customer_id = o.customer_id
        LEFT JOIN order_items oi  ON oi.order_id = o.order_id
        WHERE o.status NOT IN ('CANCELLED','PAID')
        GROUP BY o.order_id, o.order_number, c.business_name,
                 o.status, o.order_date, o.delivery_date
    """)

    # ── 12. v_shipments_overview ───────────���──────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_shipments_overview AS
        SELECT
            s.shipment_id,
            s.shipment_number,
            s.status,
            o.order_id,
            o.order_number,
            c.business_name                                AS customer,
            ca.name                                     AS carrier_name,
            s.tracking_number,
            s.shipping_date,
            s.estimated_arrival,
            s.actual_arrival,
            CASE
                WHEN s.shipping_date IS NOT NULL
                THEN (CURRENT_DATE - s.shipping_date)
            END                                         AS days_in_transit,
            s.received_by_name,
            s.incident_notes
        FROM shipments s
        JOIN orders o          ON o.order_id   = s.order_id
        JOIN customers c       ON c.customer_id = o.customer_id
        LEFT JOIN carriers ca  ON ca.carrier_id = s.carrier_id
    """)

    # ── 13. v_cfdi_cancellations ──���─────────────────��─────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_cfdi_cancellations AS
        SELECT
            cf.cfdi_id,
            cf.cfdi_number,
            cf.uuid,
            cf.customer_id,
            c.business_name                            AS customer,
            cf.total,
            cf.status,
            cf.cancelled_at,
            cf.cancellation_reason,
            cf.sat_cancellation_motive,
            cf.sat_cancellation_uuid_substitute,
            sub.cfdi_number                         AS substitute_cfdi_number,
            sub.uuid                                AS substitute_uuid,
            sub.status                              AS substitute_status
        FROM cfdi cf
        JOIN customers c       ON c.customer_id = cf.customer_id
        LEFT JOIN cfdi sub     ON sub.cfdi_id = cf.replaced_by_cfdi_id
        WHERE cf.status = 'CANCELLED'
    """)

    # ── 14. Permisos RBAC nuevos ─��────────────────────────────────────��───────
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
        ('delivery_note.create',    'Crear nota de remisión informal'),
        ('delivery_note.manage',    'Editar y gestionar notas de remisión'),
        ('delivery_note.invoice',   'Asociar NR a cotización y facturar'),
        ('shipment.create',         'Crear envío para un pedido'),
        ('shipment.manage',         'Editar y gestionar envíos'),
        ('shipment.track.update',   'Agregar eventos de tracking a un envío'),
        ('route.create',            'Planear nueva ruta del día'),
        ('route.manage',            'Editar y gestionar rutas'),
        ('route.execute',           'Ejecutar paradas de ruta (chofer)'),
        ('order.create',            'Crear pedido manualmente'),
        ('order.manage',            'Editar datos del pedido')
    """)

    # ── 15. Rol DRIVER ────────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO roles (code, name, description) VALUES
        ('DRIVER', 'Chofer', 'Ejecución de rutas y actualización de tracking')
    """)

    # ── 16. Asignación de permisos a roles ────��───────────────────────────────
    # ADMIN: todos los permisos nuevos
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p
        WHERE r.code = 'ADMIN'
          AND p.code IN (
            'delivery_note.create','delivery_note.manage','delivery_note.invoice',
            'shipment.create','shipment.manage','shipment.track.update',
            'route.create','route.manage','route.execute',
            'order.create','order.manage'
          )
        ON CONFLICT DO NOTHING
    """)

    # SALES
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p
        WHERE r.code = 'SALES'
          AND p.code IN (
            'delivery_note.create','delivery_note.manage',
            'order.create','order.manage',
            'shipment.track.update'
          )
        ON CONFLICT DO NOTHING
    """)

    # ACCOUNTING
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p
        WHERE r.code = 'ACCOUNTING'
          AND p.code IN ('delivery_note.invoice')
        ON CONFLICT DO NOTHING
    """)

    # WAREHOUSE
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p
        WHERE r.code = 'WAREHOUSE'
          AND p.code IN (
            'shipment.create','shipment.manage','shipment.track.update',
            'route.create','route.manage',
            'order.create','order.manage'
          )
        ON CONFLICT DO NOTHING
    """)

    # DRIVER
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p
        WHERE r.code = 'DRIVER'
          AND p.code IN ('route.execute','shipment.track.update')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    # Revocar permisos nuevos
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT permission_id FROM permissions
            WHERE code IN (
                'delivery_note.create','delivery_note.manage','delivery_note.invoice',
                'shipment.create','shipment.manage','shipment.track.update',
                'route.create','route.manage','route.execute',
                'order.create','order.manage'
            )
        )
    """)
    op.execute("""
        DELETE FROM permissions
        WHERE code IN (
            'delivery_note.create','delivery_note.manage','delivery_note.invoice',
            'shipment.create','shipment.manage','shipment.track.update',
            'route.create','route.manage','route.execute',
            'order.create','order.manage'
        )
    """)
    op.execute("DELETE FROM roles WHERE code = 'DRIVER'")

    op.execute("DROP VIEW IF EXISTS v_cfdi_cancellations")
    op.execute("DROP VIEW IF EXISTS v_shipments_overview")
    op.execute("DROP VIEW IF EXISTS v_orders_incomplete_tracking")
    op.execute("DROP VIEW IF EXISTS v_order_payment_status")
    op.execute("DROP VIEW IF EXISTS v_order_packing_progress")

    op.execute("DROP TRIGGER IF EXISTS trg_create_order_from_quote ON quotes")
    op.execute("DROP FUNCTION IF EXISTS fn_create_order_from_quote()")
    op.execute("DROP TRIGGER IF EXISTS trg_packing_inv_movement ON order_items")
    op.execute("DROP FUNCTION IF EXISTS fn_packing_inv_movement()")
    op.execute("DROP TRIGGER IF EXISTS trg_shipment_delivered ON shipments")
    op.execute("DROP FUNCTION IF EXISTS fn_on_shipment_delivered()")
    op.execute("DROP TRIGGER IF EXISTS trg_sync_shipped_qty ON shipment_items")
    op.execute("DROP FUNCTION IF EXISTS fn_sync_shipped_qty()")
