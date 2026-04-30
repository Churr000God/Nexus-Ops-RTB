from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clientes_proveedores_models import (
    CustomerAddress,
    CustomerContact,
    CustomerMaster,
    CustomerTaxData,
    SupplierAddress,
    SupplierContact,
    SupplierMaster,
    SupplierProductListing,
    SupplierTaxData,
)
from app.schemas.clientes_proveedores_schema import (
    CustomerAddressCreate,
    CustomerAddressRead,
    CustomerContactCreate,
    CustomerContactRead,
    CustomerCreate,
    CustomerDetail,
    CustomerListResponse,
    CustomerRead,
    CustomerTaxDataCreate,
    CustomerTaxDataRead,
    CustomerUpdate,
    SupplierAddressCreate,
    SupplierAddressRead,
    SupplierContactCreate,
    SupplierContactRead,
    SupplierCreate,
    SupplierDetail,
    SupplierListResponse,
    SupplierProductCreate,
    SupplierProductPriceUpdate,
    SupplierProductRead,
    SupplierRead,
    SupplierTaxDataCreate,
    SupplierTaxDataRead,
    SupplierUpdate,
)


class ClientesProveedoresService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # =========================================================================
    # CLIENTES
    # =========================================================================

    async def list_customers(
        self,
        limit: int = 50,
        offset: int = 0,
        search: str | None = None,
        solo_activos: bool = True,
    ) -> CustomerListResponse:
        stmt = select(CustomerMaster)
        count_stmt = select(func.count()).select_from(CustomerMaster)

        if solo_activos:
            stmt = stmt.where(CustomerMaster.is_active.is_(True))
            count_stmt = count_stmt.where(CustomerMaster.is_active.is_(True))

        if search:
            pattern = f"%{search}%"
            condition = or_(
                CustomerMaster.code.ilike(pattern),
                CustomerMaster.business_name.ilike(pattern),
            )
            stmt = stmt.where(condition)
            count_stmt = count_stmt.where(condition)

        total = (await self.db.execute(count_stmt)).scalar_one()
        rows = (
            await self.db.execute(
                stmt.order_by(CustomerMaster.business_name).limit(limit).offset(offset)
            )
        ).scalars().all()

        return CustomerListResponse(
            total=total,
            items=[CustomerRead.model_validate(r) for r in rows],
        )

    async def get_customer_detail(self, customer_id: int) -> CustomerDetail | None:
        stmt = (
            select(CustomerMaster)
            .where(CustomerMaster.customer_id == customer_id)
            .options(
                selectinload(CustomerMaster.tax_data),
                selectinload(CustomerMaster.addresses),
                selectinload(CustomerMaster.contacts),
            )
        )
        customer = (await self.db.execute(stmt)).scalar_one_or_none()
        if customer is None:
            return None

        return CustomerDetail(
            customer_id=customer.customer_id,
            code=customer.code,
            business_name=customer.business_name,
            customer_type=customer.customer_type,
            locality=customer.locality,
            payment_terms_days=customer.payment_terms_days,
            credit_limit=customer.credit_limit,
            currency=customer.currency,
            is_active=customer.is_active,
            notes=customer.notes,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
            tax_data=[CustomerTaxDataRead.model_validate(t) for t in customer.tax_data],
            addresses=[CustomerAddressRead.model_validate(a) for a in customer.addresses],
            contacts=[CustomerContactRead.model_validate(c) for c in customer.contacts],
        )

    async def create_customer(self, data: CustomerCreate) -> CustomerRead:
        customer = CustomerMaster(
            code=data.code.upper(),
            business_name=data.business_name,
            customer_type=data.customer_type,
            locality=data.locality,
            payment_terms_days=data.payment_terms_days,
            credit_limit=data.credit_limit,
            currency=data.currency.upper(),
            notes=data.notes,
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return CustomerRead.model_validate(customer)

    async def update_customer(
        self, customer_id: int, data: CustomerUpdate
    ) -> CustomerRead | None:
        customer = (
            await self.db.execute(
                select(CustomerMaster).where(CustomerMaster.customer_id == customer_id)
            )
        ).scalar_one_or_none()
        if customer is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)

        await self.db.commit()
        await self.db.refresh(customer)
        return CustomerRead.model_validate(customer)

    async def add_customer_tax_data(
        self, customer_id: int, data: CustomerTaxDataCreate
    ) -> CustomerTaxDataRead:
        td = CustomerTaxData(
            customer_id=customer_id,
            rfc=data.rfc.upper(),
            legal_name=data.legal_name,
            tax_regime_id=data.tax_regime_id,
            cfdi_use_id=data.cfdi_use_id,
            zip_code=data.zip_code,
            is_default=data.is_default,
        )
        self.db.add(td)
        await self.db.commit()
        await self.db.refresh(td)
        return CustomerTaxDataRead.model_validate(td)

    async def update_customer_tax_data(
        self, customer_id: int, tax_data_id: int, data: CustomerTaxDataCreate
    ) -> CustomerTaxDataRead | None:
        td = (
            await self.db.execute(
                select(CustomerTaxData).where(
                    CustomerTaxData.tax_data_id == tax_data_id,
                    CustomerTaxData.customer_id == customer_id,
                )
            )
        ).scalar_one_or_none()
        if td is None:
            return None

        td.rfc = data.rfc.upper()
        td.legal_name = data.legal_name
        td.tax_regime_id = data.tax_regime_id
        td.cfdi_use_id = data.cfdi_use_id
        td.zip_code = data.zip_code
        td.is_default = data.is_default

        await self.db.commit()
        await self.db.refresh(td)
        return CustomerTaxDataRead.model_validate(td)

    async def add_customer_address(
        self, customer_id: int, data: CustomerAddressCreate
    ) -> CustomerAddressRead:
        addr = CustomerAddress(
            customer_id=customer_id,
            address_type=data.address_type,
            tax_data_id=data.tax_data_id,
            label=data.label,
            street=data.street,
            exterior_number=data.exterior_number,
            interior_number=data.interior_number,
            neighborhood=data.neighborhood,
            city=data.city,
            state=data.state,
            country=data.country,
            zip_code=data.zip_code,
            is_default=data.is_default,
        )
        self.db.add(addr)
        await self.db.commit()
        await self.db.refresh(addr)
        return CustomerAddressRead.model_validate(addr)

    async def delete_customer_address(self, customer_id: int, address_id: int) -> bool:
        addr = (
            await self.db.execute(
                select(CustomerAddress).where(
                    CustomerAddress.address_id == address_id,
                    CustomerAddress.customer_id == customer_id,
                )
            )
        ).scalar_one_or_none()
        if addr is None:
            return False
        await self.db.delete(addr)
        await self.db.commit()
        return True

    async def add_customer_contact(
        self, customer_id: int, data: CustomerContactCreate
    ) -> CustomerContactRead:
        contact = CustomerContact(
            customer_id=customer_id,
            full_name=data.full_name,
            role_title=data.role_title,
            email=data.email,
            phone=data.phone,
            is_primary=data.is_primary,
        )
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return CustomerContactRead.model_validate(contact)

    async def delete_customer_contact(
        self, customer_id: int, contact_id: int
    ) -> bool:
        contact = (
            await self.db.execute(
                select(CustomerContact).where(
                    CustomerContact.contact_id == contact_id,
                    CustomerContact.customer_id == customer_id,
                )
            )
        ).scalar_one_or_none()
        if contact is None:
            return False
        await self.db.delete(contact)
        await self.db.commit()
        return True

    # =========================================================================
    # PROVEEDORES
    # =========================================================================

    async def list_suppliers(
        self,
        limit: int = 50,
        offset: int = 0,
        search: str | None = None,
        solo_activos: bool = True,
        supplier_type: str | None = None,
        locality: str | None = None,
        is_occasional: bool | None = None,
    ) -> SupplierListResponse:
        stmt = select(SupplierMaster)
        count_stmt = select(func.count()).select_from(SupplierMaster)

        filters = []
        if solo_activos:
            filters.append(SupplierMaster.is_active.is_(True))
        if supplier_type:
            filters.append(SupplierMaster.supplier_type == supplier_type)
        if locality:
            filters.append(SupplierMaster.locality == locality)
        if is_occasional is not None:
            filters.append(SupplierMaster.is_occasional.is_(is_occasional))
        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(
                    SupplierMaster.code.ilike(pattern),
                    SupplierMaster.business_name.ilike(pattern),
                )
            )

        for f in filters:
            stmt = stmt.where(f)
            count_stmt = count_stmt.where(f)

        total = (await self.db.execute(count_stmt)).scalar_one()
        rows = (
            await self.db.execute(
                stmt.order_by(SupplierMaster.business_name).limit(limit).offset(offset)
            )
        ).scalars().all()

        return SupplierListResponse(
            total=total,
            items=[SupplierRead.model_validate(r) for r in rows],
        )

    async def get_supplier_detail(self, supplier_id: int) -> SupplierDetail | None:
        stmt = (
            select(SupplierMaster)
            .where(SupplierMaster.supplier_id == supplier_id)
            .options(
                selectinload(SupplierMaster.tax_data),
                selectinload(SupplierMaster.addresses),
                selectinload(SupplierMaster.contacts),
                selectinload(SupplierMaster.product_listings),
            )
        )
        supplier = (await self.db.execute(stmt)).scalar_one_or_none()
        if supplier is None:
            return None

        current_products = [
            SupplierProductRead.model_validate(p)
            for p in supplier.product_listings
            if p.is_current
        ]

        return SupplierDetail(
            supplier_id=supplier.supplier_id,
            code=supplier.code,
            business_name=supplier.business_name,
            supplier_type=supplier.supplier_type,
            locality=supplier.locality,
            is_occasional=supplier.is_occasional,
            payment_terms_days=supplier.payment_terms_days,
            avg_payment_time_days=supplier.avg_payment_time_days,
            currency=supplier.currency,
            is_active=supplier.is_active,
            notes=supplier.notes,
            created_at=supplier.created_at,
            updated_at=supplier.updated_at,
            tax_data=[SupplierTaxDataRead.model_validate(t) for t in supplier.tax_data],
            addresses=[SupplierAddressRead.model_validate(a) for a in supplier.addresses],
            contacts=[SupplierContactRead.model_validate(c) for c in supplier.contacts],
            current_products=current_products,
        )

    async def create_supplier(self, data: SupplierCreate) -> SupplierRead:
        supplier = SupplierMaster(
            code=data.code.upper(),
            business_name=data.business_name,
            supplier_type=data.supplier_type,
            locality=data.locality,
            is_occasional=data.is_occasional,
            payment_terms_days=data.payment_terms_days,
            avg_payment_time_days=data.avg_payment_time_days,
            currency=data.currency.upper(),
            notes=data.notes,
        )
        self.db.add(supplier)
        await self.db.commit()
        await self.db.refresh(supplier)
        return SupplierRead.model_validate(supplier)

    async def update_supplier(
        self, supplier_id: int, data: SupplierUpdate
    ) -> SupplierRead | None:
        supplier = (
            await self.db.execute(
                select(SupplierMaster).where(SupplierMaster.supplier_id == supplier_id)
            )
        ).scalar_one_or_none()
        if supplier is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(supplier, field, value)

        await self.db.commit()
        await self.db.refresh(supplier)
        return SupplierRead.model_validate(supplier)

    async def add_supplier_tax_data(
        self, supplier_id: int, data: SupplierTaxDataCreate
    ) -> SupplierTaxDataRead:
        td = SupplierTaxData(
            supplier_id=supplier_id,
            rfc=data.rfc.upper(),
            legal_name=data.legal_name,
            tax_regime_id=data.tax_regime_id,
            zip_code=data.zip_code,
            is_default=data.is_default,
        )
        self.db.add(td)
        await self.db.commit()
        await self.db.refresh(td)
        return SupplierTaxDataRead.model_validate(td)

    async def add_supplier_address(
        self, supplier_id: int, data: SupplierAddressCreate
    ) -> SupplierAddressRead:
        addr = SupplierAddress(
            supplier_id=supplier_id,
            address_type=data.address_type,
            tax_data_id=data.tax_data_id,
            label=data.label,
            street=data.street,
            exterior_number=data.exterior_number,
            interior_number=data.interior_number,
            neighborhood=data.neighborhood,
            city=data.city,
            state=data.state,
            country=data.country,
            zip_code=data.zip_code,
            is_default=data.is_default,
        )
        self.db.add(addr)
        await self.db.commit()
        await self.db.refresh(addr)
        return SupplierAddressRead.model_validate(addr)

    async def delete_supplier_address(self, supplier_id: int, address_id: int) -> bool:
        addr = (
            await self.db.execute(
                select(SupplierAddress).where(
                    SupplierAddress.address_id == address_id,
                    SupplierAddress.supplier_id == supplier_id,
                )
            )
        ).scalar_one_or_none()
        if addr is None:
            return False
        await self.db.delete(addr)
        await self.db.commit()
        return True

    async def add_supplier_contact(
        self, supplier_id: int, data: SupplierContactCreate
    ) -> SupplierContactRead:
        contact = SupplierContact(
            supplier_id=supplier_id,
            full_name=data.full_name,
            role_title=data.role_title,
            email=data.email,
            phone=data.phone,
            is_primary=data.is_primary,
        )
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return SupplierContactRead.model_validate(contact)

    async def delete_supplier_contact(
        self, supplier_id: int, contact_id: int
    ) -> bool:
        contact = (
            await self.db.execute(
                select(SupplierContact).where(
                    SupplierContact.contact_id == contact_id,
                    SupplierContact.supplier_id == supplier_id,
                )
            )
        ).scalar_one_or_none()
        if contact is None:
            return False
        await self.db.delete(contact)
        await self.db.commit()
        return True

    async def update_supplier_tax_data(
        self, supplier_id: int, tax_data_id: int, data: SupplierTaxDataCreate
    ) -> SupplierTaxDataRead | None:
        td = (
            await self.db.execute(
                select(SupplierTaxData).where(
                    SupplierTaxData.tax_data_id == tax_data_id,
                    SupplierTaxData.supplier_id == supplier_id,
                )
            )
        ).scalar_one_or_none()
        if td is None:
            return None
        td.rfc = data.rfc.upper()
        td.legal_name = data.legal_name
        td.tax_regime_id = data.tax_regime_id
        td.zip_code = data.zip_code
        td.is_default = data.is_default
        await self.db.commit()
        await self.db.refresh(td)
        return SupplierTaxDataRead.model_validate(td)

    async def add_supplier_product(
        self, supplier_id: int, data: SupplierProductCreate
    ) -> SupplierProductRead:
        listing = SupplierProductListing(
            supplier_id=supplier_id,
            product_id=data.product_id,
            supplier_sku=data.supplier_sku,
            unit_cost=data.unit_cost,
            currency=data.currency.upper(),
            lead_time_days=data.lead_time_days,
            moq=data.moq,
            is_available=data.is_available,
            is_preferred=data.is_preferred,
            valid_from=data.valid_from or date.today(),
        )
        self.db.add(listing)
        await self.db.commit()
        await self.db.refresh(listing)
        return SupplierProductRead.model_validate(listing)

    async def update_supplier_product_price(
        self,
        supplier_id: int,
        supplier_product_id: int,
        data: SupplierProductPriceUpdate,
    ) -> SupplierProductRead | None:
        """Cierra el precio vigente y abre un nuevo registro (histórico inmutable)."""
        current = (
            await self.db.execute(
                select(SupplierProductListing).where(
                    SupplierProductListing.supplier_product_id == supplier_product_id,
                    SupplierProductListing.supplier_id == supplier_id,
                    SupplierProductListing.is_current.is_(True),
                )
            )
        ).scalar_one_or_none()
        if current is None:
            return None

        # 1. Cerrar registro vigente
        current.valid_to = date.today() - timedelta(days=1)
        current.is_current = False

        # 2. Crear nuevo registro con precio actualizado
        new_listing = SupplierProductListing(
            supplier_id=current.supplier_id,
            product_id=current.product_id,
            supplier_sku=data.supplier_sku if data.supplier_sku is not None else current.supplier_sku,
            unit_cost=data.unit_cost,
            currency=(data.currency or current.currency).upper(),
            lead_time_days=data.lead_time_days if data.lead_time_days is not None else current.lead_time_days,
            moq=data.moq if data.moq is not None else current.moq,
            is_available=current.is_available,
            is_preferred=data.is_preferred if data.is_preferred is not None else current.is_preferred,
            valid_from=date.today(),
            is_current=True,
        )
        self.db.add(new_listing)
        await self.db.commit()
        await self.db.refresh(new_listing)
        return SupplierProductRead.model_validate(new_listing)
