import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .client import MQRestClient

import structlog

log = structlog.get_logger()


@dataclass
class QueueManagerEntry:
    name: str           # logical name e.g. QM.SRC.A
    internal_name: str  # MQ internal name e.g. QMSRCA
    svc_url: str        # https://qm-src-a-svc:9443
    role: str           # source | target
    client: MQRestClient = field(repr=False)


_registry: Dict[str, QueueManagerEntry] = {}


class _RegistryProxy:
    def register(self, entry: QueueManagerEntry) -> None:
        _registry[entry.name] = entry
        log.info("qm_registered", name=entry.name, role=entry.role, url=entry.svc_url)

    def get(self, logical_name: str) -> QueueManagerEntry:
        if logical_name not in _registry:
            raise KeyError(f"QM {logical_name} not in registry")
        return _registry[logical_name]

    def list_qms(self) -> List[QueueManagerEntry]:
        return list(_registry.values())

    async def check_any_qm_reachable(self) -> bool:
        for entry in _registry.values():
            try:
                await entry.client.get_qmgr_status()
                return True
            except Exception:
                continue
        return bool(_registry)  # if no QMs configured, report healthy in dev


def get_registry() -> _RegistryProxy:
    return _RegistryProxy()


def bootstrap_registry() -> None:
    """Populate registry from environment / OCP service discovery."""
    admin_pw = os.environ.get("MQ_ADMIN_PASSWORD", "passw0rd")
    source_qms = [
        ("QM.SRC.A", "QMSRCA", os.environ.get("QM_SRC_A_URL", "https://qm-src-a-svc:9443")),
        ("QM.SRC.B", "QMSRCB", os.environ.get("QM_SRC_B_URL", "https://qm-src-b-svc:9443")),
    ]
    target_qms_raw = os.environ.get("TARGET_QMS", "")
    proxy = get_registry()
    for logical, internal, url in source_qms:
        proxy.register(QueueManagerEntry(
            name=logical,
            internal_name=internal,
            svc_url=url,
            role="source",
            client=MQRestClient(url, "admin", admin_pw),
        ))
    # Support additional target QMs via env: TARGET_QMS=QM.TGT.A:QMTGTA:https://... (comma-sep)
    if target_qms_raw:
        for entry_str in target_qms_raw.split(","):
            parts = entry_str.strip().split(":")
            if len(parts) >= 3:
                logical, internal, url = parts[0], parts[1], ":".join(parts[2:])
                proxy.register(QueueManagerEntry(
                    name=logical,
                    internal_name=internal,
                    svc_url=url,
                    role="target",
                    client=MQRestClient(url, "admin", admin_pw),
                ))
