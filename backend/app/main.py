from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, settings as default_settings
from .routers.api import router
from .state import AppState


def create_app(settings: Settings | None = None, *, persist_vectors: bool = True) -> FastAPI:
    cfg = settings or default_settings

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.gov = AppState.create(cfg, persist_vectors=persist_vectors)
        yield

    app = FastAPI(title="GovResolve-AI backend", version=cfg.version, lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["*"], allow_headers=["*"])
    app.include_router(router)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse({"error": exc.detail, "reason": exc.detail}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse({"error": "validation_error", "reason": "Invalid request",
                             "details": jsonable(exc.errors())}, status_code=422)

    return app


def jsonable(errors: list[dict]) -> list[dict]:
    return [{"loc": list(e.get("loc", [])), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in errors]


app = create_app()
