"""
Tests for policy engine: naming, TLS, MCA rules.
Run: pytest bcl/tests/test_policy.py -v
"""
import pytest
from bcl.policy.naming import validate_naming
from bcl.policy.tls import check_tls_required
from bcl.policy.mca import check_mca_authz


# ── Naming ────────────────────────────────────────────────────────────────────

class TestNamingPolicy:
    def test_valid_queue_name(self):
        op = {"object_type": "queue", "name": "Q.PAY.IN.LOCAL"}
        assert validate_naming(op) == []

    def test_valid_dlq_name(self):
        op = {"object_type": "queue", "name": "Q.PAY.DEAD.DLQ"}
        assert validate_naming(op) == []

    def test_invalid_queue_name(self):
        op = {"object_type": "queue", "name": "payments.in"}
        violations = validate_naming(op)
        assert len(violations) == 1
        assert violations[0]["rule"] == "NAMING_CONVENTION"

    def test_valid_channel_name(self):
        op = {"object_type": "channel", "name": "CHL.SRC.A"}
        assert validate_naming(op) == []

    def test_invalid_channel_name(self):
        op = {"object_type": "channel", "name": "channel-src"}
        violations = validate_naming(op)
        assert len(violations) == 1
        assert violations[0]["rule"] == "NAMING_CONVENTION"

    def test_valid_qm_name(self):
        op = {"object_type": "queue_manager", "name": "QM.SRC.A"}
        assert validate_naming(op) == []

    def test_unknown_object_type_passes(self):
        op = {"object_type": "unknown_type", "name": "anything"}
        assert validate_naming(op) == []

    def test_valid_listener_name(self):
        op = {"object_type": "listener", "name": "LST.SRC.1414"}
        assert validate_naming(op) == []


# ── TLS ───────────────────────────────────────────────────────────────────────

class TestTLSPolicy:
    def test_missing_ssl_cipher_spec(self):
        op = {"name": "CHL.SRC.A", "channel_type": "SVRCONN", "ssl_cipher_spec": ""}
        violations = check_tls_required(op)
        assert any(v["rule"] == "TLS_REQUIRED" for v in violations)

    def test_valid_ssl_cipher_spec(self):
        op = {
            "name": "CHL.SRC.A",
            "channel_type": "SVRCONN",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
        }
        violations = check_tls_required(op)
        assert violations == []

    def test_cross_region_wrong_type(self):
        op = {
            "name": "CHL.SRC.A",
            "channel_type": "CLNTCONN",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "cross_region": True,
        }
        violations = check_tls_required(op)
        assert any(v["rule"] == "CROSS_REGION_CHANNEL_TYPE" for v in violations)

    def test_cross_region_correct_type(self):
        op = {
            "name": "CHL.SRC.A",
            "channel_type": "SDR",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "cross_region": True,
        }
        violations = check_tls_required(op)
        assert violations == []

    def test_cross_zone_wrong_type(self):
        op = {
            "name": "CHL.SRC.A",
            "channel_type": "SDR",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "cross_zone": True,
        }
        violations = check_tls_required(op)
        assert any(v["rule"] == "CROSS_ZONE_CHANNEL_TYPE" for v in violations)


# ── MCA ───────────────────────────────────────────────────────────────────────

class TestMCAPolicy:
    def test_missing_mca_user(self):
        op = {"name": "CHL.SRC.A", "mca_user": ""}
        violations = check_mca_authz(op)
        assert any(v["rule"] == "MCA_USER_REQUIRED" for v in violations)

    def test_valid_mca_user(self):
        op = {"name": "CHL.SRC.A", "mca_user": "mqapp"}
        violations = check_mca_authz(op)
        assert violations == []

    def test_privileged_mca_user(self):
        op = {"name": "CHL.SRC.A", "mca_user": "mqm"}
        violations = check_mca_authz(op)
        assert any(v["rule"] == "MCA_PRIVILEGED_USER" for v in violations)

    def test_system_channel_exempt(self):
        op = {"name": "SYSTEM.DEF.SVRCONN", "mca_user": ""}
        violations = check_mca_authz(op)
        assert violations == []
