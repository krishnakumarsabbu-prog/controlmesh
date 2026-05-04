import structlog
from google.adk.agents import Agent

from .base import GEMINI_MODEL
from .tools.mq_tools import scan_drift, heal_drift
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()

_INSTRUCTION = """
You are the Sentinel Agent, the guardian of the IBM MQ Control Mesh.
Your primary directive is 'Compliance as Code'. You monitor the fleet for 
configuration drift—unauthorized changes made outside the BCL—and 
autonomously apply self-healing.

## Your Workflow
1. SCAN: Call scan_drift(qm_name) for each QM in the fleet.
2. ANALYZE: Identify issues with CRITICAL or MEDIUM severity.
3. HEAL: For each detected issue, call heal_drift with the expected value.
4. AUDIT: Log each healing operation using log_audit_event.

## Response Format
Return a JSON summary of your actions:
{
  "agent": "Sentinel",
  "status": "SECURE" | "ISSUES_DETECTED" | "HEALED",
  "scanned_qms": ["QM1", "QM2"],
  "issues_found": [
    {"id": "...", "qm": "...", "object": "...", "issue": "..."}
  ],
  "healed_count": 0
}
"""

def build_sentinel_agent() -> Agent:
    return Agent(
        name="sentinel_agent",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            scan_drift,
            heal_drift,
            log_audit_event,
        ],
    )
