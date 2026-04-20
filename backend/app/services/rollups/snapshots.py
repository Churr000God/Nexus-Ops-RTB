from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_models import InventoryGrowth, InventoryItem


class InventorySnapshotsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def snapshot_month(
        self, registered_on: date | None = None
    ) -> list[InventoryGrowth]:
        snapshot_on = registered_on or date.today().replace(day=1)

        existing_stmt = select(InventoryGrowth).where(
            InventoryGrowth.registered_on == snapshot_on,
            InventoryGrowth.growth_type.in_(["Inventario", "Productos sin movimiento"]),
        )
        existing = (await self.db.execute(existing_stmt)).scalars().all()
        by_type = {
            row.growth_type: row for row in existing if row.growth_type is not None
        }

        total_value_stmt = select(
            func.coalesce(func.sum(InventoryItem.stock_total_cost), 0)
        )
        total_value = (await self.db.execute(total_value_stmt)).scalar_one()

        dormant_count_stmt = select(func.count(InventoryItem.id)).where(
            InventoryItem.days_without_movement.is_not(None),
            InventoryItem.days_without_movement > 180,
        )
        dormant_count = (await self.db.execute(dormant_count_stmt)).scalar_one()

        created: list[InventoryGrowth] = []

        if "Inventario" not in by_type:
            row = InventoryGrowth(
                name=f"Inventario {snapshot_on.isoformat()}",
                registered_on=snapshot_on,
                amount=total_value,
                growth_type="Inventario",
            )
            self.db.add(row)
            created.append(row)

        if "Productos sin movimiento" not in by_type:
            row = InventoryGrowth(
                name=f"Productos sin movimiento {snapshot_on.isoformat()}",
                registered_on=snapshot_on,
                amount=dormant_count,
                growth_type="Productos sin movimiento",
            )
            self.db.add(row)
            created.append(row)

        await self.db.commit()
        for row in created:
            await self.db.refresh(row)
        return created
