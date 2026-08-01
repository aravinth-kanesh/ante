from typing import Literal

from pydantic import BaseModel


class Competency(BaseModel):
    name: str
    area: Literal["technical", "behavioural"] = "behavioural"
    status: Literal["strong", "partial", "gap"] = "partial"
    evidence: str = ""


class PlanItem(BaseModel):
    focus: str
    action: str
    priority: Literal["high", "medium", "low"] = "medium"


class PreparationReport(BaseModel):
    summary: str = ""
    competencies: list[Competency] = []
    plan: list[PlanItem] = []
