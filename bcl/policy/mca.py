def check_mca_authz(operation: dict) -> list:
    """
    Verify MCA (Message Channel Agent) authorization settings on a channel.
    MCA user must be set for all non-system channels.
    """
    violations = []
    name = operation.get("name", "")

    # System channels are exempt
    if name.startswith("SYSTEM."):
        return violations

    mca_user = operation.get("mca_user", "")
    if not mca_user:
        violations.append({
            "rule": "MCA_USER_REQUIRED",
            "detail": f"Channel {name} must have mcaUser configured for authorized access",
        })

    # MCA user must not be a privileged account
    forbidden_users = {"root", "mqm", "admin", "administrator"}
    if mca_user.lower() in forbidden_users:
        violations.append({
            "rule": "MCA_PRIVILEGED_USER",
            "detail": f"Channel {name} mcaUser '{mca_user}' is a privileged account — use a dedicated service account",
        })

    return violations
