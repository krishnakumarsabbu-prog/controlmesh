def check_tls_required(operation: dict) -> list:
    violations = []
    channel_type = operation.get("channel_type", "")
    ssl_cipher = operation.get("ssl_cipher_spec", "")

    if not ssl_cipher:
        violations.append({
            "rule": "TLS_REQUIRED",
            "detail": f"Channel {operation.get('name')} must have sslCipherSpec configured",
        })

    if operation.get("cross_region") and channel_type not in ("SVRCONN", "SDR", "RCVR"):
        violations.append({
            "rule": "CROSS_REGION_CHANNEL_TYPE",
            "detail": "Cross-region traffic must flow via QM-to-QM channels (SDR/RCVR)",
        })

    if operation.get("cross_zone") and channel_type != "SVRCONN":
        violations.append({
            "rule": "CROSS_ZONE_CHANNEL_TYPE",
            "detail": "Cross-zone connections must use server-connection channels (SVRCONN)",
        })
    return violations
