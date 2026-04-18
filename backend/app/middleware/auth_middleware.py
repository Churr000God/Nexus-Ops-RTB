from collections.abc import Awaitable, Callable

from fastapi import Request
from starlette.responses import Response

from app.dependencies import decode_bearer_token_from_header


async def auth_context_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request.state.token_payload = decode_bearer_token_from_header(
        request.headers.get("Authorization")
    )
    return await call_next(request)
