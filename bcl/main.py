import time
import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from bcl.routers import fleet, queues, channels, migration, validation, audit, topology
from bcl.observability.logging import configure_logging
from bcl.observability.metrics import REQUEST_LATENCY, REQUEST_COUNT
from bcl.mq.registry import bootstrap_registry

configure_logging()
log = structlog.get_logger()

app = FastAPI(
    title="BCL Gateway",
    description="Business Control Layer for IBM MQ Topology Migration",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.on_event("startup")
async def startup():
    import asyncio
    bootstrap_registry()
    await _recover_in_progress_migrations()
    from bcl.mq.monitor import monitor_loop
    asyncio.create_task(monitor_loop())
    log.info("bcl_gateway_started", version="2.0.0")


async def _recover_in_progress_migrations():
    """On startup, roll back any migrations stuck in transitional states from a prior crash."""
    import asyncio
    from bcl.state.redis_store import RedisStore
    from bcl.state.state_machine import MigrationStateMachine
    from bcl.models.migration import MigrationState, IN_PROGRESS_STATES

    store = RedisStore()
    sm = MigrationStateMachine(store)

    try:
        records = await store.list_migration_records()
    except Exception as exc:
        log.warning("crash_recovery_skipped", error=str(exc))
        return

    for record in records:
        if record.state in IN_PROGRESS_STATES:
            log.warning(
                "crash_recovery_rolling_back",
                app_id=record.app_id,
                stuck_state=record.state,
            )
            try:
                await sm.transition(
                    record.app_id,
                    MigrationState.ROLLING_BACK,
                    {"error": "BCL restarted during migration — auto-rollback"},
                )
                await sm.transition(record.app_id, MigrationState.ROLLED_BACK)
            except Exception as exc:
                log.error("crash_recovery_failed", app_id=record.app_id, error=str(exc))


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    log.info(
        "request",
        trace_id=trace_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    REQUEST_LATENCY.labels(request.url.path).observe(duration_ms / 1000)
    REQUEST_COUNT.labels(request.url.path, str(response.status_code)).inc()
    return response


app.include_router(topology.router, prefix="/api")
app.include_router(fleet.router, prefix="/api")
app.include_router(queues.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(migration.router, prefix="/api")
app.include_router(validation.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/healthz/live")
async def liveness():
    return {"status": "alive"}


@app.get("/healthz/ready")
async def readiness():
    from bcl.mq.registry import get_registry
    from bcl.state.redis_store import RedisStore
    from fastapi import HTTPException

    registry = get_registry()
    reachable = await registry.check_any_qm_reachable()

    store = RedisStore()
    redis_ok = await store.health_check()

    if not reachable:
        raise HTTPException(status_code=503, detail="No MQ QMs reachable")

    return {
        "status": "ready",
        "qm_count": len(registry.list_qms()),
        "redis": "ok" if redis_ok else "degraded",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=2,
        loop="uvloop",
        http="httptools",
        access_log=False,
    )
