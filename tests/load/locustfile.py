"""
BCL Gateway load test.

Target: p99 < 500 ms at 100 concurrent users.

Run:
  locust -f tests/load/locustfile.py \\
    --host http://bcl-gateway-svc:8000 \\
    --users 100 --spawn-rate 10 \\
    --run-time 60s --headless \\
    --html evidence/locust-report.html
"""
from locust import HttpUser, task, between


class BCLUser(HttpUser):
    wait_time = between(0.5, 2)

    @task(5)
    def get_migration_status(self):
        with self.client.get("/api/migration/status", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"Unexpected status {r.status_code}")

    @task(3)
    def get_fleet(self):
        with self.client.get("/api/fleet", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"Unexpected status {r.status_code}")

    @task(2)
    def get_audit(self):
        with self.client.get("/api/audit?limit=20", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"Unexpected status {r.status_code}")

    @task(1)
    def get_health_ready(self):
        with self.client.get("/healthz/ready", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"Unexpected status {r.status_code}")

    @task(1)
    def get_health_live(self):
        with self.client.get("/healthz/live", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"Unexpected status {r.status_code}")
