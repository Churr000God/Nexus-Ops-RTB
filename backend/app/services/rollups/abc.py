from __future__ import annotations

from sqlalchemy import case, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_models import InventoryItem


class AbcRollupService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def recompute(self) -> int:
        stmt = (
            update(InventoryItem)
            .values(
                abc_classification=case(
                    (InventoryItem.total_accumulated_sales.is_(None), None),
                    (InventoryItem.total_accumulated_sales >= 50000, "A"),
                    (InventoryItem.total_accumulated_sales >= 10000, "B"),
                    else_="C",
                )
            )
            .execution_options(synchronize_session=False)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return int(result.rowcount or 0)
