from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID


def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.assets_models import Asset, AssetAssignmentHistory, AssetComponent, AssetDepreciationConfig, AssetWorkOrder, InventorySnapshot, PhysicalCount, PhysicalCountLine, ProductCountLine
from app.models.ops_models import InventoryMovement
from app.schemas.assets_schema import (
    AssetAssignmentRead,
    AssetComponentCreate,
    AssetComponentDetailRead,
    AssetComponentHistoryRead,
    AssetCreate,
    AssetRead,
    AssetUpdate,
    AssignAssetPayload,
    InventoryCurrentRead,
    InventoryKpiSummaryRead,
    InventorySnapshotRead,
    DepreciationConfigCreate,
    DepreciationConfigRead,
    DepreciationPeriodRead,
    DepreciationScheduleRead,
    PhysicalCountCreate,
    PhysicalCountLineRead,
    PhysicalCountLineUpdate,
    PhysicalCountRead,
    AdjustmentCreate,
    InventoryMovementRead,
    ProductCountLineRead,
    ProductCountLineUpdate,
    RemoveComponentRequest,
    RetireAssetPayload,
    WorkOrderCreate,
    WorkOrderRead,
    WorkOrderUpdate,
)


class AssetService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Assets CRUD ──────────────────────────────────────────────────────────

    async def list_assets(
        self,
        status: str | None = None,
        asset_type: str | None = None,
        location: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AssetRead]:
        stmt = select(Asset)
        if status:
            stmt = stmt.where(Asset.status == status)
        if asset_type:
            stmt = stmt.where(Asset.asset_type == asset_type)
        if location:
            stmt = stmt.where(Asset.location.ilike(f"%{location}%"))
        if search:
            like = f"%{search}%"
            from sqlalchemy import or_
            stmt = stmt.where(
                or_(Asset.asset_code.ilike(like), Asset.name.ilike(like))
            )
        stmt = stmt.order_by(Asset.asset_code).limit(limit).offset(offset)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [AssetRead.model_validate(r) for r in rows]

    async def get_asset(self, asset_id: UUID) -> AssetRead | None:
        row = await self.db.get(Asset, asset_id)
        return AssetRead.model_validate(row) if row else None

    async def create_asset(self, data: AssetCreate, user_id: UUID) -> AssetRead:
        asset = Asset(**data.model_dump())
        self.db.add(asset)
        await self.db.commit()
        await self.db.refresh(asset)
        return AssetRead.model_validate(asset)

    async def update_asset(self, asset_id: UUID, data: AssetUpdate) -> AssetRead | None:
        asset = await self.db.get(Asset, asset_id)
        if not asset:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(asset, field, value)
        await self.db.commit()
        await self.db.refresh(asset)
        return AssetRead.model_validate(asset)

    # ── Componentes ──────────────────────────────────────────────────────────

    async def get_components(self, asset_id: UUID) -> list[AssetComponentDetailRead]:
        """Componentes actuales vía v_asset_current_components."""
        sql = text("""
            SELECT
                asset_component_id,
                product_id,
                component_sku,
                component_name,
                quantity,
                serial_number,
                installed_at,
                installed_by_email,
                notes
            FROM v_asset_current_components
            WHERE asset_id = :asset_id
            ORDER BY installed_at DESC
        """)
        rows = (await self.db.execute(sql, {"asset_id": asset_id})).mappings().all()
        return [AssetComponentDetailRead(**r) for r in rows]

    async def install_component(
        self,
        asset_id: UUID,
        data: AssetComponentCreate,
        user_id: UUID,
    ) -> AssetComponentDetailRead:
        """Inserta en asset_components — el trigger fn_on_component_install
        crea automáticamente el movimiento ISSUE y el registro de historial."""
        component = AssetComponent(
            asset_id=asset_id,
            product_id=data.product_id,
            quantity=data.quantity,
            serial_number=data.serial_number,
            installed_by=user_id,
            notes=data.notes,
        )
        self.db.add(component)
        await self.db.commit()
        await self.db.refresh(component)

        rows = await self.get_components(asset_id)
        installed = next((r for r in rows if r.asset_component_id == component.id), None)
        if installed:
            return installed
        return AssetComponentDetailRead(
            asset_component_id=component.id,
            product_id=component.product_id,
            component_sku=None,
            component_name=None,
            quantity=float(component.quantity),
            serial_number=component.serial_number,
            installed_at=component.installed_at,
            installed_by_email=None,
            notes=component.notes,
        )

    async def remove_component(
        self,
        asset_component_id: UUID,
        data: RemoveComponentRequest,
        user_id: UUID,
    ) -> None:
        """Llama a fn_remove_asset_component (función plpgsql atómica)."""
        await self.db.execute(
            text("""
                SELECT fn_remove_asset_component(
                    CAST(:comp_id   AS UUID),
                    CAST(:reusable  AS BOOLEAN),
                    CAST(:user_id   AS UUID),
                    CAST(:reason    AS TEXT),
                    CAST(:notes     AS TEXT)
                )
            """),
            {
                "comp_id": str(asset_component_id),
                "reusable": data.is_reusable,
                "user_id": str(user_id),
                "reason": data.reason,
                "notes": data.notes,
            },
        )
        await self.db.commit()

    # ── Historial ────────────────────────────────────────────────────────────

    async def get_history(
        self,
        asset_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AssetComponentHistoryRead]:
        sql = text("""
            SELECT
                history_id,
                occurred_at,
                operation,
                component_sku,
                component_name,
                quantity,
                serial_number,
                performed_by,
                reason,
                notes,
                inventory_movement_id,
                nc_id
            FROM v_asset_repair_history
            WHERE asset_id = :asset_id
            ORDER BY occurred_at DESC
            LIMIT :limit OFFSET :offset
        """)
        rows = (
            await self.db.execute(sql, {"asset_id": asset_id, "limit": limit, "offset": offset})
        ).mappings().all()
        return [AssetComponentHistoryRead(**r) for r in rows]

    # ── Asignaciones ─────────────────────────────────────────────────────────

    async def assign_asset(
        self,
        asset_id: UUID,
        data: AssignAssetPayload,
        assigned_by: UUID,
    ) -> AssetAssignmentRead:
        asset = await self.db.get(Asset, asset_id)
        if not asset:
            raise ValueError("Asset no encontrado")

        entry = AssetAssignmentHistory(
            asset_id=asset_id,
            user_id=data.user_id,
            location=data.location if data.location is not None else asset.location,
            assigned_by=assigned_by,
            notes=data.notes,
        )
        self.db.add(entry)

        asset.assigned_user_id = data.user_id
        if data.location is not None:
            asset.location = data.location

        await self.db.commit()
        await self.db.refresh(entry)

        sql = text("""
            SELECT
                aah.id,
                aah.asset_id,
                aah.user_id,
                u.email        AS user_email,
                u.full_name    AS user_name,
                aah.location,
                aah.assigned_at,
                ab.email       AS assigned_by_email,
                aah.notes
            FROM asset_assignment_history aah
            LEFT JOIN users u  ON u.id = aah.user_id
            LEFT JOIN users ab ON ab.id = aah.assigned_by
            WHERE aah.id = :id
        """)
        row = (await self.db.execute(sql, {"id": entry.id})).mappings().one()
        return AssetAssignmentRead(**row)

    async def get_assignments(
        self,
        asset_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AssetAssignmentRead]:
        sql = text("""
            SELECT
                aah.id,
                aah.asset_id,
                aah.user_id,
                u.email        AS user_email,
                u.full_name    AS user_name,
                aah.location,
                aah.assigned_at,
                ab.email       AS assigned_by_email,
                aah.notes
            FROM asset_assignment_history aah
            LEFT JOIN users u  ON u.id = aah.user_id
            LEFT JOIN users ab ON ab.id = aah.assigned_by
            WHERE aah.asset_id = :asset_id
            ORDER BY aah.assigned_at DESC
            LIMIT :limit OFFSET :offset
        """)
        rows = (
            await self.db.execute(sql, {"asset_id": asset_id, "limit": limit, "offset": offset})
        ).mappings().all()
        return [AssetAssignmentRead(**r) for r in rows]

    # ── Órdenes de Mantenimiento ─────────────────────────────────────────────

    async def _wo_to_read(self, wo_id: UUID) -> WorkOrderRead:
        """Enriquece la orden con el email del técnico asignado."""
        sql = text("""
            SELECT
                wo.id, wo.asset_id, wo.title, wo.description,
                wo.work_type, wo.priority, wo.status,
                wo.assigned_to,
                u.email AS assigned_to_email,
                wo.scheduled_date, wo.started_at, wo.completed_at,
                wo.cost, wo.notes, wo.created_by,
                wo.created_at, wo.updated_at
            FROM asset_work_orders wo
            LEFT JOIN users u ON u.id = wo.assigned_to
            WHERE wo.id = :id
        """)
        row = (await self.db.execute(sql, {"id": wo_id})).mappings().one()
        return WorkOrderRead(**row)

    async def create_work_order(
        self,
        asset_id: UUID,
        data: WorkOrderCreate,
        user_id: UUID,
    ) -> WorkOrderRead:
        wo = AssetWorkOrder(
            asset_id=asset_id,
            title=data.title,
            description=data.description,
            work_type=data.work_type,
            priority=data.priority,
            scheduled_date=data.scheduled_date,
            cost=data.cost,
            notes=data.notes,
            created_by=user_id,
        )
        self.db.add(wo)
        await self.db.commit()
        await self.db.refresh(wo)
        return await self._wo_to_read(wo.id)

    async def list_work_orders(
        self,
        asset_id: UUID,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WorkOrderRead]:
        sql = text("""
            SELECT
                wo.id, wo.asset_id, wo.title, wo.description,
                wo.work_type, wo.priority, wo.status,
                wo.assigned_to,
                u.email AS assigned_to_email,
                wo.scheduled_date, wo.started_at, wo.completed_at,
                wo.cost, wo.notes, wo.created_by,
                wo.created_at, wo.updated_at
            FROM asset_work_orders wo
            LEFT JOIN users u ON u.id = wo.assigned_to
            WHERE wo.asset_id = :asset_id
            {status_filter}
            ORDER BY
                CASE wo.status WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,
                wo.created_at DESC
            LIMIT :limit OFFSET :offset
        """.format(status_filter="AND wo.status = :status" if status else ""))
        params: dict = {"asset_id": asset_id, "limit": limit, "offset": offset}
        if status:
            params["status"] = status
        rows = (await self.db.execute(sql, params)).mappings().all()
        return [WorkOrderRead(**r) for r in rows]

    async def update_work_order(
        self,
        asset_id: UUID,
        wo_id: UUID,
        data: WorkOrderUpdate,
        user_id: UUID,
    ) -> WorkOrderRead:
        wo = await self.db.get(AssetWorkOrder, wo_id)
        if not wo or wo.asset_id != asset_id:
            raise ValueError("Orden de trabajo no encontrada")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(wo, field, value)
        wo.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        return await self._wo_to_read(wo.id)

    # ── Jerarquía ────────────────────────────────────────────────────────────

    async def get_children(self, asset_id: UUID) -> list[AssetRead]:
        stmt = (
            select(Asset)
            .where(Asset.parent_asset_id == asset_id)
            .order_by(Asset.asset_code)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [AssetRead.model_validate(r) for r in rows]

    # ── Retiro formal ────────────────────────────────────────────────────────

    async def retire_asset(
        self,
        asset_id: UUID,
        data: RetireAssetPayload,
        user_id: UUID,
    ) -> AssetRead:
        asset = await self.db.get(Asset, asset_id)
        if not asset:
            raise ValueError("Asset no encontrado")
        if asset.status in ("RETIRED", "DISMANTLED"):
            raise ValueError(f"El activo ya está en estado '{asset.status}'")

        asset.status = "RETIRED"
        asset.retired_at = datetime.now(timezone.utc)
        asset.retirement_reason = data.retirement_reason
        asset.salvage_value = data.salvage_value
        asset.retired_by = user_id
        await self.db.commit()
        await self.db.refresh(asset)
        return AssetRead.model_validate(asset)

    # ── Conteo Físico ────────────────────────────────────────────────────────

    def _count_to_read(self, count: PhysicalCount) -> PhysicalCountRead:
        base = dict(
            id=count.id,
            count_date=count.count_date,
            count_type=getattr(count, "count_type", "ASSET"),
            location_filter=count.location_filter,
            status=count.status,
            notes=count.notes,
            created_by=count.created_by,
            created_at=count.created_at,
            confirmed_at=count.confirmed_at,
            confirmed_by=count.confirmed_by,
        )
        if getattr(count, "count_type", "ASSET") == "PRODUCT":
            pl = count.product_lines if count.product_lines is not None else []
            total = len(pl)
            counted = sum(1 for l in pl if l.counted_qty is not None)
            discrepancy = sum(
                1 for l in pl
                if l.counted_qty is not None
                and abs(float(l.counted_qty) - float(l.real_qty)) > 0.001
            )
            return PhysicalCountRead(
                **base,
                total_lines=total,
                counted_lines=counted,
                discrepancy_lines=discrepancy,
                uncounted_lines=total - counted,
            )
        else:
            lines = count.lines if count.lines is not None else []
            total = len(lines)
            found = sum(1 for l in lines if l.found is True)
            not_found = sum(1 for l in lines if l.found is False)
            return PhysicalCountRead(
                **base,
                total_lines=total,
                found_count=found,
                not_found_count=not_found,
                pending_count=total - found - not_found,
            )

    async def create_physical_count(
        self,
        data: PhysicalCountCreate,
        user_id: UUID,
    ) -> PhysicalCountRead:
        count = PhysicalCount(
            count_date=data.count_date,
            count_type=data.count_type,
            location_filter=data.location_filter,
            notes=data.notes,
            created_by=user_id,
        )
        self.db.add(count)
        await self.db.flush()

        if data.count_type == "PRODUCT":
            sql = text("""
                SELECT
                    p.id        AS product_id,
                    p.sku,
                    p.name      AS product_name,
                    p.is_saleable,
                    c.name      AS category,
                    COALESCE(SUM(im.qty_in) - SUM(im.qty_out), 0) AS real_qty,
                    iv.theoretical_qty
                FROM productos p
                LEFT JOIN inventory_movements im ON im.product_id = p.id
                LEFT JOIN categorias c ON c.id = p.category_id
                LEFT JOIN inventario iv ON iv.product_id = p.id
                GROUP BY p.id, p.sku, p.name, p.is_saleable, c.name, iv.theoretical_qty
                ORDER BY p.name
            """)
            rows = (await self.db.execute(sql)).mappings().all()
            for row in rows:
                self.db.add(ProductCountLine(
                    count_id=count.id,
                    product_id=row["product_id"],
                    sku=row["sku"],
                    product_name=row["product_name"],
                    is_saleable=row["is_saleable"],
                    category=row["category"],
                    theoretical_qty=row["theoretical_qty"],
                    real_qty=float(row["real_qty"]),
                ))

            # Equipos activos como líneas internas (is_saleable=False, qty=1 c/u)
            assets_sql = text("""
                SELECT
                    asset_code AS sku,
                    name       AS product_name,
                    asset_type AS category
                FROM assets
                WHERE status NOT IN ('RETIRED', 'DISMANTLED')
                ORDER BY asset_code
            """)
            asset_rows = (await self.db.execute(assets_sql)).mappings().all()
            for row in asset_rows:
                self.db.add(ProductCountLine(
                    count_id=count.id,
                    product_id=None,
                    sku=row["sku"],
                    product_name=row["product_name"],
                    is_saleable=False,
                    category=row["category"],
                    theoretical_qty=1,
                    real_qty=1,
                ))

            # Componentes instalados en activos como líneas internas (is_saleable=False)
            comp_sql = text("""
                SELECT
                    p.id        AS product_id,
                    p.sku,
                    p.name      AS product_name,
                    c.name      AS category,
                    SUM(ac.quantity) AS real_qty
                FROM asset_components ac
                JOIN productos p ON p.id = ac.product_id
                JOIN assets a ON a.id = ac.asset_id
                    AND a.status NOT IN ('RETIRED', 'DISMANTLED')
                LEFT JOIN categorias c ON c.id = p.category_id
                GROUP BY p.id, p.sku, p.name, c.name
                ORDER BY p.name
            """)
            comp_rows = (await self.db.execute(comp_sql)).mappings().all()
            for row in comp_rows:
                qty = float(row["real_qty"])
                self.db.add(ProductCountLine(
                    count_id=count.id,
                    product_id=row["product_id"],
                    sku=row["sku"],
                    product_name=row["product_name"],
                    is_saleable=False,
                    category=row["category"],
                    theoretical_qty=qty,
                    real_qty=qty,
                ))
        else:
            asset_where = "status NOT IN ('RETIRED', 'DISMANTLED')"
            asset_params: dict = {}
            if data.location_filter:
                asset_where += " AND location ILIKE :loc"
                asset_params["loc"] = f"%{data.location_filter}%"
            asset_sql = text(
                f"SELECT id, asset_code, name, location FROM assets WHERE {asset_where} ORDER BY asset_code"
            )
            asset_rows = (await self.db.execute(asset_sql, asset_params)).mappings().all()
            for row in asset_rows:
                self.db.add(PhysicalCountLine(
                    count_id=count.id,
                    asset_id=row["id"],
                    asset_code=row["asset_code"],
                    asset_name=row["name"],
                    expected_location=row["location"],
                ))

        await self.db.commit()

        count_sql = text("""
            SELECT COUNT(*) AS total
            FROM product_count_lines WHERE count_id = CAST(:cid AS UUID)
        """ if data.count_type == "PRODUCT" else """
            SELECT COUNT(*) AS total
            FROM physical_count_lines WHERE count_id = CAST(:cid AS UUID)
        """)
        total_lines = int(
            (await self.db.execute(count_sql, {"cid": str(count.id)})).scalar_one()
        )
        base = dict(
            id=count.id,
            count_date=count.count_date,
            count_type=data.count_type,
            location_filter=count.location_filter,
            status=count.status,
            notes=count.notes,
            created_by=count.created_by,
            created_at=count.created_at,
            confirmed_at=count.confirmed_at,
            confirmed_by=count.confirmed_by,
        )
        if data.count_type == "PRODUCT":
            return PhysicalCountRead(**base, total_lines=total_lines, uncounted_lines=total_lines)
        return PhysicalCountRead(**base, total_lines=total_lines, pending_count=total_lines)

    async def list_physical_counts(
        self,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[PhysicalCountRead]:
        where = "WHERE 1=1"
        params: dict[str, object] = {"lim": limit, "off": offset}
        if status:
            where += " AND pc.status = :status"
            params["status"] = status

        sql = text(f"""
            SELECT
                pc.id, pc.count_date, pc.count_type, pc.location_filter,
                pc.status, pc.notes, pc.created_by, pc.created_at,
                pc.confirmed_at, pc.confirmed_by,
                COALESCE(al.line_count, 0)    AS asset_total,
                COALESCE(al.found_count, 0)   AS found_count,
                COALESCE(al.nf_count, 0)      AS not_found_count,
                COALESCE(pl.total_lines, 0)   AS product_total,
                COALESCE(pl.counted_lines, 0) AS counted_lines,
                COALESCE(pl.discrepancy, 0)   AS discrepancy_lines
            FROM physical_counts pc
            LEFT JOIN (
                SELECT count_id,
                       COUNT(*) AS line_count,
                       SUM(CASE WHEN found IS TRUE  THEN 1 ELSE 0 END) AS found_count,
                       SUM(CASE WHEN found IS FALSE THEN 1 ELSE 0 END) AS nf_count
                FROM physical_count_lines
                GROUP BY count_id
            ) al ON al.count_id = pc.id
            LEFT JOIN (
                SELECT count_id,
                       COUNT(*) AS total_lines,
                       SUM(CASE WHEN counted_qty IS NOT NULL THEN 1 ELSE 0 END) AS counted_lines,
                       SUM(CASE WHEN counted_qty IS NOT NULL
                                  AND ABS(counted_qty::float - real_qty::float) > 0.001
                                THEN 1 ELSE 0 END) AS discrepancy
                FROM product_count_lines
                GROUP BY count_id
            ) pl ON pl.count_id = pc.id
            {where}
            ORDER BY pc.count_date DESC, pc.created_at DESC
            LIMIT :lim OFFSET :off
        """)
        rows = (await self.db.execute(sql, params)).mappings().all()
        result: list[PhysicalCountRead] = []
        for r in rows:
            base = dict(
                id=r["id"],
                count_date=r["count_date"],
                count_type=r["count_type"],
                location_filter=r["location_filter"],
                status=r["status"],
                notes=r["notes"],
                created_by=r["created_by"],
                created_at=r["created_at"],
                confirmed_at=r["confirmed_at"],
                confirmed_by=r["confirmed_by"],
            )
            if r["count_type"] == "PRODUCT":
                total = int(r["product_total"])
                counted = int(r["counted_lines"])
                disc = int(r["discrepancy_lines"])
                result.append(PhysicalCountRead(
                    **base,
                    total_lines=total,
                    counted_lines=counted,
                    discrepancy_lines=disc,
                    uncounted_lines=total - counted,
                ))
            else:
                total = int(r["asset_total"])
                found = int(r["found_count"])
                nf = int(r["not_found_count"])
                result.append(PhysicalCountRead(
                    **base,
                    total_lines=total,
                    found_count=found,
                    not_found_count=nf,
                    pending_count=total - found - nf,
                ))
        return result

    async def get_physical_count_lines(
        self,
        count_id: UUID,
    ) -> list[PhysicalCountLineRead]:
        sql = text("""
            SELECT
                pcl.id, pcl.count_id, pcl.asset_id,
                pcl.asset_code, pcl.asset_name,
                pcl.expected_location, pcl.scanned_location,
                pcl.found, pcl.notes,
                pcl.updated_by, pcl.updated_at,
                u.email AS updated_by_email
            FROM physical_count_lines pcl
            LEFT JOIN users u ON u.id = pcl.updated_by
            WHERE pcl.count_id = CAST(:count_id AS UUID)
            ORDER BY pcl.asset_code
        """)
        rows = (await self.db.execute(sql, {"count_id": str(count_id)})).mappings().all()
        return [PhysicalCountLineRead.model_validate(dict(r)) for r in rows]

    async def get_product_count_lines(
        self,
        count_id: UUID,
        search: str | None = None,
        is_saleable: bool | None = None,
    ) -> list[ProductCountLineRead]:
        sql_str = """
            SELECT
                pcl.id, pcl.count_id, pcl.product_id,
                pcl.sku, pcl.product_name, pcl.is_saleable,
                pcl.category, pcl.theoretical_qty, pcl.real_qty,
                pcl.counted_qty, pcl.notes,
                pcl.updated_by, pcl.updated_at,
                u.email AS updated_by_email
            FROM product_count_lines pcl
            LEFT JOIN users u ON u.id = pcl.updated_by
            WHERE pcl.count_id = CAST(:count_id AS UUID)
        """
        params: dict = {"count_id": str(count_id)}
        if search:
            sql_str += " AND (pcl.sku ILIKE :search OR pcl.product_name ILIKE :search)"
            params["search"] = f"%{search}%"
        if is_saleable is not None:
            sql_str += " AND pcl.is_saleable = CAST(:is_saleable AS BOOLEAN)"
            params["is_saleable"] = is_saleable
        sql_str += " ORDER BY pcl.product_name"
        rows = (await self.db.execute(text(sql_str), params)).mappings().all()
        return [ProductCountLineRead.model_validate(dict(r)) for r in rows]

    async def update_count_line(
        self,
        count_id: UUID,
        line_id: UUID,
        data: PhysicalCountLineUpdate,
        user_id: UUID | None = None,
    ) -> PhysicalCountLineRead:
        line = await self.db.get(PhysicalCountLine, line_id)
        if not line or line.count_id != count_id:
            raise ValueError("Línea no encontrada")
        count = await self.db.get(PhysicalCount, count_id)
        if count and count.status != "DRAFT":
            raise ValueError("El conteo ya está cerrado")
        if data.found is not None:
            line.found = data.found
        if data.scanned_location is not None:
            line.scanned_location = data.scanned_location
        if data.notes is not None:
            line.notes = data.notes
        if user_id:
            line.updated_by = user_id
            line.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        # reload con email
        rows = (await self.db.execute(
            text("""
                SELECT pcl.*, u.email AS updated_by_email
                FROM physical_count_lines pcl
                LEFT JOIN users u ON u.id = pcl.updated_by
                WHERE pcl.id = CAST(:id AS UUID)
            """),
            {"id": str(line_id)},
        )).mappings().all()
        return PhysicalCountLineRead.model_validate(dict(rows[0]))

    async def update_product_count_line(
        self,
        count_id: UUID,
        line_id: UUID,
        data: ProductCountLineUpdate,
        user_id: UUID | None = None,
    ) -> ProductCountLineRead:
        line = await self.db.get(ProductCountLine, line_id)
        if not line or line.count_id != count_id:
            raise ValueError("Línea no encontrada")
        count = await self.db.get(PhysicalCount, count_id)
        if count and count.status != "DRAFT":
            raise ValueError("El conteo ya está cerrado")
        if data.counted_qty is not None:
            line.counted_qty = data.counted_qty
        elif data.counted_qty is None and "counted_qty" in data.model_fields_set:
            line.counted_qty = None
        if data.notes is not None:
            line.notes = data.notes
        if user_id:
            line.updated_by = user_id
            line.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        rows = (await self.db.execute(
            text("""
                SELECT pcl.*, u.email AS updated_by_email
                FROM product_count_lines pcl
                LEFT JOIN users u ON u.id = pcl.updated_by
                WHERE pcl.id = CAST(:id AS UUID)
            """),
            {"id": str(line_id)},
        )).mappings().all()
        return ProductCountLineRead.model_validate(dict(rows[0]))

    async def confirm_physical_count(
        self,
        count_id: UUID,
        user_id: UUID,
    ) -> PhysicalCountRead:
        count = await self.db.get(PhysicalCount, count_id)
        if not count:
            raise ValueError("Conteo no encontrado")
        if count.status != "DRAFT":
            raise ValueError(f"El conteo ya está en estado '{count.status}'")
        count.status = "CONFIRMED"
        count.confirmed_at = datetime.now(timezone.utc)
        count.confirmed_by = user_id
        await self.db.commit()

        stmt = (
            select(PhysicalCount)
            .where(PhysicalCount.id == count_id)
            .options(selectinload(PhysicalCount.lines), selectinload(PhysicalCount.product_lines))
        )
        count = (await self.db.execute(stmt)).scalar_one()
        return self._count_to_read(count)

    # ── Snapshots ────────────────────────────────────────────────────────────

    async def list_snapshots(
        self,
        product_id: UUID | None = None,
        limit: int = 12,
    ) -> list[InventorySnapshotRead]:
        stmt = select(InventorySnapshot).order_by(InventorySnapshot.snapshot_date.desc()).limit(limit)
        if product_id:
            stmt = stmt.where(InventorySnapshot.product_id == product_id)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [InventorySnapshotRead.model_validate(r) for r in rows]

    async def close_monthly_snapshot(self) -> int:
        result = await self.db.execute(text("SELECT fn_close_monthly_snapshot()"))
        await self.db.commit()
        return result.scalar_one()

    # ── Movimientos & Ajustes ────────────────────────────────────────────────

    _MOVEMENT_JOIN = """
        SELECT
            im.id, im.movement_number, im.product_id,
            p.sku  AS product_sku,
            p.name AS product_name,
            im.movement_type,
            im.qty_in, im.qty_out, im.qty_nonconformity,
            im.unit_cost, im.moved_on,
            im.origin, im.destination, im.observations,
            u.email AS created_by_email,
            im.created_at
        FROM inventory_movements im
        LEFT JOIN productos p ON p.id = im.product_id
        LEFT JOIN users u     ON u.id = im.created_by_user_id
    """

    async def list_movements(
        self,
        product_id: UUID | None = None,
        movement_type: str | None = None,
        search: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[InventoryMovementRead]:
        sql_str = self._MOVEMENT_JOIN + " WHERE 1=1"
        params: dict = {}
        if product_id:
            sql_str += " AND im.product_id = CAST(:product_id AS UUID)"
            params["product_id"] = str(product_id)
        if movement_type:
            sql_str += " AND im.movement_type ILIKE :movement_type"
            params["movement_type"] = f"%{movement_type}%"
        if search:
            sql_str += (
                " AND (p.sku ILIKE :search OR p.name ILIKE :search"
                " OR im.observations ILIKE :search)"
            )
            params["search"] = f"%{search}%"
        if date_from:
            sql_str += " AND im.moved_on >= CAST(:date_from AS TIMESTAMPTZ)"
            params["date_from"] = date_from
        if date_to:
            sql_str += " AND im.moved_on <= CAST(:date_to AS TIMESTAMPTZ)"
            params["date_to"] = date_to
        sql_str += (
            " ORDER BY COALESCE(im.moved_on, im.created_at) DESC"
            " LIMIT :limit OFFSET :offset"
        )
        params["limit"] = limit
        params["offset"] = offset
        rows = (await self.db.execute(text(sql_str), params)).mappings().all()
        return [InventoryMovementRead.model_validate(dict(r)) for r in rows]

    async def create_adjustment(
        self,
        data: AdjustmentCreate,
        user_id: UUID,
    ) -> InventoryMovementRead:
        moved = (
            datetime.combine(data.moved_on, datetime.min.time()).replace(tzinfo=timezone.utc)
            if data.moved_on
            else datetime.now(timezone.utc)
        )
        movement = InventoryMovement(
            product_id=data.product_id,
            movement_type="Ajuste",
            qty_in=data.quantity if data.direction == "in" else None,
            qty_out=data.quantity if data.direction == "out" else None,
            unit_cost=data.unit_cost,
            moved_on=moved,
            observations=data.observations,
            created_by_user_id=user_id,
        )
        self.db.add(movement)
        await self.db.commit()
        rows = (await self.db.execute(
            text(self._MOVEMENT_JOIN + " WHERE im.id = CAST(:id AS UUID)"),
            {"id": str(movement.id)},
        )).mappings().all()
        return InventoryMovementRead.model_validate(dict(rows[0]))

    # ── Inventario actual (vistas nuevas) ────────────────────────────────────

    async def get_inventory_current(
        self,
        is_saleable: bool | None = None,
        stock_status: str | None = None,
        search: str | None = None,
        category: str | None = None,
        sort_by: str = "total_value",
        sort_order: str = "desc",
        limit: int = 200,
        offset: int = 0,
    ) -> list[InventoryCurrentRead]:
        allowed_sort = {"sku", "name", "category", "quantity_on_hand", "avg_unit_cost", "total_value", "stock_status"}
        order_col = sort_by if sort_by in allowed_sort else "total_value"
        order_dir = "DESC" if sort_order.lower() == "desc" else "ASC"

        filters = []
        params: dict = {"limit": limit, "offset": offset}
        if is_saleable is not None:
            filters.append("is_saleable = :is_saleable")
            params["is_saleable"] = is_saleable
        if stock_status:
            filters.append("stock_status = :stock_status")
            params["stock_status"] = stock_status
        if search:
            filters.append("(sku ILIKE :search OR name ILIKE :search)")
            params["search"] = f"%{search}%"
        if category:
            filters.append("category ILIKE :category")
            params["category"] = f"%{category}%"
        where = ("WHERE " + " AND ".join(filters)) if filters else ""
        sql = text(f"""
            SELECT
                vc.product_id, vc.sku, vc.name, vc.is_saleable, vc.category,
                vc.quantity_on_hand, vc.avg_unit_cost, vc.total_value,
                vc.min_stock, vc.stock_status,
                i.theoretical_qty,
                CASE WHEN i.theoretical_qty IS NOT NULL
                     THEN i.theoretical_qty * vc.avg_unit_cost
                     ELSE NULL END AS theoretical_value
            FROM v_inventory_current vc
            LEFT JOIN inventario i ON i.product_id = vc.product_id
            {where}
            ORDER BY {order_col} {order_dir}
            LIMIT :limit OFFSET :offset
        """)
        rows = (await self.db.execute(sql, params)).mappings().all()
        return [InventoryCurrentRead(**r) for r in rows]

    async def get_inventory_kpi_summary(self) -> InventoryKpiSummaryRead:
        sql = text("""
            SELECT
                COUNT(*)                                                AS total_productos,
                COALESCE(SUM(total_value), 0)                           AS valor_total_real,
                COALESCE(SUM(total_value) FILTER (WHERE is_saleable),   0) AS valor_total_vendible,
                COALESCE(SUM(total_value) FILTER (WHERE NOT is_saleable),0) AS valor_total_interno,
                COUNT(*) FILTER (WHERE stock_status = 'OUT')            AS productos_out_of_stock,
                COUNT(*) FILTER (WHERE stock_status = 'BELOW_MIN')      AS productos_below_min,
                COUNT(*) FILTER (WHERE is_saleable AND stock_status = 'OUT')  AS productos_out_of_stock_vendible,
                COUNT(*) FILTER (WHERE is_saleable AND stock_status = 'BELOW_MIN') AS productos_below_min_vendible,
                COUNT(*) FILTER (WHERE NOT is_saleable AND stock_status = 'OUT')  AS productos_out_of_stock_interno,
                COUNT(*) FILTER (WHERE NOT is_saleable AND stock_status = 'BELOW_MIN') AS productos_below_min_interno,
                COUNT(*) FILTER (WHERE is_saleable)                     AS total_vendible,
                COUNT(*) FILTER (WHERE NOT is_saleable)                 AS total_interno,
                COUNT(*) FILTER (WHERE is_saleable AND quantity_on_hand > 0)  AS con_stock_vendible,
                COUNT(*) FILTER (WHERE is_saleable AND quantity_on_hand = 0)  AS sin_stock_vendible,
                COUNT(*) FILTER (WHERE is_saleable AND quantity_on_hand < 0)  AS stock_negativo_vendible,
                COUNT(*) FILTER (WHERE NOT is_saleable AND quantity_on_hand > 0) AS con_stock_interno,
                COUNT(*) FILTER (WHERE NOT is_saleable AND quantity_on_hand = 0) AS sin_stock_interno,
                COUNT(*) FILTER (WHERE NOT is_saleable AND quantity_on_hand < 0) AS stock_negativo_interno
            FROM v_inventory_current
        """)
        row = (await self.db.execute(sql)).mappings().one()

        asset_sql = text("""
            SELECT
                COUNT(*)                                        AS total_assets,
                COUNT(*) FILTER (WHERE status = 'IN_REPAIR')   AS assets_en_reparacion
            FROM assets
        """)
        asset_row = (await self.db.execute(asset_sql)).mappings().one()

        return InventoryKpiSummaryRead(
            total_productos=row["total_productos"],
            valor_total_real=float(row["valor_total_real"]),
            valor_total_vendible=float(row["valor_total_vendible"]),
            valor_total_interno=float(row["valor_total_interno"]),
            productos_out_of_stock=row["productos_out_of_stock"],
            productos_below_min=row["productos_below_min"],
            productos_out_of_stock_vendible=row["productos_out_of_stock_vendible"],
            productos_below_min_vendible=row["productos_below_min_vendible"],
            productos_out_of_stock_interno=row["productos_out_of_stock_interno"],
            productos_below_min_interno=row["productos_below_min_interno"],
            total_assets=asset_row["total_assets"],
            assets_en_reparacion=asset_row["assets_en_reparacion"],
            total_vendible=row["total_vendible"],
            total_interno=row["total_interno"],
            con_stock_vendible=row["con_stock_vendible"],
            sin_stock_vendible=row["sin_stock_vendible"],
            stock_negativo_vendible=row["stock_negativo_vendible"],
            con_stock_interno=row["con_stock_interno"],
            sin_stock_interno=row["sin_stock_interno"],
            stock_negativo_interno=row["stock_negativo_interno"],
        )

    # ── Depreciación ─────────────────────────────────────────────────────────

    async def get_depreciation(self, asset_id: UUID) -> DepreciationScheduleRead:
        asset = await self.db.get(Asset, asset_id)
        config_row = (
            await self.db.execute(
                select(AssetDepreciationConfig).where(AssetDepreciationConfig.asset_id == asset_id)
            )
        ).scalar_one_or_none()

        if config_row is None or asset is None or asset.purchase_cost is None:
            return DepreciationScheduleRead(
                config=DepreciationConfigRead.model_validate(config_row) if config_row else None,
                asset_cost=float(asset.purchase_cost) if asset and asset.purchase_cost else None,
                current_book_value=None,
                accumulated_depreciation=None,
                percent_depreciated=None,
                periods=[],
            )

        cost = float(asset.purchase_cost)
        residual = float(config_row.residual_value)
        life = config_row.useful_life_years
        start = config_row.start_date
        annual = (cost - residual) / life
        today = date.today()

        periods: list[DepreciationPeriodRead] = []
        for year in range(1, life + 1):
            p_start = _add_years(start, year - 1)
            p_end = _add_years(start, year) - timedelta(days=1)
            accumulated = annual * year
            book_value = max(residual, cost - accumulated)
            is_current = p_start <= today <= p_end
            periods.append(
                DepreciationPeriodRead(
                    year=year,
                    period_start=p_start,
                    period_end=p_end,
                    annual_depreciation=round(annual, 4),
                    accumulated_depreciation=round(accumulated, 4),
                    book_value=round(book_value, 4),
                    is_current=is_current,
                )
            )

        current = next((p for p in periods if p.is_current), periods[-1] if periods else None)
        accum = current.accumulated_depreciation if current else 0.0
        book = current.book_value if current else cost
        pct = round((accum / (cost - residual)) * 100, 2) if (cost - residual) > 0 else 0.0

        return DepreciationScheduleRead(
            config=DepreciationConfigRead.model_validate(config_row),
            asset_cost=cost,
            current_book_value=book,
            accumulated_depreciation=accum,
            percent_depreciated=pct,
            periods=periods,
        )

    async def upsert_depreciation_config(
        self,
        asset_id: UUID,
        data: DepreciationConfigCreate,
        user_id: UUID,
    ) -> DepreciationScheduleRead:
        existing = (
            await self.db.execute(
                select(AssetDepreciationConfig).where(AssetDepreciationConfig.asset_id == asset_id)
            )
        ).scalar_one_or_none()

        if existing:
            existing.method = data.method
            existing.useful_life_years = data.useful_life_years
            existing.residual_value = data.residual_value
            existing.start_date = data.start_date
            existing.updated_at = datetime.now(timezone.utc)
        else:
            config = AssetDepreciationConfig(
                asset_id=asset_id,
                method=data.method,
                useful_life_years=data.useful_life_years,
                residual_value=data.residual_value,
                start_date=data.start_date,
            )
            self.db.add(config)

        await self.db.commit()
        return await self.get_depreciation(asset_id)
