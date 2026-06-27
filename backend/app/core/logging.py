import logging
import time

from fastapi import Request
from pythonjsonlogger import jsonlogger


def configure_logging() -> None:
    """Logging JSON estruturado: cada linha é um objeto JSON independente,
    parseável por CloudWatch / Datadog / Loki sem regex — substitui
    logging.basicConfig com formato de texto puro."""
    handler = logging.StreamHandler()
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level"},
        )
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]


async def log_requests_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logging.getLogger("app.request").info(
        "http_request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 1),
        },
    )
    return response
