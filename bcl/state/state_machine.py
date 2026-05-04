import structlog
from datetime import datetime, timezone
from fastapi import HTTPException

from bcl.models.migration import MigrationRecord, MigrationState, TRANSITIONS
from bcl.state.redis_store import RedisStore

log = structlog.get_logger()


class MigrationStateMachine:
    def __init__(self, redis_store: RedisStore):
        self.store = redis_store

    async def get(self, app_id: str) -> MigrationRecord:
        record = await self.store.get_migration_record(app_id)
        if record is None:
            record = MigrationRecord(app_id=app_id)
            await self.store.save_migration_record(record)
        return record

    async def transition(
        self,
        app_id: str,
        new_state: MigrationState,
        metadata: dict = None,
    ) -> MigrationRecord:
        record = await self.get(app_id)
        allowed = TRANSITIONS.get(record.state, [])

        if new_state not in allowed:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "INVALID_TRANSITION",
                    "current_state": record.state,
                    "requested_state": new_state,
                    "allowed_transitions": [s.value for s in allowed],
                },
            )

        now = datetime.now(timezone.utc).isoformat()
        record.history.append(
            {
                "from_state": record.state,
                "to_state": new_state,
                "timestamp": now,
                "metadata": metadata or {},
            }
        )

        log.info(
            "state_transition",
            app_id=app_id,
            from_state=record.state,
            to_state=new_state,
        )

        record.state = new_state
        record.updated_at = now
        if new_state == MigrationState.SNAPSHOTTED:
            record.started_at = now

        if metadata:
            if "error" in metadata:
                record.error = metadata["error"]
            if "validation_result" in metadata:
                record.validation_results.append(metadata["validation_result"])
            if "snapshot_key" in metadata:
                record.snapshot_key = metadata["snapshot_key"]
            if "source_qm" in metadata:
                record.source_qm = metadata["source_qm"]
            if "target_qm" in metadata:
                record.target_qm = metadata["target_qm"]
            if "active_agent" in metadata:
                record.active_agent = metadata["active_agent"]

        from dataclasses import asdict
        await self.store.save_migration_record(record)
        await self.store.publish_sse_event(asdict(record))
        return record
    async def update_metadata(self, app_id: str, metadata: dict) -> MigrationRecord:
        record = await self.get(app_id)
        if "active_agent" in metadata:
            record.active_agent = metadata["active_agent"]
        if "error" in metadata:
            record.error = metadata["error"]
        
        from dataclasses import asdict
        await self.store.save_migration_record(record)
        await self.store.publish_sse_event(asdict(record))
        return record
