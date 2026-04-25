from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.inventario_schema import InventarioKpiResponse, InventarioProductoResponse

_STOCK_CTE = """
WITH
entradas AS (
  SELECT product_id, SUM(qty_arrived) AS total_real, SUM(qty_requested) AS total_req
  FROM entradas_mercancia
  WHERE product_id IS NOT NULL
  GROUP BY product_id
),
solicitudes AS (
  SELECT product_id, SUM(qty_requested) AS total
  FROM solicitudes_material
  WHERE qty_requested IS NOT NULL AND product_id IS NOT NULL
  GROUP BY product_id
),
salidas_reales AS (
  SELECT ci.product_id, SUM(ci.qty_packed) AS total
  FROM cotizacion_items ci
  JOIN cotizaciones c ON c.id = ci.quote_id
  WHERE c.status = 'Aprobada'
    AND ci.qty_packed IS NOT NULL
    AND ci.product_id IS NOT NULL
  GROUP BY ci.product_id
),
salidas_teoricas AS (
  SELECT ci.product_id, SUM(ci.qty_requested) AS total
  FROM cotizacion_items ci
  JOIN cotizaciones c ON c.id = ci.quote_id
  WHERE c.status = 'Aprobada'
    AND ci.qty_requested IS NOT NULL
    AND ci.product_id IS NOT NULL
  GROUP BY ci.product_id
),
ajustes AS (
  SELECT product_id, SUM(inventory_adjustment) AS total
  FROM no_conformes
  WHERE inventory_adjustment IS NOT NULL AND product_id IS NOT NULL
  GROUP BY product_id
),
costo AS (
  SELECT product_id, AVG(price) AS costo_unitario
  FROM proveedor_productos
  WHERE price IS NOT NULL AND price > 0
  GROUP BY product_id
),
stock AS (
  SELECT
    p.id,
    p.internal_code,
    p.sku,
    p.name,
    i.abc_classification,
    cu.costo_unitario,
    COALESCE(e.total_real, 0) - COALESCE(sr.total, 0) + COALESCE(a.total, 0)  AS stock_real,
    COALESCE(e.total_req, 0)
      + (COALESCE(e.total_req, 0) - COALESCE(sol.total, 0))
      - COALESCE(st.total, 0)
      + COALESCE(a.total, 0)                                                   AS stock_teorico
  FROM productos p
  LEFT JOIN inventario       i   ON i.product_id   = p.id
  LEFT JOIN entradas         e   ON e.product_id   = p.id
  LEFT JOIN solicitudes      sol ON sol.product_id = p.id
  LEFT JOIN salidas_reales   sr  ON sr.product_id  = p.id
  LEFT JOIN salidas_teoricas st  ON st.product_id  = p.id
  LEFT JOIN ajustes          a   ON a.product_id   = p.id
  LEFT JOIN costo            cu  ON cu.product_id  = p.id
)
"""


class InventarioService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_kpis(self) -> InventarioKpiResponse:
        sql = text(
            _STOCK_CTE
            + """
            SELECT
              COUNT(*)                                                       AS total_productos,
              COUNT(*) FILTER (WHERE stock_real > 0)                        AS con_stock_positivo,
              COUNT(*) FILTER (WHERE stock_real = 0)                        AS sin_stock,
              COUNT(*) FILTER (WHERE stock_real < 0)                        AS stock_negativo,
              COALESCE(SUM(GREATEST(stock_real,  0) * costo_unitario), 0)   AS monto_total_real,
              COALESCE(SUM(GREATEST(stock_teorico, 0) * costo_unitario), 0) AS monto_total_teorico
            FROM stock
            WHERE costo_unitario IS NOT NULL
            """
        )
        row = (await self.db.execute(sql)).mappings().one()
        return InventarioKpiResponse(
            total_productos=row["total_productos"],
            con_stock_positivo=row["con_stock_positivo"],
            sin_stock=row["sin_stock"],
            stock_negativo=row["stock_negativo"],
            monto_total_real=float(row["monto_total_real"]),
            monto_total_teorico=float(row["monto_total_teorico"]),
        )

    async def get_productos(
        self,
        limit: int = 100,
        offset: int = 0,
        solo_con_stock: bool = False,
    ) -> list[InventarioProductoResponse]:
        filtro = "WHERE costo_unitario IS NOT NULL AND stock_real > 0" if solo_con_stock else "WHERE costo_unitario IS NOT NULL"
        sql = text(
            _STOCK_CTE
            + f"""
            SELECT
              internal_code,
              sku,
              name,
              costo_unitario,
              stock_real,
              stock_teorico,
              GREATEST(stock_real,    0) * costo_unitario AS monto_real,
              GREATEST(stock_teorico, 0) * costo_unitario AS monto_teorico,
              abc_classification
            FROM stock
            {filtro}
            ORDER BY monto_real DESC
            LIMIT :limit OFFSET :offset
            """
        )
        rows = (await self.db.execute(sql, {"limit": limit, "offset": offset})).mappings().all()
        return [
            InventarioProductoResponse(
                internal_code=r["internal_code"],
                sku=r["sku"],
                name=r["name"],
                costo_unitario=float(r["costo_unitario"]) if r["costo_unitario"] else None,
                stock_real=float(r["stock_real"]),
                stock_teorico=float(r["stock_teorico"]),
                monto_real=float(r["monto_real"]),
                monto_teorico=float(r["monto_teorico"]),
                abc_classification=r["abc_classification"],
            )
            for r in rows
        ]
