from fastapi import FastAPI

from app.middleware.auth_middleware import auth_context_middleware
from app.middleware.cors import configure_cors
from app.middleware.logging import configure_logging, configure_middlewares
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router

app = FastAPI(title="Nexus Ops RTB API")
configure_logging()
configure_cors(app)
configure_middlewares(app)
app.middleware("http")(auth_context_middleware)
app.include_router(health_router)
app.include_router(auth_router)
