from __future__ import annotations

from pydantic import BaseModel


class InventarioKpiResponse(BaseModel):
    total_productos: int
    con_stock_positivo: int
    sin_stock: int
    stock_negativo: int
    monto_total_real: float
    monto_total_teorico: float


class InventarioProductoResponse(BaseModel):
    internal_code: str | None = None
    sku: str | None = None
    name: str
    costo_unitario: float | None = None
    stock_real: float
    stock_teorico: float
    monto_real: float
    monto_teorico: float
    abc_classification: str | None = None
