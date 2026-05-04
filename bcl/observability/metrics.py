from prometheus_client import Counter, Histogram

REQUEST_LATENCY = Histogram(
    "bcl_request_duration_seconds",
    "BCL Gateway HTTP request duration in seconds",
    ["path"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

REQUEST_COUNT = Counter(
    "bcl_requests_total",
    "Total BCL Gateway HTTP requests",
    ["path", "status_code"],
)

MQ_OPERATION_COUNT = Counter(
    "bcl_mq_operations_total",
    "Total MQ operations performed by BCL",
    ["operation", "qm", "status"],
)

POLICY_VIOLATION_COUNT = Counter(
    "bcl_policy_violations_total",
    "Total policy violations rejected by BCL",
    ["rule"],
)

MIGRATION_PHASE_COUNT = Counter(
    "bcl_migration_phase_transitions_total",
    "Total migration phase transitions",
    ["app_id", "phase"],
)
