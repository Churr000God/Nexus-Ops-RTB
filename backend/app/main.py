import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.middleware.auth_middleware import auth_context_middleware
from app.middleware.cors import configure_cors
from app.middleware.logging import configure_logging, configure_middlewares
from app.routers.auth import router as auth_router
from app.routers.dashboard import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.inventario import router as inventario_router
from app.routers.reportes import router as reportes_router
from app.routers.sync import router as sync_router
from app.routers.usuarios import router as usuarios_router
from app.routers.ventas import router as ventas_router

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
app.include_router(sync_router)
app.include_router(ventas_router)
app.include_router(inventario_router)
app.include_router(dashboard_router)
app.include_router(reportes_router)
