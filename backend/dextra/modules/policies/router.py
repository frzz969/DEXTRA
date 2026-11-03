"""Policy: registri dan evaluasi deterministik.

Endpoint evaluasi sengaja memanggil fungsi murni, bukan model. Kalau hasilnya
berbeda untuk masukan yang sama, itu bug — bukan kreativitas.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.security import CallerContext, get_caller
from ...database.session import get_db
from ...governance import policy as policy_engine
from ...models.governance import Policy

router = APIRouter(tags=["policies"])


class EvaluateRequest(BaseModel):
    action_type: str
    recipients: list[str] = Field(default_factory=list)
    allowed_recipients: list[str] = Field(default_factory=list)
    recipient_candidates: int = 1
    at: datetime | None = None
    recipient_count: int = 1
    bulk_threshold: int = 25
    is_holiday: bool = False
    is_friday_prayer: bool = False
    contains_injection: bool = False


@router.get("/policies")
def list_policies(
    db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)
) -> dict:
    rows = db.scalars(select(Policy).order_by(Policy.slug)).all()
    return {
        "items": [
            {
                "id": p.id,
                "slug": p.slug,
                "title": p.title,
                "scope": p.scope,
                "is_active": p.is_active,
                "versions": len(p.versions),
            }
            for p in rows
        ],
        #: Policy read-only: `edit_policy` belum punya backend, jadi tidak ada endpoint tulis.
        "writable": False,
    }


@router.post("/policies/evaluate")
def evaluate(
    payload: EvaluateRequest,
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(get_caller),
) -> dict:
    result = policy_engine.evaluate(
        policy_engine.PlanInput(
            action_type=payload.action_type,
            recipients=tuple(payload.recipients),
            allowed_recipients=tuple(payload.allowed_recipients),
            recipient_candidates=payload.recipient_candidates,
            at=payload.at,
            is_holiday=payload.is_holiday,
            is_friday_prayer=payload.is_friday_prayer,
            recipient_count=payload.recipient_count,
            bulk_threshold=payload.bulk_threshold,
            contains_injection=payload.contains_injection,
        )
    )
    return {
        "decision": result.decision,
        "reason_code": result.reason_code,
        "detail": result.detail,
        "findings": [
            {"code": f.code, "decision": f.decision, "message": f.message} for f in result.findings
        ],
    }
