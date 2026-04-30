-- =====================================================================
-- RTB - Vistas y Triggers
-- Reglas derivadas: stock actual, KPIs, sales report, totales automáticos
-- Aplicar después de 03_schema.sql
-- =====================================================================

SET search_path = rtb, public;

-- =====================================================================
-- 1. VISTAS DE INVENTARIO
-- =====================================================================

-- Stock actual por SKU (reemplaza Gestión de Inventario)
-- INCLUYE TODOS los productos activos: vendibles e internos.
-- La columna is_saleable permite filtrar en pantallas distintas.
CREATE OR REPLACE VIEW v_inventory_current AS
SELECT
    p.product_id,
    p.sku,
    p.internal_code,
    p.name,
    p.is_saleable,                                                    -- TRUE = vendible / FALSE = interno
    p.category_id,
    p.min_stock,
    COALESCE(SUM(im.quantity_in), 0)  AS total_in,
    COALESCE(SUM(im.quantity_out), 0) AS total_out,
    COALESCE(SUM(im.quantity_in - im.quantity_out), 0) AS quantity_on_hand,
    -- Costo promedio ponderado de las entradas
    CASE
        WHEN COALESCE(SUM(im.quantity_in), 0) > 0
        THEN SUM(im.quantity_in * COALESCE(im.unit_cost, 0)) / NULLIF(SUM(im.quantity_in), 0)
        ELSE NULL
    END AS avg_unit_cost,
    -- Valor en stock
    COALESCE(SUM(im.quantity_in - im.quantity_out), 0) *
        CASE
            WHEN COALESCE(SUM(im.quantity_in), 0) > 0
            THEN SUM(im.quantity_in * COALESCE(im.unit_cost, 0)) / NULLIF(SUM(im.quantity_in), 0)
            ELSE 0
        END AS total_value,
    -- Última entrada y última salida
    MAX(CASE WHEN im.quantity_in > 0  THEN im.occurred_at END) AS last_receipt_at,
    MAX(CASE WHEN im.quantity_out > 0 THEN im.occurred_at END) AS last_issue_at,
    -- Estado vs stock mínimo
    CASE
        WHEN COALESCE(SUM(im.quantity_in - im.quantity_out), 0) <= 0 THEN 'OUT_OF_STOCK'
        WHEN COALESCE(SUM(im.quantity_in - im.quantity_out), 0) < p.min_stock THEN 'BELOW_MIN'
        WHEN COALESCE(SUM(im.quantity_in - im.quantity_out), 0) < p.min_stock * 1.5 THEN 'NEAR_MIN'
        ELSE 'OK'
    END AS stock_status
FROM products p
LEFT JOIN inventory_movements im ON im.product_id = p.product_id
WHERE p.is_active
GROUP BY p.product_id, p.sku, p.internal_code, p.name, p.is_saleable, p.category_id, p.min_stock;

COMMENT ON VIEW v_inventory_current IS
'Stock actual por SKU desde inventory_movements. Incluye TODOS los productos activos (vendibles e internos). Filtrar por is_saleable según pantalla.';

-- KPIs de inventario (ABC, días sin movimiento, semáforo)
CREATE OR REPLACE VIEW v_inventory_kpis AS
WITH base AS (
    SELECT
        v.*,
        v.quantity_on_hand * COALESCE(v.avg_unit_cost, 0) AS total_value,
        EXTRACT(DAY FROM now() - v.last_issue_at)::INTEGER AS days_without_movement,
        -- Demanda 90 días
        (SELECT COALESCE(SUM(im2.quantity_out), 0)
         FROM inventory_movements im2
         WHERE im2.product_id = v.product_id
           AND im2.movement_type = 'ISSUE'
           AND im2.occurred_at >= now() - INTERVAL '90 days'
        ) AS demand_90d,
        (SELECT COALESCE(SUM(im2.quantity_out), 0)
         FROM inventory_movements im2
         WHERE im2.product_id = v.product_id
           AND im2.movement_type = 'ISSUE'
           AND im2.occurred_at >= now() - INTERVAL '180 days'
        ) AS demand_180d
    FROM v_inventory_current v
),
abc_calc AS (
    SELECT
        b.*,
        b.demand_90d * COALESCE(b.avg_unit_cost, 0) AS revenue_proxy_90d,
        SUM(b.demand_90d * COALESCE(b.avg_unit_cost, 0)) OVER () AS total_revenue_proxy,
        SUM(b.demand_90d * COALESCE(b.avg_unit_cost, 0)) OVER (
            ORDER BY b.demand_90d * COALESCE(b.avg_unit_cost, 0) DESC
        ) AS cumulative_revenue
    FROM base b
)
SELECT
    product_id, sku, internal_code, name,
    quantity_on_hand, avg_unit_cost, total_value,
    min_stock, stock_status,
    last_receipt_at, last_issue_at, days_without_movement,
    demand_90d, demand_180d,
    -- Clasificación ABC por valor de demanda
    CASE
        WHEN total_revenue_proxy IS NULL OR total_revenue_proxy = 0 THEN 'C'
        WHEN cumulative_revenue / total_revenue_proxy <= 0.80 THEN 'A'
        WHEN cumulative_revenue / total_revenue_proxy <= 0.95 THEN 'B'
        ELSE 'C'
    END AS abc_classification,
    -- Semáforo de movimiento
    CASE
        WHEN days_without_movement IS NULL THEN 'NEVER_SOLD'
        WHEN days_without_movement <= 30 THEN 'GREEN'
        WHEN days_without_movement <= 90 THEN 'YELLOW'
        WHEN days_without_movement <= 180 THEN 'ORANGE'
        ELSE 'RED'
    END AS movement_traffic_light,
    -- Acción sugerida
    CASE
        WHEN stock_status = 'OUT_OF_STOCK' AND demand_90d > 0 THEN 'PURCHASE_URGENT'
        WHEN stock_status IN ('BELOW_MIN','NEAR_MIN') THEN 'PURCHASE'
        WHEN days_without_movement > 180 AND quantity_on_hand > 0 THEN 'LIQUIDATE'
        WHEN days_without_movement > 90 THEN 'REVIEW'
        ELSE 'NONE'
    END AS suggested_action
FROM abc_calc;

COMMENT ON VIEW v_inventory_kpis IS
'KPIs derivados de stock: ABC, días sin movimiento, semáforo, acción sugerida.';


-- =====================================================================
-- 2. VISTA DE PEDIDOS INCOMPLETOS (reemplaza tabla Pedidos Incompletos)
-- =====================================================================

CREATE OR REPLACE VIEW v_orders_with_shortage AS
SELECT
    o.*,
    SUM(oi.quantity_ordered - oi.quantity_packed) AS total_quantity_short,
    COUNT(*) FILTER (WHERE oi.quantity_packed < oi.quantity_ordered) AS items_with_shortage,
    COUNT(*) AS total_items
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id
HAVING SUM(oi.quantity_ordered - oi.quantity_packed) > 0;

COMMENT ON VIEW v_orders_with_shortage IS
'Reemplaza la tabla "Pedidos Incompletos". Es solo una vista filtrada de orders con faltantes.';


-- =====================================================================
-- 3. VISTA REPORTE DE VENTAS (reemplaza tabla Reporte de Ventas)
-- =====================================================================

CREATE OR REPLACE VIEW v_sales_report AS
SELECT
    o.order_id,
    o.order_number,
    q.quote_number,
    c.code AS customer_code,
    c.business_name AS customer_name,
    o.order_date,
    EXTRACT(YEAR FROM o.order_date)::INT  AS year,
    EXTRACT(MONTH FROM o.order_date)::INT AS month,
    EXTRACT(QUARTER FROM o.order_date)::INT AS quarter,
    o.status,
    o.payment_status,
    o.invoice_status,
    o.subtotal,
    o.tax_amount,
    o.total,
    -- Costo: snapshot desde quote_items (cost_subtotal)
    q.cost_subtotal,
    o.subtotal - q.cost_subtotal AS gross_margin,
    CASE WHEN o.subtotal > 0 THEN (o.subtotal - q.cost_subtotal) / o.subtotal * 100 ELSE 0 END AS margin_pct,
    -- Diferencia vs PO original (por si la cotización se modificó tras aprobación)
    o.subtotal - q.subtotal AS difference_vs_po,
    -- % empacado (real, calculado)
    (SELECT
        CASE WHEN SUM(oi.quantity_ordered) > 0
             THEN SUM(oi.quantity_packed) / SUM(oi.quantity_ordered) * 100
             ELSE 0 END
     FROM order_items oi WHERE oi.order_id = o.order_id) AS packed_pct
FROM orders o
JOIN quotes q ON q.quote_id = o.quote_id
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status NOT IN ('CANCELLED');

COMMENT ON VIEW v_sales_report IS
'Reemplaza la tabla "Reporte de Ventas". Margen, costo y % empacado calculados en SQL, no en fórmulas de Notion.';


-- =====================================================================
-- 4. TRIGGERS: TOTALES AUTOMÁTICOS EN COTIZACIONES Y PEDIDOS
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_recalc_quote_item()
RETURNS TRIGGER AS $$
BEGIN
    NEW.subtotal     := ROUND(NEW.quantity_requested * NEW.unit_price_sale * (1 - NEW.discount_pct/100), 4);
    NEW.tax_amount   := ROUND(NEW.subtotal * NEW.tax_pct/100, 4);
    NEW.total        := ROUND(NEW.subtotal + NEW.tax_amount, 4);
    NEW.cost_subtotal:= ROUND(NEW.quantity_requested * NEW.unit_cost_purchase, 4);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_quote_item
BEFORE INSERT OR UPDATE OF quantity_requested, unit_price_sale, unit_cost_purchase, discount_pct, tax_pct
ON quote_items
FOR EACH ROW EXECUTE FUNCTION fn_recalc_quote_item();

CREATE OR REPLACE FUNCTION fn_recalc_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_quote_id BIGINT;
BEGIN
    v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
    UPDATE quotes q SET
        subtotal      = COALESCE((SELECT SUM(subtotal)      FROM quote_items WHERE quote_id = v_quote_id), 0),
        tax_amount    = COALESCE((SELECT SUM(tax_amount)    FROM quote_items WHERE quote_id = v_quote_id), 0),
        total         = COALESCE((SELECT SUM(total)         FROM quote_items WHERE quote_id = v_quote_id), 0)
                        + q.shipping_amount - q.discount_amount,
        cost_subtotal = COALESCE((SELECT SUM(cost_subtotal) FROM quote_items WHERE quote_id = v_quote_id), 0),
        updated_at    = now()
    WHERE q.quote_id = v_quote_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW EXECUTE FUNCTION fn_recalc_quote_totals();

-- Misma lógica para order_items
CREATE OR REPLACE FUNCTION fn_recalc_order_item()
RETURNS TRIGGER AS $$
BEGIN
    NEW.subtotal   := ROUND(NEW.quantity_ordered * NEW.unit_price_sale * (1 - NEW.discount_pct/100), 4);
    NEW.tax_amount := ROUND(NEW.subtotal * NEW.tax_pct/100, 4);
    NEW.total      := ROUND(NEW.subtotal + NEW.tax_amount, 4);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_order_item
BEFORE INSERT OR UPDATE OF quantity_ordered, unit_price_sale, discount_pct, tax_pct
ON order_items
FOR EACH ROW EXECUTE FUNCTION fn_recalc_order_item();

CREATE OR REPLACE FUNCTION fn_recalc_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id BIGINT;
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);
    UPDATE orders o SET
        subtotal   = COALESCE((SELECT SUM(subtotal)   FROM order_items WHERE order_id = v_order_id), 0),
        tax_amount = COALESCE((SELECT SUM(tax_amount) FROM order_items WHERE order_id = v_order_id), 0),
        total      = COALESCE((SELECT SUM(total)      FROM order_items WHERE order_id = v_order_id), 0)
                     + o.shipping_amount,
        has_shortage = EXISTS(SELECT 1 FROM order_items WHERE order_id = v_order_id AND quantity_packed < quantity_ordered),
        updated_at = now()
    WHERE o.order_id = v_order_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_order_totals
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION fn_recalc_order_totals();


-- =====================================================================
-- 5. TRIGGERS: SINCRONIZACIÓN DE INVENTARIO
-- =====================================================================

-- Cada goods_receipt_item genera un inventory_movement RECEIPT
CREATE OR REPLACE FUNCTION fn_create_inv_movement_from_receipt()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.quantity_received > 0 THEN
        INSERT INTO inventory_movements (
            product_id, movement_type, source_type, source_id,
            quantity_in, unit_cost, occurred_at, notes
        ) VALUES (
            NEW.product_id, 'RECEIPT', 'GOODS_RECEIPT', NEW.receipt_item_id,
            NEW.quantity_received, NEW.unit_cost,
            (SELECT receipt_date FROM goods_receipts WHERE receipt_id = NEW.receipt_id),
            'Auto-generado desde entrada de mercancía'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inv_from_receipt
AFTER INSERT ON goods_receipt_items
FOR EACH ROW EXECUTE FUNCTION fn_create_inv_movement_from_receipt();

-- Cuando se incrementa quantity_packed en order_items, se genera un ISSUE
CREATE OR REPLACE FUNCTION fn_create_inv_movement_from_packing()
RETURNS TRIGGER AS $$
DECLARE
    v_delta NUMERIC(14,4);
    v_avg_cost NUMERIC(14,4);
BEGIN
    v_delta := NEW.quantity_packed - COALESCE(OLD.quantity_packed, 0);
    IF v_delta > 0 THEN
        SELECT avg_unit_cost INTO v_avg_cost FROM v_inventory_current WHERE product_id = NEW.product_id;
        INSERT INTO inventory_movements (
            product_id, movement_type, source_type, source_id,
            quantity_out, unit_cost, occurred_at, notes
        ) VALUES (
            NEW.product_id, 'ISSUE', 'ORDER_ITEM', NEW.order_item_id,
            v_delta, v_avg_cost, now(),
            'Auto-generado desde empacado de pedido'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inv_from_packing
AFTER UPDATE OF quantity_packed ON order_items
FOR EACH ROW
WHEN (NEW.quantity_packed > COALESCE(OLD.quantity_packed, 0))
EXECUTE FUNCTION fn_create_inv_movement_from_packing();

-- No conformidades disparan ajuste
CREATE OR REPLACE FUNCTION fn_create_inv_movement_from_nc()
RETURNS TRIGGER AS $$
DECLARE
    v_movement_id BIGINT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO inventory_movements (
            product_id, movement_type, source_type, source_id,
            quantity_in, quantity_out, occurred_at, notes
        ) VALUES (
            NEW.product_id,
            CASE NEW.adjustment_type WHEN 'IN' THEN 'ADJUSTMENT_IN' ELSE 'ADJUSTMENT_OUT' END,
            'NON_CONFORMITY', NEW.nc_id,
            CASE NEW.adjustment_type WHEN 'IN'  THEN NEW.quantity ELSE 0 END,
            CASE NEW.adjustment_type WHEN 'OUT' THEN NEW.quantity ELSE 0 END,
            NEW.nc_date, 'No conforme: ' || NEW.reason
        ) RETURNING movement_id INTO v_movement_id;

        UPDATE non_conformities SET inventory_movement_id = v_movement_id WHERE nc_id = NEW.nc_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inv_from_nc
AFTER INSERT ON non_conformities
FOR EACH ROW EXECUTE FUNCTION fn_create_inv_movement_from_nc();


-- =====================================================================
-- 6. TRIGGER: HISTORIAL DE CAMBIOS DE ESTADO EN COTIZACIÓN
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_log_quote_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO quote_status_history (quote_id, old_status, new_status, reason, changed_at)
        VALUES (NEW.quote_id, OLD.status, NEW.status, NEW.cancellation_reason, now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_status_change
AFTER UPDATE OF status ON quotes
FOR EACH ROW EXECUTE FUNCTION fn_log_quote_status_change();


-- =====================================================================
-- 7. TRIGGER: CREAR ORDER AL APROBAR QUOTE
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_create_order_from_approved_quote()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id BIGINT;
BEGIN
    IF NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED' THEN
        INSERT INTO orders (
            order_number, quote_id, customer_id, shipping_address_id,
            order_date, approval_date,
            payment_type, delivery_type,
            subtotal, tax_amount, shipping_amount, total
        ) VALUES (
            'ORD-' || NEW.quote_number,
            NEW.quote_id, NEW.customer_id, NEW.customer_address_id,
            CURRENT_DATE, NEW.approval_date,
            NEW.payment_type, NEW.delivery_type,
            NEW.subtotal, NEW.tax_amount, NEW.shipping_amount, NEW.total
        ) RETURNING order_id INTO v_order_id;

        -- Copia los items de la cotización al pedido
        INSERT INTO order_items (
            order_id, quote_item_id, line_number, product_id, product_configuration_id,
            quantity_ordered, unit_price_sale, discount_pct, tax_pct
        )
        SELECT v_order_id, qi.quote_item_id, qi.line_number, qi.product_id, qi.product_configuration_id,
               qi.quantity_requested, qi.unit_price_sale, qi.discount_pct, qi.tax_pct
        FROM quote_items qi WHERE qi.quote_id = NEW.quote_id;

        -- Hito CREATED
        INSERT INTO order_milestones (order_id, milestone_type, milestone_date)
        VALUES (v_order_id, 'CREATED', CURRENT_DATE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_order
AFTER UPDATE OF status ON quotes
FOR EACH ROW EXECUTE FUNCTION fn_create_order_from_approved_quote();


-- =====================================================================
-- 8. TRIGGER GENÉRICO: AUDIT LOG
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_audit_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user BIGINT;
BEGIN
    -- El user_id se setea en sesión: SET LOCAL rtb.current_user_id = '123';
    BEGIN
        v_user := current_setting('rtb.current_user_id', TRUE)::BIGINT;
    EXCEPTION WHEN OTHERS THEN
        v_user := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (user_id, entity_type, entity_id, action, after_data)
        VALUES (v_user, TG_TABLE_NAME, (row_to_json(NEW)->>(TG_ARGV[0]))::BIGINT, 'INSERT', row_to_json(NEW)::JSONB);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (user_id, entity_type, entity_id, action, before_data, after_data)
        VALUES (v_user, TG_TABLE_NAME, (row_to_json(NEW)->>(TG_ARGV[0]))::BIGINT, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, entity_type, entity_id, action, before_data)
        VALUES (v_user, TG_TABLE_NAME, (row_to_json(OLD)->>(TG_ARGV[0]))::BIGINT, 'DELETE', row_to_json(OLD)::JSONB);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Activar auditoría en las tablas críticas (pasar el nombre de la PK como argumento)
CREATE TRIGGER trg_audit_quotes              AFTER INSERT OR UPDATE OR DELETE ON quotes              FOR EACH ROW EXECUTE FUNCTION fn_audit_changes('quote_id');
CREATE TRIGGER trg_audit_orders              AFTER INSERT OR UPDATE OR DELETE ON orders              FOR EACH ROW EXECUTE FUNCTION fn_audit_changes('order_id');
CREATE TRIGGER trg_audit_cfdi                AFTER INSERT OR UPDATE OR DELETE ON cfdi                FOR EACH ROW EXECUTE FUNCTION fn_audit_changes('cfdi_id');
CREATE TRIGGER trg_audit_inventory_movements AFTER INSERT OR UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION fn_audit_changes('movement_id');
CREATE TRIGGER trg_audit_purchase_orders     AFTER INSERT OR UPDATE OR DELETE ON purchase_orders     FOR EACH ROW EXECUTE FUNCTION fn_audit_changes('po_id');


-- =====================================================================
-- 9. PRICING: vista, función helper, trigger de costo promedio, job
-- =====================================================================

-- Vista del precio sugerido por producto (sin contexto de cliente)
CREATE OR REPLACE VIEW v_product_pricing AS
SELECT
    p.product_id,
    p.sku,
    p.name,
    c.category_id,
    c.name AS category_name,
    p.pricing_strategy,
    p.moving_avg_months,
    p.current_avg_cost            AS avg_purchase_cost,
    p.current_avg_cost_currency   AS currency,
    p.current_avg_cost_updated_at AS cost_updated_at,
    c.profit_margin_pct           AS category_margin_pct,
    -- Precio sugerido (sin considerar convenios de cliente)
    CASE
        WHEN p.pricing_strategy = 'PASSTHROUGH' THEN p.current_avg_cost
        WHEN p.pricing_strategy = 'MOVING_AVG'  THEN ROUND(p.current_avg_cost * (1 + c.profit_margin_pct/100), 4)
        ELSE NULL
    END AS suggested_sale_price
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE p.is_active;
COMMENT ON VIEW v_product_pricing IS
  'Precio sugerido de venta por producto sin considerar convenios de cliente. Se basa en current_avg_cost y la estrategia del producto.';


-- Función: precio para un cliente y cantidad concretos
-- Resuelve la cascada: convenio Ariba → estrategia del producto
CREATE OR REPLACE FUNCTION fn_get_quote_pricing(
    p_product_id   BIGINT,
    p_customer_id  BIGINT,
    p_quantity     NUMERIC DEFAULT 1
)
RETURNS TABLE (
    suggested_unit_cost   NUMERIC,
    suggested_unit_price  NUMERIC,
    cost_basis            TEXT,
    contract_price_id     BIGINT,
    pricing_source        TEXT
) AS $$
DECLARE
    v_strategy   TEXT;
    v_margin     NUMERIC;
    v_avg_cost   NUMERIC;
    v_contract   RECORD;
BEGIN
    -- 1. ¿Hay convenio Ariba vigente para este cliente+producto?
    SELECT * INTO v_contract
    FROM customer_contract_prices
    WHERE customer_id = p_customer_id
      AND product_id  = p_product_id
      AND is_current  = TRUE
      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
    ORDER BY valid_from DESC
    LIMIT 1;

    IF v_contract.contract_price_id IS NOT NULL THEN
        RETURN QUERY SELECT
            NULL::NUMERIC,
            v_contract.fixed_sale_price,
            'CONTRACT_FIXED'::TEXT,
            v_contract.contract_price_id,
            v_contract.contract_type;
        RETURN;
    END IF;

    -- 2. Sin convenio: estrategia del producto
    SELECT p.pricing_strategy, c.profit_margin_pct, p.current_avg_cost
      INTO v_strategy, v_margin, v_avg_cost
    FROM products p JOIN categories c ON c.category_id = p.category_id
    WHERE p.product_id = p_product_id;

    IF v_strategy = 'PASSTHROUGH' THEN
        RETURN QUERY SELECT
            v_avg_cost,
            v_avg_cost,                                    -- precio = costo (sin margen)
            'PASSTHROUGH'::TEXT,
            NULL::BIGINT,
            'PRODUCT_DEFAULT'::TEXT;
    ELSE  -- MOVING_AVG
        RETURN QUERY SELECT
            v_avg_cost,
            ROUND(v_avg_cost * (1 + v_margin/100), 4),     -- precio = costo × (1+margen)
            'MOVING_AVG'::TEXT,
            NULL::BIGINT,
            'PRODUCT_DEFAULT'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION fn_get_quote_pricing IS
  'Devuelve costo y precio sugeridos para una cotización (cliente, producto, cantidad). Resuelve convenios Ariba primero, luego estrategia del producto.';


-- Trigger: recalcular current_avg_cost al insertar un movimiento RECEIPT
CREATE OR REPLACE FUNCTION fn_recalc_product_avg_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_new_avg  NUMERIC(14,4);
    v_months   SMALLINT;
    v_prev     NUMERIC(14,4);
BEGIN
    IF NEW.movement_type IN ('RECEIPT','OPENING_BALANCE') AND NEW.quantity_in > 0 THEN
        SELECT moving_avg_months INTO v_months FROM products WHERE product_id = NEW.product_id;

        -- Promedio ponderado de los últimos N meses
        SELECT SUM(quantity_in * COALESCE(unit_cost,0)) / NULLIF(SUM(quantity_in), 0)
          INTO v_new_avg
        FROM inventory_movements
        WHERE product_id = NEW.product_id
          AND movement_type IN ('RECEIPT','OPENING_BALANCE')
          AND occurred_at >= now() - (v_months || ' months')::INTERVAL
          AND quantity_in > 0;

        -- Fallback: si no hay datos en la ventana, usar la última recepción conocida
        IF v_new_avg IS NULL THEN
            SELECT unit_cost INTO v_new_avg
            FROM inventory_movements
            WHERE product_id = NEW.product_id
              AND movement_type IN ('RECEIPT','OPENING_BALANCE')
              AND quantity_in > 0
              AND unit_cost IS NOT NULL
            ORDER BY occurred_at DESC LIMIT 1;
        END IF;

        SELECT current_avg_cost INTO v_prev FROM products WHERE product_id = NEW.product_id;

        UPDATE products SET
            current_avg_cost = v_new_avg,
            current_avg_cost_updated_at = now()
        WHERE product_id = NEW.product_id;

        INSERT INTO product_cost_history (
            product_id, previous_avg_cost, new_avg_cost,
            quantity_received, unit_cost_of_receipt,
            triggered_by, source_id
        ) VALUES (
            NEW.product_id, v_prev, v_new_avg,
            NEW.quantity_in, NEW.unit_cost,
            CASE NEW.movement_type WHEN 'OPENING_BALANCE' THEN 'OPENING_BALANCE' ELSE 'GOODS_RECEIPT' END,
            NEW.movement_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_avg_cost
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION fn_recalc_product_avg_cost();


-- Job nocturno: refresca el promedio para todos los productos
-- Necesario porque la ventana móvil cambia con el paso del tiempo aunque no entren compras.
-- Ejecutar con pg_cron o scheduler externo:  SELECT fn_refresh_all_avg_costs();
CREATE OR REPLACE FUNCTION fn_refresh_all_avg_costs()
RETURNS INTEGER AS $$
DECLARE
    r RECORD;
    v_new_avg NUMERIC(14,4);
    v_prev    NUMERIC(14,4);
    v_count   INTEGER := 0;
BEGIN
    FOR r IN SELECT product_id, moving_avg_months, current_avg_cost FROM products WHERE is_active LOOP
        SELECT SUM(im.quantity_in * COALESCE(im.unit_cost,0)) / NULLIF(SUM(im.quantity_in), 0)
          INTO v_new_avg
        FROM inventory_movements im
        WHERE im.product_id = r.product_id
          AND im.movement_type IN ('RECEIPT','OPENING_BALANCE')
          AND im.occurred_at >= now() - (r.moving_avg_months || ' months')::INTERVAL
          AND im.quantity_in > 0;

        IF v_new_avg IS NULL THEN
            SELECT unit_cost INTO v_new_avg
            FROM inventory_movements
            WHERE product_id = r.product_id
              AND movement_type IN ('RECEIPT','OPENING_BALANCE')
              AND quantity_in > 0 AND unit_cost IS NOT NULL
            ORDER BY occurred_at DESC LIMIT 1;
        END IF;

        IF v_new_avg IS NOT NULL AND v_new_avg <> COALESCE(r.current_avg_cost, -1) THEN
            UPDATE products SET
                current_avg_cost = v_new_avg,
                current_avg_cost_updated_at = now()
            WHERE product_id = r.product_id;

            INSERT INTO product_cost_history (
                product_id, previous_avg_cost, new_avg_cost, triggered_by
            ) VALUES (
                r.product_id, r.current_avg_cost, v_new_avg, 'NIGHTLY_REFRESH'
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION fn_refresh_all_avg_costs IS
  'Refresca current_avg_cost de todos los productos activos. La ventana móvil cambia con el tiempo aunque no entren compras nuevas. Programar diariamente.';


-- =====================================================================
-- 10. ÍNDICES ADICIONALES PARA REPORTES
-- =====================================================================

CREATE INDEX idx_orders_order_date ON orders (order_date DESC);
CREATE INDEX idx_quotes_issue_date_desc ON quotes (issue_date DESC);
CREATE INDEX idx_cfdi_issue_date ON cfdi (issue_date DESC);
CREATE INDEX idx_payments_date ON payments (payment_date DESC);
CREATE INDEX idx_supplier_invoices_date ON supplier_invoices (invoice_date DESC);

-- =====================================================================
-- 11. VISTAS DE LOGÍSTICA Y SEGUIMIENTO
-- =====================================================================

-- Avance de empacado por pedido (reemplaza el tracking manual)
CREATE OR REPLACE VIEW v_order_packing_progress AS
SELECT
    o.order_id,
    o.order_number,
    c.business_name AS customer,
    o.packing_status,
    SUM(oi.quantity_ordered)                         AS qty_ordered,
    SUM(oi.quantity_packed)                          AS qty_packed,
    SUM(oi.quantity_ordered - oi.quantity_packed)    AS qty_pending,
    CASE
        WHEN SUM(oi.quantity_ordered) > 0
        THEN ROUND(SUM(oi.quantity_packed) / SUM(oi.quantity_ordered) * 100, 2)
        ELSE 0
    END AS packed_pct,
    CASE
        WHEN SUM(oi.quantity_packed) = 0                                THEN 'NOT_STARTED'
        WHEN SUM(oi.quantity_packed) < SUM(oi.quantity_ordered)         THEN 'IN_PROGRESS'
        WHEN SUM(oi.quantity_packed) = SUM(oi.quantity_ordered)         THEN 'READY'
    END AS computed_status,
    u.full_name AS assigned_packer
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
LEFT JOIN customers c ON c.customer_id = o.customer_id
LEFT JOIN users u     ON u.user_id    = o.assigned_packer_user_id
WHERE o.status NOT IN ('CANCELLED')
GROUP BY o.order_id, o.order_number, c.business_name, o.packing_status, u.full_name;

COMMENT ON VIEW v_order_packing_progress IS
  'Avance de empacado de cada pedido en %. Útil para planeación de rutas.';


-- Estado de pago por orden (consolida pagos parciales)
CREATE OR REPLACE VIEW v_order_payment_status AS
SELECT
    o.order_id,
    o.order_number,
    c.business_name AS customer,
    o.total,
    COALESCE(SUM(pa.amount_applied), 0)              AS amount_paid,
    o.total - COALESCE(SUM(pa.amount_applied), 0)    AS amount_pending,
    CASE
        WHEN COALESCE(SUM(pa.amount_applied), 0) = 0       THEN 'UNPAID'
        WHEN COALESCE(SUM(pa.amount_applied), 0) < o.total THEN 'PARTIAL'
        ELSE 'PAID'
    END AS computed_payment_status,
    MIN(p.payment_date)              AS first_payment_date,
    MAX(p.payment_date)              AS last_payment_date,
    COUNT(DISTINCT p.payment_id)     AS num_payments
FROM orders o
LEFT JOIN customers c ON c.customer_id = o.customer_id
LEFT JOIN payment_applications pa ON pa.order_id = o.order_id
LEFT JOIN payments p              ON p.payment_id = pa.payment_id
GROUP BY o.order_id, o.order_number, c.business_name, o.total;

COMMENT ON VIEW v_order_payment_status IS
  'Estado de pago calculado: cuánto se pagó, cuánto falta, primera/última fecha, número de parcialidades.';


-- Pedidos incompletos: avance de entrega + cuándo se completaron
CREATE OR REPLACE VIEW v_orders_incomplete_tracking AS
SELECT
    o.order_id,
    o.order_number,
    o.order_date,
    c.business_name AS customer,
    SUM(oi.quantity_ordered)                       AS qty_ordered,
    SUM(oi.quantity_packed)                        AS qty_packed,
    SUM(oi.quantity_shipped)                       AS qty_shipped,
    SUM(oi.quantity_invoiced)                      AS qty_invoiced,
    SUM(oi.quantity_ordered - oi.quantity_shipped) AS qty_pending_to_ship,
    o.has_shortage,
    (CURRENT_DATE - o.order_date) AS days_open,
    CASE
        WHEN SUM(oi.quantity_ordered) = SUM(oi.quantity_shipped)
        THEN MAX(o.delivery_date)
        ELSE NULL
    END AS completion_date
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
LEFT JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status NOT IN ('CANCELLED')
GROUP BY o.order_id, o.order_number, o.order_date, c.business_name, o.has_shortage;

COMMENT ON VIEW v_orders_incomplete_tracking IS
  'Seguimiento de avance de entrega. WHERE qty_pending_to_ship > 0 = pendientes; completion_date = cuándo se completó.';


-- Resumen de envíos con tracking
CREATE OR REPLACE VIEW v_shipments_overview AS
SELECT
    s.shipment_id,
    s.shipment_number,
    s.order_id,
    o.order_number,
    c.business_name AS customer,
    car.name AS carrier,
    s.tracking_number,
    s.status,
    s.shipping_date,
    s.estimated_arrival,
    s.actual_arrival,
    -- Último evento de tracking
    (SELECT description FROM shipment_tracking_events ste
        WHERE ste.shipment_id = s.shipment_id
        ORDER BY event_date DESC LIMIT 1) AS last_event_description,
    (SELECT event_date FROM shipment_tracking_events ste
        WHERE ste.shipment_id = s.shipment_id
        ORDER BY event_date DESC LIMIT 1) AS last_event_date
FROM shipments s
LEFT JOIN orders o     ON o.order_id    = s.order_id
LEFT JOIN customers c  ON c.customer_id = o.customer_id
LEFT JOIN carriers car ON car.carrier_id = s.carrier_id;


-- Historial de CFDI cancelados/rehechos
CREATE OR REPLACE VIEW v_cfdi_cancellations AS
SELECT
    c1.cfdi_id              AS cancelled_cfdi_id,
    c1.uuid                 AS cancelled_uuid,
    c1.cfdi_type            AS cancelled_type,
    c1.cancelled_at,
    c1.cancellation_reason,
    c1.sat_cancellation_motive,
    c2.cfdi_id              AS replacement_cfdi_id,
    c2.uuid                 AS replacement_uuid,
    c2.timbre_date          AS replacement_timbre_date
FROM cfdi c1
LEFT JOIN cfdi c2 ON c2.cfdi_id = c1.replaced_by_cfdi_id
WHERE c1.status = 'CANCELLED';


-- =====================================================================
-- 12. TRIGGERS DE LOGÍSTICA
-- =====================================================================

-- Cuando se inserta un shipment_item, suma a order_items.quantity_shipped
CREATE OR REPLACE FUNCTION fn_sync_shipped_qty()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE order_items
            SET quantity_shipped = quantity_shipped + NEW.quantity
        WHERE order_item_id = NEW.order_item_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE order_items
            SET quantity_shipped = quantity_shipped + (NEW.quantity - OLD.quantity)
        WHERE order_item_id = NEW.order_item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE order_items
            SET quantity_shipped = quantity_shipped - OLD.quantity
        WHERE order_item_id = OLD.order_item_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_shipped_qty
AFTER INSERT OR UPDATE OR DELETE ON shipment_items
FOR EACH ROW EXECUTE FUNCTION fn_sync_shipped_qty();


-- Cuando un shipment pasa a DELIVERED, registra el milestone y actualiza el order
CREATE OR REPLACE FUNCTION fn_on_shipment_delivered()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'DELIVERED' AND OLD.status <> 'DELIVERED' THEN
        UPDATE orders SET delivery_date = COALESCE(NEW.actual_arrival::DATE, CURRENT_DATE)
        WHERE order_id = NEW.order_id;

        INSERT INTO order_milestones (order_id, milestone_type, milestone_date, notes)
        VALUES (NEW.order_id, 'DELIVERED',
                COALESCE(NEW.actual_arrival::DATE, CURRENT_DATE),
                'Shipment ' || NEW.shipment_number || ' delivered');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_on_shipment_delivered
AFTER UPDATE OF status ON shipments
FOR EACH ROW EXECUTE FUNCTION fn_on_shipment_delivered();


-- =====================================================================
-- 13. COMPRAS — validación de cadena estricta y vistas
-- =====================================================================

-- Cadena estricta: una factura de bienes no puede pasar a PAID sin tener
-- al menos un goods_receipt asociado. Los servicios se exceptúan.
CREATE OR REPLACE FUNCTION fn_validate_invoice_chain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_status = 'PAID' AND COALESCE(OLD.payment_status, '') <> 'PAID' THEN
        IF NEW.invoice_type IN ('GOODS','MIXED') AND NOT EXISTS (
            SELECT 1 FROM goods_receipts WHERE supplier_invoice_id = NEW.invoice_id
        ) THEN
            RAISE EXCEPTION 'No se puede marcar como PAID factura de bienes sin recepción registrada (goods_receipt).'
                USING HINT = 'La cadena estricta requiere PR → PO → GR → Invoice antes del pago.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_invoice_chain
BEFORE UPDATE OF payment_status ON supplier_invoices
FOR EACH ROW EXECUTE FUNCTION fn_validate_invoice_chain();


-- Validar que una PO no pueda confirmarse sin tener al menos un PR asociado
-- (excepto si es de servicios, que pueden originarse directo)
CREATE OR REPLACE FUNCTION fn_validate_po_has_request()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CONFIRMED' AND COALESCE(OLD.status, '') <> 'CONFIRMED' THEN
        IF NEW.po_type = 'GOODS' AND NOT EXISTS (
            SELECT 1 FROM purchase_order_items poi
            WHERE poi.po_id = NEW.po_id AND poi.request_item_id IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'PO de bienes no puede confirmarse sin items vinculados a una purchase_request.'
                USING HINT = 'Vincula request_item_id en al menos un purchase_order_item.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_po_request
BEFORE UPDATE OF status ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_validate_po_has_request();


-- Vista: cadena completa de cada compra
CREATE OR REPLACE VIEW v_purchase_chain AS
SELECT
    pri.request_item_id,
    pr.request_number,
    pri.line_number AS pri_line,
    pri.item_type,
    COALESCE(p.sku, pri.service_description) AS item_description,
    pri.quantity_requested,
    poi.po_item_id,
    po.po_number,
    poi.quantity_ordered,
    poi.quantity_received,
    gr.receipt_number,
    gr.receipt_date,
    si.invoice_id,
    si.invoice_number,
    si.invoice_date,
    si.payment_status,
    si.sat_payment_form_id,
    si.sat_payment_method_id,
    si.is_credit
FROM purchase_request_items pri
JOIN purchase_requests       pr   ON pr.request_id = pri.request_id
LEFT JOIN purchase_order_items poi ON poi.request_item_id = pri.request_item_id
LEFT JOIN purchase_orders    po   ON po.po_id = poi.po_id
LEFT JOIN goods_receipt_items gri ON gri.po_item_id = poi.po_item_id
LEFT JOIN goods_receipts     gr   ON gr.receipt_id = gri.receipt_id
LEFT JOIN supplier_invoice_items sii ON sii.po_item_id = poi.po_item_id
LEFT JOIN supplier_invoices  si   ON si.invoice_id = sii.invoice_id
LEFT JOIN products           p    ON p.product_id = pri.product_id
ORDER BY pr.request_number, pri.line_number;
COMMENT ON VIEW v_purchase_chain IS
  'Trazabilidad completa: PR → PO → GR → Invoice. Permite verificar la cadena estricta.';


-- Vista: facturas pendientes de pago con su clasificación
CREATE OR REPLACE VIEW v_supplier_invoices_aging AS
SELECT
    si.invoice_id,
    si.invoice_number,
    s.code AS supplier_code,
    s.business_name AS supplier,
    si.invoice_type,
    si.invoice_date,
    si.payment_due_date,
    si.total,
    si.payment_status,
    si.is_credit,
    si.sat_payment_method_id,
    CASE
        WHEN si.payment_status = 'PAID' THEN 'PAID'
        WHEN si.payment_due_date IS NULL THEN 'NO_DUE_DATE'
        WHEN si.payment_due_date >= CURRENT_DATE THEN 'CURRENT'
        WHEN si.payment_due_date >= CURRENT_DATE - 30 THEN 'OVERDUE_0_30'
        WHEN si.payment_due_date >= CURRENT_DATE - 60 THEN 'OVERDUE_30_60'
        ELSE 'OVERDUE_60_PLUS'
    END AS aging_bucket,
    (CURRENT_DATE - si.payment_due_date) AS days_overdue
FROM supplier_invoices si
JOIN suppliers s ON s.supplier_id = si.supplier_id
WHERE si.status NOT IN ('CANCELLED');


-- =====================================================================
-- 14. INVENTARIO INTERNO Y ASSETS
-- =====================================================================

-- Vista: inventario de productos VENDIBLES (catálogo de venta)
CREATE OR REPLACE VIEW v_saleable_inventory AS
SELECT * FROM v_inventory_current WHERE is_saleable = TRUE;
COMMENT ON VIEW v_saleable_inventory IS
  'Atajo: stock SOLO de productos vendibles. Para pantallas de cotización y catálogo público.';

-- Vista: inventario de productos INTERNOS (uso interno, no se venden)
CREATE OR REPLACE VIEW v_internal_inventory AS
SELECT * FROM v_inventory_current WHERE is_saleable = FALSE;
COMMENT ON VIEW v_internal_inventory IS
  'Atajo: stock SOLO de productos no vendibles (tóner, papel, herramientas internas, refacciones de equipos).';


-- Vista: componentes actuales de cada equipo
CREATE OR REPLACE VIEW v_asset_current_components AS
SELECT
    a.asset_id, a.asset_code, a.name AS asset_name, a.status AS asset_status,
    ac.asset_component_id, p.sku AS component_sku, p.name AS component_name,
    ac.quantity, ac.serial_number, ac.installed_at,
    u.full_name AS installed_by
FROM assets a
LEFT JOIN asset_components ac ON ac.asset_id = a.asset_id
LEFT JOIN products p          ON p.product_id = ac.product_id
LEFT JOIN users u             ON u.user_id    = ac.installed_by
WHERE a.status NOT IN ('RETIRED','DISMANTLED')
ORDER BY a.asset_code, ac.installed_at DESC;


-- Vista: historial completo de mantenimiento de un equipo
CREATE OR REPLACE VIEW v_asset_repair_history AS
SELECT
    a.asset_code, a.name AS asset_name,
    h.history_id, h.operation, h.occurred_at,
    p.sku AS component_sku, p.name AS component_name,
    h.quantity, h.serial_number,
    u.full_name AS performed_by,
    h.reason, h.notes,
    h.inventory_movement_id, h.nc_id
FROM asset_component_history h
JOIN assets a   ON a.asset_id = h.asset_id
JOIN products p ON p.product_id = h.product_id
LEFT JOIN users u ON u.user_id = h.user_id
ORDER BY a.asset_code, h.occurred_at DESC;


-- =====================================================================
-- 15. TRIGGERS DE ASSETS
-- =====================================================================

-- Cuando se INSTALA una pieza (insert en asset_components):
-- 1. Genera inventory_movement tipo ISSUE (sale del stock)
-- 2. Inserta fila en asset_component_history
CREATE OR REPLACE FUNCTION fn_on_component_install()
RETURNS TRIGGER AS $$
DECLARE v_mov_id BIGINT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO inventory_movements (
            product_id, movement_type, source_type, source_id,
            quantity_out, occurred_at, user_id, notes
        ) VALUES (
            NEW.product_id, 'ISSUE', 'ASSET_INSTALL', NEW.asset_component_id,
            NEW.quantity, NEW.installed_at, NEW.installed_by,
            'Instalación en asset ' || (SELECT asset_code FROM assets WHERE asset_id = NEW.asset_id)
        ) RETURNING movement_id INTO v_mov_id;

        INSERT INTO asset_component_history (
            asset_id, product_id, operation, quantity,
            serial_number, occurred_at, user_id, inventory_movement_id, notes
        ) VALUES (
            NEW.asset_id, NEW.product_id, 'INSTALL', NEW.quantity,
            NEW.serial_number, NEW.installed_at, NEW.installed_by,
            v_mov_id, NEW.notes
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_on_component_install
AFTER INSERT ON asset_components
FOR EACH ROW EXECUTE FUNCTION fn_on_component_install();


-- Cuando se REMUEVE una pieza (delete de asset_components):
-- Se debe llamar la función fn_remove_component que decide:
--   - Si is_reusable=TRUE → genera RETURN_IN (vuelve a stock)
--   - Si is_reusable=FALSE → genera non_conformity con nc_source='ASSET_REMOVAL'
-- Esta función se llama explícitamente desde la app (no como trigger AFTER DELETE
-- porque necesita parámetros adicionales)

CREATE OR REPLACE FUNCTION fn_remove_asset_component(
    p_asset_component_id BIGINT,
    p_is_reusable        BOOLEAN,
    p_user_id            BIGINT,
    p_reason             TEXT DEFAULT NULL,
    p_notes              TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_ac      RECORD;
    v_mov_id  BIGINT;
    v_nc_id   BIGINT;
    v_history_id BIGINT;
BEGIN
    SELECT * INTO v_ac FROM asset_components WHERE asset_component_id = p_asset_component_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Asset component % no encontrado', p_asset_component_id; END IF;

    IF p_is_reusable THEN
        -- Pieza buena → vuelve al inventario
        INSERT INTO inventory_movements (
            product_id, movement_type, source_type, source_id,
            quantity_in, occurred_at, user_id, notes
        ) VALUES (
            v_ac.product_id, 'RETURN_IN', 'ASSET_REMOVE', v_ac.asset_component_id,
            v_ac.quantity, now(), p_user_id,
            'Retirada de asset ' || (SELECT asset_code FROM assets WHERE asset_id = v_ac.asset_id)
                || COALESCE(' — ' || p_reason, '')
        ) RETURNING movement_id INTO v_mov_id;
    ELSE
        -- Pieza defectuosa → no_conformity
        INSERT INTO non_conformities (
            folio, product_id, asset_id, detected_by, nc_date, quantity,
            reason, adjustment_type, status, nc_source, observations
        ) VALUES (
            'NC-AST-' || p_asset_component_id,
            v_ac.product_id, v_ac.asset_id, p_user_id, CURRENT_DATE, v_ac.quantity,
            COALESCE(p_reason, 'Pieza retirada de equipo por mal funcionamiento'),
            'OUT', 'OPEN', 'ASSET_REMOVAL', p_notes
        ) RETURNING nc_id INTO v_nc_id;
        -- El trigger fn_create_inv_movement_from_nc generará el inventory_movement
    END IF;

    -- Histórico de la operación
    INSERT INTO asset_component_history (
        asset_id, product_id, operation, quantity, serial_number,
        occurred_at, user_id, inventory_movement_id, nc_id, reason, notes
    ) VALUES (
        v_ac.asset_id, v_ac.product_id, 'REMOVE', v_ac.quantity, v_ac.serial_number,
        now(), p_user_id, v_mov_id, v_nc_id, p_reason, p_notes
    ) RETURNING history_id INTO v_history_id;

    -- Borrar el componente actual
    DELETE FROM asset_components WHERE asset_component_id = p_asset_component_id;

    RETURN v_history_id;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION fn_remove_asset_component IS
  'Quita una pieza del equipo. Si es reutilizable vuelve a stock (RETURN_IN); si no, genera non_conformity con nc_source=ASSET_REMOVAL.';


-- =====================================================================
-- 16. CFDI: vistas, función de folio
-- =====================================================================

-- Función: asigna serie + siguiente folio atómicamente
CREATE OR REPLACE FUNCTION fn_assign_cfdi_folio(p_series TEXT)
RETURNS TABLE (out_series_id BIGINT, out_folio BIGINT) AS $$
DECLARE v_series RECORD;
BEGIN
    -- Lock de la fila para evitar duplicados en concurrencia
    SELECT series_id, next_folio INTO v_series
    FROM cfdi_series WHERE series = p_series AND is_active
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Serie CFDI % no encontrada o inactiva', p_series;
    END IF;

    UPDATE cfdi_series
       SET next_folio = next_folio + 1
     WHERE series_id = v_series.series_id;

    RETURN QUERY SELECT v_series.series_id, v_series.next_folio;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION fn_assign_cfdi_folio IS
  'Reserva atómicamente el siguiente folio de una serie. Bloqueo FOR UPDATE evita duplicados en alta concurrencia.';


-- Vista: catálogo de CFDIs emitidos con sus saldos y relaciones
CREATE OR REPLACE VIEW v_cfdi_emitted AS
SELECT
    c.cfdi_id, c.uuid, c.cfdi_type,
    s.series, c.folio,
    cu.business_name AS customer,
    c.receiver_rfc, c.receiver_legal_name,
    c.cfdi_use_id, c.payment_method_id, c.payment_form_id,
    c.issue_date, c.timbre_date,
    c.subtotal, c.discount, c.tax_amount, c.total,
    c.status,
    c.cancelled_at, c.cancellation_reason, c.sat_cancellation_motive,
    -- Sustituciones
    cs.uuid AS replaced_by_uuid,
    cr.uuid AS replaces_uuid,
    -- Pagos aplicados (solo aplica a tipo I PPD)
    COALESCE((
        SELECT SUM(payment_amount) FROM cfdi_payments cp
        WHERE cp.related_cfdi_id = c.cfdi_id
    ), 0) AS amount_paid_via_complementos,
    -- Notas de crédito relacionadas
    COALESCE((
        SELECT SUM(refund_amount) FROM cfdi_credit_notes cn
        WHERE cn.related_cfdi_id = c.cfdi_id
    ), 0) AS credit_note_amount
FROM cfdi c
LEFT JOIN cfdi_series s    ON s.series_id = c.series_id
LEFT JOIN customers cu     ON cu.customer_id = c.customer_id
LEFT JOIN cfdi cs          ON cs.cfdi_id = c.replaced_by_cfdi_id
LEFT JOIN cfdi cr          ON cr.cfdi_id = c.replaces_cfdi_id;


-- Vista: CFDIs PPD pendientes de pago (saldo > 0)
CREATE OR REPLACE VIEW v_cfdi_ppd_pending_payment AS
SELECT
    c.cfdi_id, c.uuid, s.series, c.folio,
    cu.business_name AS customer,
    c.issue_date, c.total,
    COALESCE((
        SELECT SUM(payment_amount) FROM cfdi_payments cp
        WHERE cp.related_cfdi_id = c.cfdi_id
    ), 0) AS paid,
    c.total - COALESCE((
        SELECT SUM(payment_amount) FROM cfdi_payments cp
        WHERE cp.related_cfdi_id = c.cfdi_id
    ), 0) AS remaining,
    (CURRENT_DATE - c.issue_date::DATE) AS days_since_issue
FROM cfdi c
LEFT JOIN cfdi_series s ON s.series_id = c.series_id
LEFT JOIN customers cu  ON cu.customer_id = c.customer_id
WHERE c.cfdi_type = 'I'
  AND c.payment_method_id = 'PPD'
  AND c.status = 'TIMBRADO';


-- Vista: pagos recibidos sin aplicar (saldo a favor del cliente o dinero sin asignar)
CREATE OR REPLACE VIEW v_payments_unapplied AS
SELECT
    p.payment_id, p.payment_number, p.payment_date,
    cu.business_name AS customer,
    p.amount,
    COALESCE(SUM(pa.amount_applied), 0) AS amount_applied,
    p.amount - COALESCE(SUM(pa.amount_applied), 0) AS amount_unapplied,
    p.bank_reference, p.notes
FROM payments p
LEFT JOIN customers cu ON cu.customer_id = p.customer_id
LEFT JOIN payment_applications pa ON pa.payment_id = p.payment_id
GROUP BY p.payment_id, p.payment_number, p.payment_date, cu.business_name, p.amount, p.bank_reference, p.notes
HAVING p.amount > COALESCE(SUM(pa.amount_applied), 0);


-- Vista: resumen de facturación por período
CREATE OR REPLACE VIEW v_cfdi_summary_by_period AS
SELECT
    EXTRACT(YEAR  FROM c.issue_date)::INT  AS year,
    EXTRACT(MONTH FROM c.issue_date)::INT  AS month,
    c.cfdi_type,
    c.status,
    COUNT(*) AS num_cfdis,
    SUM(c.subtotal)   AS subtotal,
    SUM(c.tax_amount) AS tax,
    SUM(c.total)      AS total
FROM cfdi c
GROUP BY EXTRACT(YEAR FROM c.issue_date), EXTRACT(MONTH FROM c.issue_date), c.cfdi_type, c.status
ORDER BY year DESC, month DESC, cfdi_type;


-- =====================================================================
-- 17. REPORTES Y ANALYTICS — vistas dedicadas
-- =====================================================================

-- ─── COMERCIAL ────────────────────────────────────────────────────────

-- Ventas por período (mes / trimestre / año)
CREATE OR REPLACE VIEW v_sales_by_period AS
SELECT
    EXTRACT(YEAR    FROM o.order_date)::INT AS year,
    EXTRACT(QUARTER FROM o.order_date)::INT AS quarter,
    EXTRACT(MONTH   FROM o.order_date)::INT AS month,
    COUNT(*)               AS num_orders,
    SUM(o.subtotal)        AS subtotal,
    SUM(o.tax_amount)      AS tax,
    SUM(o.total)           AS total,
    SUM(q.cost_subtotal)   AS cost,
    SUM(o.subtotal - q.cost_subtotal) AS gross_margin,
    CASE WHEN SUM(o.subtotal) > 0
         THEN ROUND(SUM(o.subtotal - q.cost_subtotal) / SUM(o.subtotal) * 100, 2)
         ELSE 0 END AS margin_pct
FROM orders o
JOIN quotes q ON q.quote_id = o.quote_id
WHERE o.status NOT IN ('CANCELLED')
GROUP BY EXTRACT(YEAR FROM o.order_date),
         EXTRACT(QUARTER FROM o.order_date),
         EXTRACT(MONTH FROM o.order_date)
ORDER BY year DESC, month DESC;

-- Top clientes por revenue
CREATE OR REPLACE VIEW v_top_customers AS
SELECT
    c.customer_id, c.code, c.business_name, c.locality,
    COUNT(o.order_id)                   AS num_orders,
    SUM(o.total)                        AS total_revenue,
    SUM(q.cost_subtotal)                AS total_cost,
    SUM(o.subtotal - q.cost_subtotal)   AS gross_margin,
    CASE WHEN SUM(o.subtotal) > 0
         THEN ROUND(SUM(o.subtotal - q.cost_subtotal) / SUM(o.subtotal) * 100, 2)
         ELSE 0 END                     AS margin_pct,
    AVG(o.total)                        AS avg_order_value,
    MAX(o.order_date)                   AS last_order_date,
    (CURRENT_DATE - MAX(o.order_date))  AS days_since_last_order
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status NOT IN ('CANCELLED')
LEFT JOIN quotes q ON q.quote_id = o.quote_id
WHERE c.is_active
GROUP BY c.customer_id, c.code, c.business_name, c.locality
ORDER BY total_revenue DESC NULLS LAST;

-- Tasa de conversión de cotizaciones
CREATE OR REPLACE VIEW v_quote_conversion AS
SELECT
    EXTRACT(YEAR  FROM q.issue_date)::INT AS year,
    EXTRACT(MONTH FROM q.issue_date)::INT AS month,
    COUNT(*)                                                       AS total_quotes,
    COUNT(*) FILTER (WHERE q.status = 'APPROVED')                  AS approved,
    COUNT(*) FILTER (WHERE q.status = 'REJECTED')                  AS rejected,
    COUNT(*) FILTER (WHERE q.status = 'CANCELLED')                 AS cancelled,
    COUNT(*) FILTER (WHERE q.status = 'EXPIRED')                   AS expired,
    COUNT(*) FILTER (WHERE q.status IN ('DRAFT','SENT'))           AS still_open,
    CASE WHEN COUNT(*) > 0 THEN
        ROUND(COUNT(*) FILTER (WHERE q.status = 'APPROVED')::NUMERIC / COUNT(*) * 100, 2)
        ELSE 0 END AS conversion_pct,
    SUM(q.total)                                                   AS total_quoted,
    SUM(q.total) FILTER (WHERE q.status = 'APPROVED')              AS total_won
FROM quotes q
GROUP BY EXTRACT(YEAR FROM q.issue_date), EXTRACT(MONTH FROM q.issue_date)
ORDER BY year DESC, month DESC;

-- Performance por vendedor
CREATE OR REPLACE VIEW v_sales_rep_performance AS
SELECT
    u.user_id, u.full_name AS sales_rep,
    COUNT(q.quote_id)                                          AS quotes_created,
    COUNT(*) FILTER (WHERE q.status = 'APPROVED')              AS quotes_approved,
    CASE WHEN COUNT(*) > 0 THEN
        ROUND(COUNT(*) FILTER (WHERE q.status = 'APPROVED')::NUMERIC / COUNT(*) * 100, 2)
        ELSE 0 END                                             AS conversion_pct,
    SUM(q.total) FILTER (WHERE q.status = 'APPROVED')          AS revenue_generated,
    SUM(q.subtotal - q.cost_subtotal) FILTER (WHERE q.status = 'APPROVED') AS margin_generated,
    AVG(q.total) FILTER (WHERE q.status = 'APPROVED')          AS avg_order_value
FROM users u
LEFT JOIN quotes q ON q.sales_rep_id = u.user_id
WHERE u.is_active
GROUP BY u.user_id, u.full_name
HAVING COUNT(q.quote_id) > 0
ORDER BY revenue_generated DESC NULLS LAST;


-- ─── MARGEN Y RENTABILIDAD ───────────────────────────────────────────

-- Margen por producto vendido
CREATE OR REPLACE VIEW v_product_margin AS
SELECT
    p.product_id, p.sku, p.name,
    cat.name AS category, cat.profit_margin_pct AS category_target_margin,
    COUNT(qi.quote_item_id)                                  AS times_sold,
    SUM(qi.quantity_requested) FILTER (WHERE q.status = 'APPROVED') AS units_sold,
    SUM(qi.subtotal)           FILTER (WHERE q.status = 'APPROVED') AS revenue,
    SUM(qi.cost_subtotal)      FILTER (WHERE q.status = 'APPROVED') AS cost,
    SUM(qi.subtotal - qi.cost_subtotal) FILTER (WHERE q.status = 'APPROVED') AS gross_margin,
    CASE WHEN SUM(qi.subtotal) FILTER (WHERE q.status = 'APPROVED') > 0
         THEN ROUND(
             SUM(qi.subtotal - qi.cost_subtotal) FILTER (WHERE q.status = 'APPROVED') /
             NULLIF(SUM(qi.subtotal) FILTER (WHERE q.status = 'APPROVED'), 0) * 100, 2)
         ELSE 0 END AS actual_margin_pct,
    p.current_avg_cost AS current_cost
FROM products p
LEFT JOIN categories cat ON cat.category_id = p.category_id
LEFT JOIN quote_items qi ON qi.product_id = p.product_id
LEFT JOIN quotes q       ON q.quote_id    = qi.quote_id
WHERE p.is_saleable AND p.is_active
GROUP BY p.product_id, p.sku, p.name, cat.name, cat.profit_margin_pct, p.current_avg_cost;

-- Rentabilidad por cliente (revenue, costo, margen)
CREATE OR REPLACE VIEW v_customer_profitability AS
SELECT
    c.customer_id, c.code, c.business_name,
    COUNT(DISTINCT o.order_id)         AS num_orders,
    SUM(o.subtotal)                    AS revenue,
    SUM(q.cost_subtotal)               AS cost,
    SUM(o.subtotal - q.cost_subtotal)  AS gross_margin,
    CASE WHEN SUM(o.subtotal) > 0
         THEN ROUND(SUM(o.subtotal - q.cost_subtotal) / SUM(o.subtotal) * 100, 2)
         ELSE 0 END                    AS margin_pct,
    -- Cuánto se le ha cobrado vs vendido
    COALESCE(SUM(pa.amount_applied), 0)        AS amount_collected,
    SUM(o.total) - COALESCE(SUM(pa.amount_applied), 0) AS amount_outstanding,
    AVG((o.payment_date - o.invoicing_date))::NUMERIC(8,1) AS avg_days_to_pay
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status NOT IN ('CANCELLED')
LEFT JOIN quotes q ON q.quote_id = o.quote_id
LEFT JOIN payment_applications pa ON pa.order_id = o.order_id
WHERE c.is_active
GROUP BY c.customer_id, c.code, c.business_name
HAVING COUNT(DISTINCT o.order_id) > 0
ORDER BY gross_margin DESC NULLS LAST;

-- Margen por categoría
CREATE OR REPLACE VIEW v_category_margin AS
SELECT
    cat.category_id, cat.name AS category, cat.profit_margin_pct AS target_margin,
    COUNT(DISTINCT qi.quote_item_id) FILTER (WHERE q.status = 'APPROVED') AS items_sold,
    SUM(qi.subtotal)      FILTER (WHERE q.status = 'APPROVED') AS revenue,
    SUM(qi.cost_subtotal) FILTER (WHERE q.status = 'APPROVED') AS cost,
    SUM(qi.subtotal - qi.cost_subtotal) FILTER (WHERE q.status = 'APPROVED') AS margin,
    CASE WHEN SUM(qi.subtotal) FILTER (WHERE q.status = 'APPROVED') > 0
         THEN ROUND(
             SUM(qi.subtotal - qi.cost_subtotal) FILTER (WHERE q.status = 'APPROVED') /
             NULLIF(SUM(qi.subtotal) FILTER (WHERE q.status = 'APPROVED'), 0) * 100, 2)
         ELSE 0 END AS actual_margin_pct
FROM categories cat
LEFT JOIN products p     ON p.category_id = cat.category_id
LEFT JOIN quote_items qi ON qi.product_id = p.product_id
LEFT JOIN quotes q       ON q.quote_id = qi.quote_id
GROUP BY cat.category_id, cat.name, cat.profit_margin_pct
ORDER BY revenue DESC NULLS LAST;


-- ─── COMPRAS ─────────────────────────────────────────────────────────

-- Top proveedores por compra
CREATE OR REPLACE VIEW v_top_suppliers AS
SELECT
    s.supplier_id, s.code, s.business_name, s.supplier_type,
    COUNT(DISTINCT po.po_id)        AS num_pos,
    SUM(po.total)                   AS total_purchased,
    AVG(po.total)                   AS avg_po_value,
    s.avg_payment_time_days,
    MAX(po.issue_date)              AS last_po_date,
    (CURRENT_DATE - MAX(po.issue_date)) AS days_since_last_po
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.supplier_id AND po.status NOT IN ('CANCELLED')
WHERE s.is_active
GROUP BY s.supplier_id, s.code, s.business_name, s.supplier_type, s.avg_payment_time_days
HAVING COUNT(po.po_id) > 0
ORDER BY total_purchased DESC NULLS LAST;

-- Performance del proveedor: lead time real vs estimado, % de cumplimiento
CREATE OR REPLACE VIEW v_supplier_performance AS
SELECT
    s.supplier_id, s.code, s.business_name,
    COUNT(po.po_id)                     AS pos_completed,
    AVG((po.pickup_date - po.issue_date)::NUMERIC) AS avg_actual_lead_days,
    AVG((po.estimated_pickup_date - po.issue_date)::NUMERIC) AS avg_estimated_lead_days,
    AVG((po.pickup_date - po.estimated_pickup_date)::NUMERIC) AS avg_delay_days,
    COUNT(po.po_id) FILTER (WHERE po.pickup_date <= po.estimated_pickup_date) AS on_time,
    CASE WHEN COUNT(po.po_id) > 0
         THEN ROUND(COUNT(po.po_id) FILTER (WHERE po.pickup_date <= po.estimated_pickup_date)::NUMERIC / COUNT(po.po_id) * 100, 2)
         ELSE 0 END AS on_time_pct,
    -- Calidad: NCs por proveedor
    (SELECT COUNT(*) FROM non_conformities nc
     JOIN supplier_invoices si ON si.invoice_id = nc.supplier_invoice_id
     WHERE si.supplier_id = s.supplier_id) AS total_ncs
FROM suppliers s
JOIN purchase_orders po ON po.supplier_id = s.supplier_id
WHERE po.status IN ('RECEIVED','INVOICED','PAID')
  AND po.pickup_date IS NOT NULL
GROUP BY s.supplier_id, s.code, s.business_name
ORDER BY on_time_pct DESC, total_purchased DESC NULLS LAST;


-- ─── FINANCIERO ──────────────────────────────────────────────────────

-- Cuentas por cobrar (AR aging)
CREATE OR REPLACE VIEW v_accounts_receivable AS
SELECT
    c.customer_id, c.code, c.business_name,
    SUM(o.total)                                                         AS billed,
    COALESCE(SUM(pa.amount_applied), 0)                                  AS collected,
    SUM(o.total) - COALESCE(SUM(pa.amount_applied), 0)                   AS outstanding,
    SUM(CASE WHEN o.invoicing_date IS NOT NULL
                  AND (CURRENT_DATE - o.invoicing_date) <= 30
                  AND COALESCE(pa_per.amount, 0) < o.total
             THEN o.total - COALESCE(pa_per.amount, 0) ELSE 0 END) AS bucket_0_30,
    SUM(CASE WHEN o.invoicing_date IS NOT NULL
                  AND (CURRENT_DATE - o.invoicing_date) BETWEEN 31 AND 60
                  AND COALESCE(pa_per.amount, 0) < o.total
             THEN o.total - COALESCE(pa_per.amount, 0) ELSE 0 END) AS bucket_31_60,
    SUM(CASE WHEN o.invoicing_date IS NOT NULL
                  AND (CURRENT_DATE - o.invoicing_date) BETWEEN 61 AND 90
                  AND COALESCE(pa_per.amount, 0) < o.total
             THEN o.total - COALESCE(pa_per.amount, 0) ELSE 0 END) AS bucket_61_90,
    SUM(CASE WHEN o.invoicing_date IS NOT NULL
                  AND (CURRENT_DATE - o.invoicing_date) > 90
                  AND COALESCE(pa_per.amount, 0) < o.total
             THEN o.total - COALESCE(pa_per.amount, 0) ELSE 0 END) AS bucket_90_plus
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status NOT IN ('CANCELLED') AND o.invoice_status <> 'NOT_INVOICED'
LEFT JOIN payment_applications pa ON pa.order_id = o.order_id
LEFT JOIN LATERAL (
    SELECT SUM(amount_applied) AS amount
    FROM payment_applications WHERE order_id = o.order_id
) pa_per ON TRUE
WHERE c.is_active
GROUP BY c.customer_id, c.code, c.business_name
HAVING SUM(o.total) > 0
ORDER BY outstanding DESC NULLS LAST;

-- Cuentas por pagar (AP)
CREATE OR REPLACE VIEW v_accounts_payable AS
SELECT
    s.supplier_id, s.code, s.business_name,
    SUM(si.total) FILTER (WHERE si.payment_status <> 'PAID')           AS outstanding,
    SUM(si.total) FILTER (WHERE si.payment_status <> 'PAID' AND
                                si.payment_due_date >= CURRENT_DATE)   AS bucket_current,
    SUM(si.total) FILTER (WHERE si.payment_status <> 'PAID' AND
                                (CURRENT_DATE - si.payment_due_date) BETWEEN 1 AND 30)  AS bucket_overdue_30,
    SUM(si.total) FILTER (WHERE si.payment_status <> 'PAID' AND
                                (CURRENT_DATE - si.payment_due_date) BETWEEN 31 AND 60) AS bucket_overdue_60,
    SUM(si.total) FILTER (WHERE si.payment_status <> 'PAID' AND
                                (CURRENT_DATE - si.payment_due_date) > 60)              AS bucket_overdue_60_plus
FROM suppliers s
JOIN supplier_invoices si ON si.supplier_id = s.supplier_id
WHERE s.is_active AND si.status NOT IN ('CANCELLED')
GROUP BY s.supplier_id, s.code, s.business_name
HAVING SUM(si.total) FILTER (WHERE si.payment_status <> 'PAID') > 0
ORDER BY outstanding DESC NULLS LAST;

-- Flujo de caja proyectado (próximos 90 días)
CREATE OR REPLACE VIEW v_cash_flow_projection AS
SELECT period, period_date, SUM(inflow) AS inflow, SUM(outflow) AS outflow,
       SUM(inflow) - SUM(outflow) AS net
FROM (
    -- Cuentas por cobrar esperadas
    SELECT
        CASE WHEN (o.invoicing_date + COALESCE(c.payment_terms_days, 0)) <= CURRENT_DATE THEN 'OVERDUE'
             WHEN (o.invoicing_date + COALESCE(c.payment_terms_days, 0)) <= CURRENT_DATE + 30 THEN '0-30'
             WHEN (o.invoicing_date + COALESCE(c.payment_terms_days, 0)) <= CURRENT_DATE + 60 THEN '31-60'
             ELSE '61-90' END AS period,
        (o.invoicing_date + COALESCE(c.payment_terms_days, 0))::DATE AS period_date,
        (o.total - COALESCE((SELECT SUM(amount_applied) FROM payment_applications WHERE order_id = o.order_id), 0)) AS inflow,
        0 AS outflow
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    WHERE o.invoice_status <> 'NOT_INVOICED'
      AND o.payment_status <> 'PAID'
    UNION ALL
    -- Cuentas por pagar
    SELECT
        CASE WHEN si.payment_due_date <= CURRENT_DATE THEN 'OVERDUE'
             WHEN si.payment_due_date <= CURRENT_DATE + 30 THEN '0-30'
             WHEN si.payment_due_date <= CURRENT_DATE + 60 THEN '31-60'
             ELSE '61-90' END,
        si.payment_due_date,
        0 AS inflow,
        si.total AS outflow
    FROM supplier_invoices si
    WHERE si.payment_status <> 'PAID' AND si.status NOT IN ('CANCELLED')
) cf
GROUP BY period, period_date
ORDER BY period_date;

-- Gastos operativos por categoría y mes
CREATE OR REPLACE VIEW v_expenses_by_category AS
SELECT
    EXTRACT(YEAR  FROM expense_date)::INT AS year,
    EXTRACT(MONTH FROM expense_date)::INT AS month,
    category,
    COUNT(*)              AS num_expenses,
    SUM(subtotal)         AS subtotal,
    SUM(tax_amount)       AS tax,
    SUM(total)            AS total,
    SUM(total) FILTER (WHERE is_deductible)     AS deductible,
    SUM(total) FILTER (WHERE NOT is_deductible) AS non_deductible
FROM operating_expenses
WHERE status NOT IN ('CANCELLED')
GROUP BY EXTRACT(YEAR FROM expense_date), EXTRACT(MONTH FROM expense_date), category
ORDER BY year DESC, month DESC, total DESC;


-- ─── OPERACIÓN ───────────────────────────────────────────────────────

-- KPIs de almacén
CREATE OR REPLACE VIEW v_warehouse_kpis AS
SELECT
    -- Stock
    (SELECT COUNT(*) FROM products WHERE is_active AND is_saleable) AS active_skus_saleable,
    (SELECT COUNT(*) FROM v_inventory_current WHERE stock_status = 'OUT_OF_STOCK') AS skus_out_of_stock,
    (SELECT COUNT(*) FROM v_inventory_current WHERE stock_status = 'BELOW_MIN')    AS skus_below_min,
    (SELECT SUM(total_value) FROM v_inventory_current) AS total_inventory_value,
    -- Movimientos del mes
    (SELECT COUNT(*) FROM inventory_movements
        WHERE occurred_at >= DATE_TRUNC('month', CURRENT_DATE) AND movement_type = 'RECEIPT') AS receipts_this_month,
    (SELECT COUNT(*) FROM inventory_movements
        WHERE occurred_at >= DATE_TRUNC('month', CURRENT_DATE) AND movement_type = 'ISSUE')   AS issues_this_month,
    -- Pedidos
    (SELECT COUNT(*) FROM orders WHERE status NOT IN ('CANCELLED','PAID')) AS active_orders,
    (SELECT COUNT(*) FROM orders WHERE has_shortage = TRUE)                AS orders_with_shortage,
    (SELECT COUNT(*) FROM orders WHERE packing_status IN ('IN_PROGRESS','READY')) AS orders_in_packing,
    -- No conformes abiertos
    (SELECT COUNT(*) FROM non_conformities WHERE status = 'OPEN') AS open_non_conformities;

-- No conformes por proveedor (calidad)
CREATE OR REPLACE VIEW v_nc_by_supplier AS
SELECT
    s.code, s.business_name,
    COUNT(nc.nc_id) AS total_ncs,
    COUNT(nc.nc_id) FILTER (WHERE nc.nc_date >= now() - INTERVAL '90 days') AS ncs_last_90d,
    COUNT(nc.nc_id) FILTER (WHERE nc.status = 'OPEN') AS open_ncs,
    SUM(nc.quantity) AS total_quantity_affected
FROM suppliers s
JOIN supplier_invoices si ON si.supplier_id = s.supplier_id
JOIN non_conformities nc  ON nc.supplier_invoice_id = si.invoice_id
GROUP BY s.code, s.business_name
ORDER BY ncs_last_90d DESC, total_ncs DESC;

-- Eficiencia de rutas
CREATE OR REPLACE VIEW v_route_efficiency AS
SELECT
    r.route_id, r.route_number, r.route_date, u.full_name AS driver,
    COUNT(rs.stop_id) AS total_stops,
    COUNT(rs.stop_id) FILTER (WHERE rs.status = 'COMPLETED') AS completed_stops,
    COUNT(rs.stop_id) FILTER (WHERE rs.status = 'FAILED')    AS failed_stops,
    COUNT(rs.stop_id) FILTER (WHERE rs.stop_type = 'DELIVERY') AS deliveries,
    COUNT(rs.stop_id) FILTER (WHERE rs.stop_type = 'PICKUP')   AS pickups,
    EXTRACT(EPOCH FROM (r.end_time - r.start_time))/3600 AS duration_hours,
    r.total_distance_km,
    CASE WHEN COUNT(rs.stop_id) > 0
         THEN ROUND(COUNT(rs.stop_id) FILTER (WHERE rs.status = 'COMPLETED')::NUMERIC / COUNT(rs.stop_id) * 100, 2)
         ELSE 0 END AS completion_pct
FROM routes r
LEFT JOIN route_stops rs ON rs.route_id = r.route_id
LEFT JOIN users u        ON u.user_id    = r.driver_user_id
GROUP BY r.route_id, r.route_number, r.route_date, u.full_name, r.start_time, r.end_time, r.total_distance_km;


-- ─── EJECUTIVO ───────────────────────────────────────────────────────

-- Dashboard ejecutivo: KPIs unificados (una fila con todo lo importante)
CREATE OR REPLACE VIEW v_executive_dashboard AS
SELECT
    -- Ventas del mes actual
    (SELECT COALESCE(SUM(total), 0) FROM orders
        WHERE status NOT IN ('CANCELLED')
          AND order_date >= DATE_TRUNC('month', CURRENT_DATE)) AS revenue_mtd,
    (SELECT COALESCE(SUM(o.subtotal - q.cost_subtotal), 0)
        FROM orders o JOIN quotes q ON q.quote_id = o.quote_id
        WHERE o.status NOT IN ('CANCELLED')
          AND o.order_date >= DATE_TRUNC('month', CURRENT_DATE)) AS margin_mtd,
    -- Pipeline
    (SELECT COUNT(*) FROM quotes WHERE status IN ('DRAFT','SENT'))    AS open_quotes,
    (SELECT COALESCE(SUM(total), 0) FROM quotes WHERE status IN ('DRAFT','SENT')) AS open_quotes_value,
    -- Cobranza
    (SELECT SUM(outstanding) FROM v_accounts_receivable)              AS total_ar,
    (SELECT SUM(bucket_61_90 + bucket_90_plus) FROM v_accounts_receivable) AS ar_overdue_60_plus,
    -- Pago a proveedores
    (SELECT SUM(outstanding) FROM v_accounts_payable)                 AS total_ap,
    -- Inventario
    (SELECT SUM(total_value) FROM v_inventory_current)                AS inventory_value,
    (SELECT COUNT(*) FROM v_inventory_current WHERE stock_status IN ('OUT_OF_STOCK','BELOW_MIN')) AS skus_in_alert,
    -- Operación
    (SELECT COUNT(*) FROM orders WHERE status NOT IN ('CANCELLED','PAID')) AS active_orders,
    (SELECT COUNT(*) FROM orders WHERE has_shortage = TRUE)            AS orders_with_shortage,
    (SELECT COUNT(*) FROM non_conformities WHERE status = 'OPEN')      AS open_ncs,
    -- CFDI del mes
    (SELECT COUNT(*) FROM cfdi WHERE cfdi_type = 'I' AND status = 'TIMBRADO'
        AND issue_date >= DATE_TRUNC('month', CURRENT_DATE))           AS cfdis_emitted_mtd,
    (SELECT COUNT(*) FROM cfdi WHERE status = 'CANCELLED'
        AND cancelled_at >= DATE_TRUNC('month', CURRENT_DATE))         AS cfdis_cancelled_mtd;


-- =====================================================================
-- FIN
-- =====================================================================
