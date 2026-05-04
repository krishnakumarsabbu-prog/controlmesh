import re

PATTERNS = {
    "queue_manager": re.compile(r'^QM\.[A-Z]+\.[A-Z0-9]+$'),
    "queue":         re.compile(r'^Q\.[A-Z0-9]+\.[A-Z0-9]+\.(LOCAL|REMOTE|XMIT|DLQ)$'),
    "channel":       re.compile(r'^CHL\.[A-Z0-9]+\.[A-Z0-9]+$'),
    "listener":      re.compile(r'^LST\.[A-Z0-9]+\.[0-9]+$'),
}


def validate_naming(operation: dict) -> list:
    violations = []
    obj_type = operation.get("object_type")
    name = operation.get("name", "")

    pattern = PATTERNS.get(obj_type)
    if pattern and not pattern.match(name):
        violations.append({
            "rule": "NAMING_CONVENTION",
            "detail": f"{obj_type} name '{name}' does not match pattern {pattern.pattern}",
        })
    return violations
