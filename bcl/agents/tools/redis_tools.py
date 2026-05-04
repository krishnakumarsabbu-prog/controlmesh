from bcl.state.redis_store import RedisStore


async def save_snapshot(app_id: str, step: str, topology: dict) -> str:
    """Persist a topology snapshot and return its Redis key."""
    store = RedisStore()
    return await store.save_snapshot(app_id, step, topology)


async def load_snapshot(app_id: str) -> dict:
    """Load the most recent topology snapshot for an application."""
    store = RedisStore()
    return await store.load_latest_snapshot(app_id)
