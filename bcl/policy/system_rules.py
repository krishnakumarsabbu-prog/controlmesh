import re

QM_NAME_PATTERN = re.compile(r'^QM_[A-Z]+_[A-Z0-9]+$')
# Also accept dot-separated legacy form QM.APP.X (already in use in fleet)
QM_NAME_PATTERN_DOT = re.compile(r'^QM\.[A-Z]+\.[A-Z0-9]+$')


def _qm_name_valid(name: str) -> bool:
    return bool(QM_NAME_PATTERN.match(name) or QM_NAME_PATTERN_DOT.match(name))


def validate_system(
    queue_managers: list[dict],
    channels: list[dict],
) -> list[dict]:
    """
    Enforce enterprise readiness rules across the entire topology:
      1. Every queue manager must have a DLQ (queue name ending in .DLQ or _DLQ)
      2. QM names must follow QM_APP_X (or QM.APP.X) pattern
      3. Channels must exist between every pair of QMs that need connectivity

    Returns a list of violation dicts: {rule, severity, detail, entity}
    """
    violations: list[dict] = []

    qm_names = {qm["name"] for qm in queue_managers}

    for qm in queue_managers:
        name = qm.get("name", "")
        queues: list[str] = qm.get("queues", [])

        # Rule 1 – naming convention
        if not _qm_name_valid(name):
            violations.append({
                "rule": "QM_NAMING_CONVENTION",
                "severity": "ERROR",
                "detail": (
                    f"Queue manager '{name}' does not match required pattern "
                    f"QM_APP_X (e.g. QM_APP1, QM_SRC_A)"
                ),
                "entity": name,
            })

        # Rule 2 – DLQ required
        has_dlq = any(
            q.upper().endswith(".DLQ") or q.upper().endswith("_DLQ") or "DEAD.LETTER" in q.upper()
            for q in queues
        )
        if not has_dlq:
            violations.append({
                "rule": "DLQ_REQUIRED",
                "severity": "ERROR",
                "detail": (
                    f"Queue manager '{name}' has no Dead Letter Queue. "
                    f"Add a queue ending in .DLQ or _DLQ."
                ),
                "entity": name,
            })

    # Rule 3 – channels must exist between every declared QM pair
    # Build a set of (source, target) pairs that have channels
    channel_pairs: set[tuple[str, str]] = set()
    for ch in channels:
        src = ch.get("source_qm", "")
        tgt = ch.get("target_qm", "")
        if src and tgt:
            channel_pairs.add((src, tgt))

    # Validate that channel endpoints reference known QMs
    for ch in channels:
        name = ch.get("name", "<unnamed>")
        src = ch.get("source_qm", "")
        tgt = ch.get("target_qm", "")
        for endpoint, label in [(src, "source_qm"), (tgt, "target_qm")]:
            if endpoint and endpoint not in qm_names:
                violations.append({
                    "rule": "CHANNEL_UNKNOWN_QM",
                    "severity": "ERROR",
                    "detail": (
                        f"Channel '{name}' references unknown queue manager "
                        f"'{endpoint}' in {label}"
                    ),
                    "entity": name,
                })

    # Warn when a QM has no outbound channel at all (isolated node)
    qms_with_channel = {src for src, _ in channel_pairs} | {tgt for _, tgt in channel_pairs}
    for qm in queue_managers:
        nm = qm.get("name", "")
        if qm_names and nm not in qms_with_channel and len(qm_names) > 1:
            violations.append({
                "rule": "CHANNEL_MISSING",
                "severity": "WARNING",
                "detail": (
                    f"Queue manager '{nm}' has no channels connecting it to other QMs."
                ),
                "entity": nm,
            })

    return violations
