from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.staging_models import CsvFile, CsvRow


class CsvDataFetch:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_latest_file(self, dataset: str) -> CsvFile | None:
        stmt = (
            select(CsvFile)
            .where(CsvFile.dataset == dataset)
            .order_by(CsvFile.uploaded_at.desc())
            .limit(1)
        )
        return await self.db.scalar(stmt)

    async def get_rows(
        self,
        csv_file_id: int,
        *,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(CsvRow.data)
            .where(CsvRow.csv_file_id == csv_file_id)
            .order_by(CsvRow.row_number.asc())
            .limit(limit)
            .offset(offset)
        )
        rows: Sequence[tuple[dict[str, Any]]] = (await self.db.execute(stmt)).all()
        return [row[0] for row in rows]

    async def get_latest_rows(
        self,
        dataset: str,
        *,
        limit: int = 1000,
        offset: int = 0,
    ) -> tuple[CsvFile | None, list[dict[str, Any]]]:
        csv_file = await self.get_latest_file(dataset)
        if csv_file is None:
            return None, []
        return csv_file, await self.get_rows(csv_file.id, limit=limit, offset=offset)
