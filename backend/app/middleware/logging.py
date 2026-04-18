import sys
import time
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from loguru import logger
from starlette.responses import Response

from app.config import settings


def configure_logging() -> None:
    logger.remove()
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        enqueue=True,
    )


async def request_logging_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "{} {} -> {} ({:.2f} ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


def configure_middlewares(app: FastAPI) -> None:
    app.middleware("http")(request_logging_middleware)
