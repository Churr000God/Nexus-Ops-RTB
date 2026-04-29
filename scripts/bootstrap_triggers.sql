CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.recompute_quote_rollups(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_requested numeric;
    v_total_packed numeric;
    v_total_missing numeric;
BEGIN
    SELECT
        COALESCE(SUM(qty_requested), 0),
        COALESCE(SUM(qty_packed), 0),
        COALESCE(SUM(qty_missing), 0)
    INTO v_total_requested, v_total_packed, v_total_missing
    FROM cotizacion_items
    WHERE quote_id = p_quote_id;

    UPDATE cotizaciones
    SET
        missing_products = v_total_missing::int,
        packed_percent = CASE
            WHEN v_total_requested = 0 THEN NULL
            ELSE (v_total_packed / NULLIF(v_total_requested, 0)) * 100
        END,
        order_status = CASE
            WHEN v_total_requested = 0 THEN order_status
            WHEN v_total_packed = 0 THEN 'Pendiente'
            WHEN v_total_packed >= v_total_requested THEN 'Preparado'
            ELSE 'Parcial'
        END
    WHERE id = p_quote_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.recompute_product_rollups(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE productos p
    SET
        theoretical_outflow = agg.theoretical_outflow,
        real_outflow = agg.real_outflow,
        total_accumulated_sales = agg.total_accumulated_sales,
        demand_90_days = agg.demand_90_days,
        demand_180_days = agg.demand_180_days,
        committed_demand = agg.committed_demand,
        last_outbound_date = agg.last_outbound_date
    FROM (
        SELECT
            qi.product_id AS product_id,
            SUM(qi.qty_requested) AS theoretical_outflow,
            SUM(CASE WHEN COALESCE(LOWER(q.status), '') IN ('aprobada', 'aprobado') THEN qi.qty_packed ELSE 0 END) AS real_outflow,
            SUM(CASE WHEN COALESCE(LOWER(q.status), '') IN ('aprobada', 'aprobado') THEN qi.subtotal ELSE 0 END) AS total_accumulated_sales,
            SUM(
                CASE
                    WHEN COALESCE(qi.last_updated_on, q.created_on) >= (NOW() - INTERVAL '90 days')
                    THEN qi.qty_requested
                    ELSE 0
                END
            ) AS demand_90_days,
            SUM(
                CASE
                    WHEN COALESCE(qi.last_updated_on, q.created_on) >= (NOW() - INTERVAL '180 days')
                    THEN qi.qty_requested
                    ELSE 0
                END
            ) AS demand_180_days,
            SUM(
                CASE
                    WHEN COALESCE(LOWER(q.status), '') NOT IN ('cancelada', 'rechazada', 'expirada')
                    THEN qi.qty_missing
                    ELSE 0
                END
            ) AS committed_demand,
            MAX(
                CASE
                    WHEN COALESCE(qi.qty_packed, 0) > 0 THEN qi.last_updated_on::date
                    ELSE NULL
                END
            ) AS last_outbound_date
        FROM cotizacion_items qi
        JOIN cotizaciones q ON q.id = qi.quote_id
        WHERE qi.product_id = p_product_id
        GROUP BY qi.product_id
    ) AS agg
    WHERE p.id = agg.product_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.recompute_product_pricing(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_base numeric;
    v_markup numeric;
BEGIN
    SELECT AVG(price) INTO v_base
    FROM proveedor_productos
    WHERE product_id = p_product_id AND price IS NOT NULL;

    SELECT COALESCE(b.markup_percent, 0) INTO v_markup
    FROM productos p
    LEFT JOIN marcas b ON b.id = p.brand_id
    WHERE p.id = p_product_id;

    UPDATE productos
    SET
        unit_price_base = v_base,
        unit_price = CASE
            WHEN v_base IS NULL THEN unit_price
            ELSE v_base * (1 + v_markup)
        END
    WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.recompute_inventory_rollups(p_inventory_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_product_id uuid;
BEGIN
    SELECT product_id INTO v_product_id
    FROM inventario
    WHERE id = p_inventory_id;

    UPDATE inventario i
    SET
        inbound_real         = mv.inbound_real,
        outbound_real        = mv.outbound_real,
        inbound_theoretical  = th_in.inbound_theoretical,
        outbound_theoretical = th_out.outbound_theoretical,
        nonconformity_adjustment = nc.nonconformity_adjustment,
        real_qty       = mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment,
        theoretical_qty = th_in.inbound_theoretical - th_out.outbound_theoretical,
        stock_diff     = (mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment)
                         - (th_in.inbound_theoretical - th_out.outbound_theoretical),
        stock_total_cost = (mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment)
                           * i.unit_cost
    FROM (
        -- real: movimientos físicos confirmados
        SELECT
            COALESCE(SUM(CASE WHEN movement_type IN ('Entrada', 'Devolución') THEN qty_in  ELSE 0 END), 0) AS inbound_real,
            COALESCE(SUM(CASE WHEN movement_type = 'Salida'                   THEN qty_out ELSE 0 END), 0) AS outbound_real
        FROM inventory_movements
        WHERE product_id = v_product_id
    ) AS mv,
    (
        -- theoretical inbound: lo que se solicitó recibir (entradas_mercancia.qty_requested_converted)
        SELECT COALESCE(SUM(em.qty_requested_converted), 0) AS inbound_theoretical
        FROM entradas_mercancia em
        WHERE em.product_id = v_product_id
    ) AS th_in,
    (
        -- theoretical outbound: demanda cotizada activa (excluye canceladas/rechazadas/expiradas)
        SELECT COALESCE(SUM(ci.qty_requested), 0) AS outbound_theoretical
        FROM cotizacion_items ci
        JOIN cotizaciones q ON q.id = ci.quote_id
        WHERE ci.product_id = v_product_id
          AND LOWER(COALESCE(q.status, '')) NOT IN ('cancelada', 'rechazada', 'expirada')
    ) AS th_out,
    (
        SELECT COALESCE(SUM(inventory_adjustment), 0) AS nonconformity_adjustment
        FROM no_conformes
        WHERE inventory_item_id = p_inventory_id
    ) AS nc
    WHERE i.id = p_inventory_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.recompute_customer_rollups(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_annual numeric;
    v_last date;
    v_avg_payment numeric;
BEGIN
    SELECT
        COALESCE(SUM(total), 0),
        MAX(sold_on::date)
    INTO v_annual, v_last
    FROM ventas
    WHERE customer_id = p_customer_id
      AND sold_on >= (CURRENT_DATE - INTERVAL '365 days');

    SELECT AVG(payment_time_days)::numeric
    INTO v_avg_payment
    FROM pedidos_clientes
    WHERE customer_id = p_customer_id
      AND payment_time_days IS NOT NULL;

    UPDATE clientes
    SET
        annual_purchase = v_annual,
        last_purchase_date = v_last,
        avg_payment_days = v_avg_payment
    WHERE id = p_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.recompute_all_rollups()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id FROM cotizaciones LOOP
        PERFORM app.recompute_quote_rollups(r.id);
    END LOOP;

    FOR r IN SELECT id FROM productos LOOP
        PERFORM app.recompute_product_rollups(r.id);
        PERFORM app.recompute_product_pricing(r.id);
    END LOOP;

    FOR r IN SELECT id FROM inventario LOOP
        PERFORM app.recompute_inventory_rollups(r.id);
    END LOOP;

    FOR r IN SELECT id FROM clientes LOOP
        PERFORM app.recompute_customer_rollups(r.id);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app.trg_cotizacion_items_rollups()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.quote_id IS NOT NULL THEN
            PERFORM app.recompute_quote_rollups(NEW.quote_id);
        END IF;
        IF NEW.product_id IS NOT NULL THEN
            PERFORM app.recompute_product_rollups(NEW.product_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.quote_id IS NOT NULL THEN
            PERFORM app.recompute_quote_rollups(OLD.quote_id);
        END IF;
        IF NEW.quote_id IS NOT NULL AND NEW.quote_id <> OLD.quote_id THEN
            PERFORM app.recompute_quote_rollups(NEW.quote_id);
        END IF;
        IF OLD.product_id IS NOT NULL THEN
            PERFORM app.recompute_product_rollups(OLD.product_id);
        END IF;
        IF NEW.product_id IS NOT NULL AND NEW.product_id <> OLD.product_id THEN
            PERFORM app.recompute_product_rollups(NEW.product_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.quote_id IS NOT NULL THEN
            PERFORM app.recompute_quote_rollups(OLD.quote_id);
        END IF;
        IF OLD.product_id IS NOT NULL THEN
            PERFORM app.recompute_product_rollups(OLD.product_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_rollups ON cotizacion_items;
DROP TRIGGER IF EXISTS trg_cotizaciones_packed ON cotizacion_items;
CREATE TRIGGER trg_productos_rollups
AFTER INSERT OR UPDATE OR DELETE ON cotizacion_items
FOR EACH ROW EXECUTE FUNCTION app.trg_cotizacion_items_rollups();

CREATE OR REPLACE FUNCTION app.trg_proveedor_productos_precio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.product_id IS NOT NULL THEN
            PERFORM app.recompute_product_pricing(NEW.product_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.product_id IS NOT NULL THEN
            PERFORM app.recompute_product_pricing(OLD.product_id);
        END IF;
        IF NEW.product_id IS NOT NULL AND NEW.product_id <> OLD.product_id THEN
            PERFORM app.recompute_product_pricing(NEW.product_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.product_id IS NOT NULL THEN
            PERFORM app.recompute_product_pricing(OLD.product_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_precio ON proveedor_productos;
CREATE TRIGGER trg_productos_precio
AFTER INSERT OR UPDATE OR DELETE ON proveedor_productos
FOR EACH ROW EXECUTE FUNCTION app.trg_proveedor_productos_precio();

CREATE OR REPLACE FUNCTION app.trg_inventory_movements_qty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_inventory_id uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT id INTO v_inventory_id FROM inventario WHERE product_id = NEW.product_id LIMIT 1;
        IF v_inventory_id IS NOT NULL THEN
            PERFORM app.recompute_inventory_rollups(v_inventory_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT id INTO v_inventory_id FROM inventario WHERE product_id = OLD.product_id LIMIT 1;
        IF v_inventory_id IS NOT NULL THEN
            PERFORM app.recompute_inventory_rollups(v_inventory_id);
        END IF;
        IF NEW.product_id IS NOT NULL AND NEW.product_id <> OLD.product_id THEN
            SELECT id INTO v_inventory_id FROM inventario WHERE product_id = NEW.product_id LIMIT 1;
            IF v_inventory_id IS NOT NULL THEN
                PERFORM app.recompute_inventory_rollups(v_inventory_id);
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT id INTO v_inventory_id FROM inventario WHERE product_id = OLD.product_id LIMIT 1;
        IF v_inventory_id IS NOT NULL THEN
            PERFORM app.recompute_inventory_rollups(v_inventory_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_qty ON inventory_movements;
CREATE TRIGGER trg_inventario_qty
AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION app.trg_inventory_movements_qty();

CREATE OR REPLACE FUNCTION app.trg_no_conformes_qty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.inventory_item_id IS NOT NULL THEN
            PERFORM app.recompute_inventory_rollups(NEW.inventory_item_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.inventory_item_id IS NOT NULL THEN
            PERFORM app.recompute_inventory_rollups(OLD.inventory_item_id);
        END IF;
        IF NEW.inventory_item_id IS NOT NULL AND NEW.inventory_item_id <> OLD.inventory_item_id THEN
            PERFORM app.recompute_inventory_rollups(NEW.inventory_item_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.inventory_item_id IS NOT NULL THEN
            PERFORM app.recompute_inventory_rollups(OLD.inventory_item_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_qty_nc ON no_conformes;
CREATE TRIGGER trg_inventario_qty_nc
AFTER INSERT OR UPDATE OR DELETE ON no_conformes
FOR EACH ROW EXECUTE FUNCTION app.trg_no_conformes_qty();

CREATE OR REPLACE FUNCTION app.trg_inventario_semaforos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_days int;
BEGIN
    NEW.status_real := CASE
        WHEN NEW.real_qty IS NULL THEN NEW.status_real
        WHEN NEW.real_qty < 0 THEN 'Sin stock'
        WHEN NEW.real_qty = 0 THEN '0'
        ELSE 'En stock'
    END;

    NEW.stock_alert := CASE
        WHEN NEW.min_stock IS NULL OR NEW.real_qty IS NULL THEN 'Sin definir'
        WHEN NEW.real_qty < NEW.min_stock THEN 'Bajo mínimo'
        ELSE 'OK'
    END;

    IF NEW.last_outbound_on IS NULL THEN
        v_days := NULL;
    ELSE
        v_days := (CURRENT_DATE - NEW.last_outbound_on);
    END IF;
    NEW.days_without_movement := v_days;

    NEW.purchase_block := CASE
        WHEN NEW.real_qty IS NULL OR v_days IS NULL THEN NEW.purchase_block
        ELSE (NEW.real_qty > 0 AND v_days > 180)
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_semaforos ON inventario;
CREATE TRIGGER trg_inventario_semaforos
BEFORE INSERT OR UPDATE ON inventario
FOR EACH ROW EXECUTE FUNCTION app.trg_inventario_semaforos();

CREATE OR REPLACE FUNCTION app.trg_ventas_clientes_rollups()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.customer_id IS NOT NULL THEN
            PERFORM app.recompute_customer_rollups(NEW.customer_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.customer_id IS NOT NULL THEN
            PERFORM app.recompute_customer_rollups(OLD.customer_id);
        END IF;
        IF NEW.customer_id IS NOT NULL AND NEW.customer_id <> OLD.customer_id THEN
            PERFORM app.recompute_customer_rollups(NEW.customer_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.customer_id IS NOT NULL THEN
            PERFORM app.recompute_customer_rollups(OLD.customer_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_rollups ON ventas;
CREATE TRIGGER trg_clientes_rollups
AFTER INSERT OR UPDATE OR DELETE ON ventas
FOR EACH ROW EXECUTE FUNCTION app.trg_ventas_clientes_rollups();

CREATE OR REPLACE FUNCTION app.trg_pedidos_clientes_tiempos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.delivery_time_days := CASE
        WHEN NEW.delivered_on IS NULL OR NEW.shipped_on IS NULL THEN NULL
        ELSE (NEW.delivered_on - NEW.shipped_on)
    END;

    NEW.payment_time_days := CASE
        WHEN NEW.paid_on IS NULL OR NEW.invoiced_on IS NULL THEN NULL
        ELSE (NEW.paid_on - NEW.invoiced_on)
    END;

    NEW.preparation_time_days := CASE
        WHEN NEW.shipped_on IS NULL OR NEW.ordered_on IS NULL THEN NULL
        ELSE (NEW.shipped_on - NEW.ordered_on)
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_tiempos ON pedidos_clientes;
CREATE TRIGGER trg_pedidos_tiempos
BEFORE INSERT OR UPDATE ON pedidos_clientes
FOR EACH ROW EXECUTE FUNCTION app.trg_pedidos_clientes_tiempos();

CREATE OR REPLACE FUNCTION app.trg_pedidos_clientes_rollups()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.customer_id IS NOT NULL THEN
            PERFORM app.recompute_customer_rollups(NEW.customer_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.customer_id IS NOT NULL THEN
            PERFORM app.recompute_customer_rollups(OLD.customer_id);
        END IF;
        IF NEW.customer_id IS NOT NULL AND NEW.customer_id <> OLD.customer_id THEN
            PERFORM app.recompute_customer_rollups(NEW.customer_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.customer_id IS NOT NULL THEN
            PERFORM app.recompute_customer_rollups(OLD.customer_id);
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_rollups_pedidos ON pedidos_clientes;
CREATE TRIGGER trg_clientes_rollups_pedidos
AFTER INSERT OR UPDATE OR DELETE ON pedidos_clientes
FOR EACH ROW EXECUTE FUNCTION app.trg_pedidos_clientes_rollups();

CREATE OR REPLACE FUNCTION app.trg_pedidos_incompletos_aging()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.aging_days := (CURRENT_DATE - NEW.created_at::date);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_incompletos ON pedidos_incompletos;
CREATE TRIGGER trg_pedidos_incompletos
BEFORE INSERT OR UPDATE ON pedidos_incompletos
FOR EACH ROW EXECUTE FUNCTION app.trg_pedidos_incompletos_aging();

CREATE OR REPLACE FUNCTION app.trg_ventas_period_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.sold_on IS NOT NULL THEN
        NEW.year_month := to_char(NEW.sold_on, 'YYYY-MM');
        NEW.quadrimester := CASE
            WHEN EXTRACT(MONTH FROM NEW.sold_on) BETWEEN 1 AND 4 THEN 'Ene-Abr'
            WHEN EXTRACT(MONTH FROM NEW.sold_on) BETWEEN 5 AND 8 THEN 'May-Ago'
            ELSE 'Sep-Dic'
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_period_fields ON ventas;
CREATE TRIGGER trg_ventas_period_fields
BEFORE INSERT OR UPDATE ON ventas
FOR EACH ROW EXECUTE FUNCTION app.trg_ventas_period_fields();
