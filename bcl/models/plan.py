from pydantic import BaseModel
from typing import List, Literal


class MigrationStep(BaseModel):
    id: str
    action: str
    status: Literal["pending", "running", "success", "failed"] = "pending"


class MigrationPlan(BaseModel):
    steps: List[MigrationStep] = []
