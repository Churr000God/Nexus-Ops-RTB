from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AbcRollupService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def recompute(self) -> int:
        result = await self.db.execute(
            text(
                """
                UPDATE inventario i
                SET abc_classification = CASE
                    WHEN p.total_accumulated_sales IS NULL THEN NULL
                    WHEN p.total_accumulated_sales >= 50000 THEN 'A'
                    WHEN p.total_accumulated_sales >= 10000 THEN 'B'
                    ELSE 'C'
                END
                FROM productos p
                WHERE i.product_id = p.id
                """
            )
        )
        await self.db.commit()
        return int(result.rowcount or 0)
