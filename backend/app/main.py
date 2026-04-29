import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.middleware.auth_middleware import auth_context_middleware
from app.middleware.cors import configure_cors
from app.middleware.logging import configure_logging, configure_middlewares
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.clientes_proveedores import (
    clientes_router,
    proveedores_router,
    sat_cp_router,
)
from app.routers.dashboard import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.inventario import router as inventario_router
from app.routers.productos import (
    brand_router,
    cat_router,
    router as productos_router,
    sat_router,
)
from app.routers.reportes import router as reportes_router
from app.routers.sync import router as sync_router
from app.routers.usuarios import router as usuarios_router
from app.routers.ventas import router as ventas_router
from app.routers.compras import gastos_router, router as compras_router
from app.routers.ventas_logistica import router as ventas_logistica_router
from app.routers.assets import (
    inventory_router as assets_inventory_router,
    router as assets_router,
    snapshot_router,
)
from app.routers.cfdi import router as cfdi_router
from app.routers.analytics import router as analytics_router

logger = logging.getLogger(__name__)

app = FastAPI(title="Nexus Ops RTB API")
configure_logging()
configure_middlewares(app)
app.middleware("http")(auth_context_middleware)
configure_cors(app)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
    )


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(admin_router)
app.include_router(sync_router)
app.include_router(ventas_router)
app.include_router(inventario_router)
app.include_router(dashboard_router)
app.include_router(reportes_router)
app.include_router(productos_router)
app.include_router(cat_router)
app.include_router(brand_router)
app.include_router(sat_router)
app.include_router(clientes_router)
app.include_router(proveedores_router)
app.include_router(sat_cp_router)
app.include_router(ventas_logistica_router)
app.include_router(compras_router)
app.include_router(gastos_router)
app.include_router(assets_router)
app.include_router(snapshot_router)
app.include_router(assets_inventory_router)
app.include_router(cfdi_router)
app.include_router(analytics_router)
