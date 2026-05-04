# Phase 7: Migration Agent Implementation

**Duration:** 2–3 days
**Objective:** Build the Migration Agent — the specialist responsible for topology diffing, transparent rewiring via transmission queues and remote queue definitions, and consumer cutover.

---

## Context and Rationale

The Migration Agent is the most technically complex specialist. Its primary innovation is **transparent rewiring**: a producer that PUTs to `Q.APP1.REQUEST.LOCAL` on `QM.SRC.A` continues to work without any connection string change, even after the queue moves to `QM.APP1`. This is achieved through:

1. **Transmission queue (XMIT)** on `QM.SRC.A` — buffers messages destined for `QM.APP1`
2. **Sender channel** — carries messages from `QM.SRC.A` xmit queue to `QM.APP1`
3. **Remote queue definition** — shadows `Q.APP1.REQUEST.LOCAL` on `QM.SRC.A`, routing PUTs to the target via the xmit queue

The producer sees the same queue name. The BCL handles the routing silently.

---

## Transparent Rewiring Mechanics

```
Before migration:
Producer → PUT Q.APP1.REQUEST.LOCAL → QM.SRC.A (local queue) → Consumer

After rewiring (transparent):
Producer → PUT Q.APP1.REQUEST.LOCAL → QM.SRC.A (REMOTE def)
    └→ Q.SRCA.APP1.XMIT.XMIT (xmit queue)
    └→ CHL.SRCA.APP1 (SDR channel)
    └→ QM.APP1
    └→ Q.APP1.REQUEST.LOCAL (local queue on target)
    └→ Consumer (reconnected to QM.APP1)

Note: Producer connection string unchanged.
```

---

## Migration Agent

### 7.1 Agent Definition

```python
# agents/migration_agent.py
from google.adk.agents import Agent
from .base import GEMINI_MODEL
from .tools.mq_tools import (
    diff_topology,
    create_xmit_queue,
    create_remote_def,
    create_sender_channel,
    create_receiver_channel,
    start_channel,
    move_consumer,
    delete_local_queue,
    delete_xmit_queue,
    delete_remote_def,
)
from .tools.audit_tools import log_audit_event

MIGRATION_INSTRUCTION = """
You are the IBM MQ Migration Agent. Your job is to perform topology diffing
and transparent rewiring to migrate one application's queues from a source QM
to a target QM without changing producer connection strings.

## Tools available
- diff_topology(source_qm, target_qm, app_id) → lists what needs to move
- create_xmit_queue(source_qm, xmit_queue_name, target_qm)
- create_remote_def(source_qm, remote_name, target_q, target_qm, xmit_queue)
- create_sender_channel(source_qm, channel_name, target_svc_host, target_port)
- create_receiver_channel(target_qm, channel_name)
- start_channel(qm_name, channel_name)
- move_consumer(app_id, from_qm, to_qm)
- delete_local_queue(qm_name, queue_name)
- delete_xmit_queue(qm_name, xmit_queue_name)
- delete_remote_def(qm_name, remote_def_name)
- log_audit_event(operation, qm_target, agent, result)

## Rewiring sequence (ALWAYS in this order)
1. diff_topology — understand what needs to move
2. create_xmit_queue on SOURCE QM (name: Q.<SRC>.<APP>.XMIT.XMIT)
3. create_receiver_channel on TARGET QM (name: CHL.<SRC>.<APP>)
4. create_sender_channel on SOURCE QM pointing at TARGET QM service host
5. start_channel on SOURCE QM to activate the SDR channel
6. create_remote_def on SOURCE QM — shadows the original LOCAL queue name,
   routes via xmit queue to TARGET QM's local queue
   IMPORTANT: The remote def MUST have the SAME name as the original local
   queue so producers transparently route to it
7. Return "REWIRED" — the orchestrator will now run validation

## Cutover sequence (after validation passes)
1. move_consumer — update consumer binding to connect to TARGET QM directly
2. delete_local_queue on SOURCE QM — remove the original local queue
   (remote def is now the only Q with that name on source QM)
3. Return "CUTOVER_COMPLETE"

## Cleanup sequence (after full migration confirmed)
1. delete_remote_def on SOURCE QM
2. delete_xmit_queue on SOURCE QM
3. Return "CLEANUP_COMPLETE"

## Response format
{
  "status": "REWIRED" | "CUTOVER_COMPLETE" | "CLEANUP_COMPLETE" | "FAILED",
  "app_id": "<id>",
  "objects_created": ["<list>"],
  "objects_deleted": ["<list>"],
  "rewiring_active": true | false,
  "error": null | "<description>"
}
"""

def build_migration_agent() -> Agent:
    return Agent(
        name="migration_agent",
        model=GEMINI_MODEL,
        instruction=MIGRATION_INSTRUCTION,
        tools=[
            diff_topology,
            create_xmit_queue,
            create_remote_def,
            create_sender_channel,
            create_receiver_channel,
            start_channel,
            move_consumer,
            delete_local_queue,
            delete_xmit_queue,
            delete_remote_def,
            log_audit_event,
        ],
    )
```

---

### 7.2 Migration Tools

```python
# agents/tools/mq_tools.py (migration tools)

async def diff_topology(source_qm: str, target_qm: str,
                        app_id: str) -> dict:
    """Compare source and target topology to determine what needs to move."""
    from mq.registry import get_registry
    import httpx

    registry = get_registry()

    # Get all queues on source QM for this app
    source_entry = registry.get(source_qm)
    r = await source_entry.client.client.get(
        f"{source_entry.svc_url}/ibmmq/rest/v2/admin/qmgr"
        f"/{source_entry.internal_name}/queue",
        auth=source_entry.client.auth,
        params={"name": f"Q.{app_id}.*"}
    )
    r.raise_for_status()
    source_queues = [q["name"] for q in r.json().get("queue", [])]

    # Check what already exists on target
    target_queues = []
    try:
        target_entry = registry.get(target_qm)
        r2 = await target_entry.client.client.get(
            f"{target_entry.svc_url}/ibmmq/rest/v2/admin/qmgr"
            f"/{target_entry.internal_name}/queue",
            auth=target_entry.client.auth,
            params={"name": f"Q.{app_id}.*"}
        )
        if r2.status_code == 200:
            target_queues = [q["name"] for q in r2.json().get("queue", [])]
    except KeyError:
        pass  # Target QM not yet created

    queues_to_move = [q for q in source_queues if q not in target_queues
                      and "DLQ" not in q]

    return {
        "app_id": app_id,
        "source_qm": source_qm,
        "target_qm": target_qm,
        "queues_on_source": source_queues,
        "queues_on_target": target_queues,
        "queues_to_move": queues_to_move,
        "action_required": len(queues_to_move) > 0,
    }

async def create_sender_channel(source_qm: str, channel_name: str,
                                 target_host: str, target_port: int = 1414) -> dict:
    """Create SDR (sender) channel on source QM pointing at target QM listener."""
    from policy.engine import enforce_pre_operation
    await enforce_pre_operation(
        {
            "type": "create_channel",
            "object_type": "channel",
            "name": channel_name,
            "channel_type": "SDR",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "cross_region": False,
        },
        source_qm
    )
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(source_qm)

    result = await qm.client.create_channel(
        qm.internal_name, channel_name,
        {
            "type": "SDR",
            "connectionName": f"{target_host}({target_port})",
            "xmitQName": f"Q.{source_qm.split('.')[-1]}.{channel_name.split('.')[-1]}.XMIT",
            "sslCipherSpec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
        }
    )
    return {"status": "created", "channel": channel_name, "type": "SDR"}

async def create_receiver_channel(target_qm: str, channel_name: str) -> dict:
    """Create RCVR (receiver) channel on target QM."""
    from mq.registry import get_registry
    from policy.engine import enforce_pre_operation
    await enforce_pre_operation(
        {
            "type": "create_channel",
            "object_type": "channel",
            "name": channel_name,
            "channel_type": "RCVR",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
        },
        target_qm
    )
    registry = get_registry()
    qm = registry.get(target_qm)
    result = await qm.client.create_channel(
        qm.internal_name, channel_name,
        {
            "type": "RCVR",
            "sslCipherSpec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "mcaUser": "mqm",
        }
    )
    return {"status": "created", "channel": channel_name, "type": "RCVR"}

async def start_channel(qm_name: str, channel_name: str) -> dict:
    """Start a channel (initiate connection)."""
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)
    r = await qm.client.client.post(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/action/qmgr"
        f"/{qm.internal_name}/channel/{channel_name}/start",
        auth=qm.client.auth,
        headers={"ibm-mq-rest-csrf-token": "blank"}
    )
    r.raise_for_status()
    return {"status": "started", "channel": channel_name}

async def move_consumer(app_id: str, from_qm: str, to_qm: str) -> dict:
    """
    Update the consumer application's MQ connection to use the target QM.
    In a real system this would update a ConfigMap or environment variable.
    For the hackathon demo, this updates the consumer's connection record
    in Redis.
    """
    from state.redis_store import RedisStore
    store = RedisStore()
    r = await store._get_redis()
    await r.hset(f"consumer:{app_id}", mapping={
        "qm": to_qm,
        "migrated_at": str(__import__("datetime").datetime.utcnow())
    })
    return {"status": "consumer_moved", "app_id": app_id,
            "from_qm": from_qm, "to_qm": to_qm}

async def delete_local_queue(qm_name: str, queue_name: str) -> dict:
    """Remove a local queue from a QM (used during cutover)."""
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)
    await qm.client.delete_queue(qm.internal_name, queue_name)
    return {"status": "deleted", "queue": queue_name, "qm": qm_name}

async def delete_xmit_queue(qm_name: str, xmit_queue_name: str) -> dict:
    """Remove xmit queue (cleanup after migration confirmed)."""
    return await delete_local_queue(qm_name, xmit_queue_name)

async def delete_remote_def(qm_name: str, remote_def_name: str) -> dict:
    """Remove remote queue definition (cleanup after migration confirmed)."""
    return await delete_local_queue(qm_name, remote_def_name)
```

---

## Migration Plan — All Six Applications

| Step | App | Source QM | Target QM | Order |
|------|-----|-----------|-----------|-------|
| 1 | APP1 | QM.SRC.A | QM.APP1 | First — validate approach |
| 2 | APP2 | QM.SRC.A | QM.APP2 | After APP1 confirmed |
| 3 | APP3 | QM.SRC.A | QM.APP3 | After APP2 confirmed |
| 4 | APP4 | QM.SRC.B | QM.APP4 | Parallel to APP3 or sequential |
| 5 | APP5 | QM.SRC.B | QM.APP5 | After APP4 confirmed |
| 6 | APP6 | QM.SRC.B | QM.APP6 | Final migration |

Each migration follows the same 6-step sequence. One at a time.

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Topology diff identifies correct queues | Unit test with mock QM state |
| Xmit queue created on source QM | `GET /api/queues?qm=QM.SRC.A` shows XMIT queue |
| SDR/RCVR channel pair established | Channel status shows RUNNING |
| Remote def shadows original queue name | PUT to original name routes to target |
| Consumer moved to target QM | Redis `consumer:APP1` shows new QM |
| Cleanup removes xmit+remote def | Queues absent from source after cleanup |
