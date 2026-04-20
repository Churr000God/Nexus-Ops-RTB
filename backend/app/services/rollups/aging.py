from __future__ import annotations

from sqlalchemy import case, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_models import InventoryItem


class AgingRollupService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def recompute(self) -> int:
        stmt = (
            update(InventoryItem)
            .values(
                aging_classification=case(
                    (InventoryItem.days_without_movement.is_(None), None),
                    (InventoryItem.days_without_movement <= 30, "Activo"),
                    (InventoryItem.days_without_movement <= 90, "Rotación baja"),
                    (InventoryItem.days_without_movement <= 180, "Dormido"),
                    (InventoryItem.days_without_movement <= 365, "Inactivo"),
                    else_="Obsoleto",
                )
            )
            .execution_options(synchronize_session=False)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return int(result.rowcount or 0)
