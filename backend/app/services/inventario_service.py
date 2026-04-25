from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.inventario_schema import InventarioKpiResponse, InventarioProductoResponse

# inventario.real_qty / theoretical_qty are Notion-pre-computed formulas — source of truth.
# Cost comes from proveedor_productos since inventario.unit_cost is populated by sync.
_BASE_STOCK = """
WITH costo AS (
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
    i.real_qty        AS stock_real,
    i.theoretical_qty AS stock_teorico
  FROM inventario i
  JOIN  productos p  ON p.id  = i.product_id
  JOIN  costo     cu ON cu.product_id = p.id
)
"""


class InventarioService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_kpis(self) -> InventarioKpiResponse:
        sql = text(
            _BASE_STOCK
            + """
            SELECT
              COUNT(*)                                                       AS total_productos,
              COUNT(*) FILTER (WHERE stock_real > 0)                        AS con_stock_positivo,
              COUNT(*) FILTER (WHERE stock_real = 0)                        AS sin_stock,
              COUNT(*) FILTER (WHERE stock_real < 0)                        AS stock_negativo,
              COALESCE(SUM(GREATEST(stock_real,  0) * costo_unitario), 0)   AS monto_total_real,
              COALESCE(SUM(GREATEST(stock_teorico, 0) * costo_unitario), 0) AS monto_total_teorico
            FROM stock
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
        filtro = "WHERE stock_real > 0" if solo_con_stock else ""
        sql = text(
            _BASE_STOCK
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
