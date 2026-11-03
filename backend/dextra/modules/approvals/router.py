"""Approval: keputusan manusia yang mengikat tindakan spesifik.

Menyetujui sebuah plan menerbitkan mandate yang terikat pada action_id dan hash
parameter. Persetujuan yang tidak mengikat apa pun bukan persetujuan.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.security import CallerContext, get_caller, require_capability
from ...database.session import get_db
from ...governance import mandate as mandate_service
from ...governance.mandate import MandateError
from ...models.governance import Approval
from ...repositories import audit as audit_repo

router = APIRouter(tags=["approvals"])


class ApprovalRequest(BaseModel):
    plan_id: str
    action_id: str
    action_type: str
    params: dict = Field(default_factory=dict)
    plan_hash: str = ""
    approver_id: str
    decision: str = Field(pattern="^(approved|rejected|revision)$")
    reason: str = ""
    ttl_minutes: int = 30


@router.get("/approvals")
def list_approvals(
    db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)
) -> dict:
    rows = db.scalars(select(Approval).order_by(Approval.decided_at.desc()).limit(200)).all()
    return {
        "items": [
            {
                "id": a.id,
                "plan_id": a.plan_id,
                "approver_id": a.approver_id,
                "decision": a.decision,
                "reason": a.reason,
                "decided_at": a.decided_at.isoformat(),
                "mandate_id": a.mandate_id,
            }
            for a in rows
        ],
        #: approver_id adalah klaim klien, bukan identitas terverifikasi.
        "note": "approver_id dicatat apa adanya dan tidak diverifikasi server.",
    }


@router.post("/approvals", status_code=201)
def decide(
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(require_capability("approve")),
) -> dict:
    approval = Approval(
        # Suffix acak: stempel waktu saja tidak unik — dua approval bisa masuk di
        # detik yang sama, dan tabrakan primary key akan menggagalkan keputusan
        # yang sah.
        id=f"apr_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}",
        plan_id=payload.plan_id,
        approver_id=payload.approver_id,
        decision=payload.decision,
        reason=payload.reason,
        decided_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    db.flush()

    audit_repo.append_event(
        db,
        event_type="approval_recorded",
        actor="dashboard",
        scope=caller.scope,
        action="submit_approval",
        resource=payload.plan_id,
        decision=payload.decision,
        plan_id=payload.plan_id,
        detail={"approval_id": approval.id, "approver_id": payload.approver_id},
    )

    mandate_id = None
    if payload.decision == "approved":
        try:
            mandate = mandate_service.issue(
                db,
                mandate_service.IssueRequest(
                    plan_id=payload.plan_id,
                    approval_id=approval.id,
                    action_id=payload.action_id,
                    action_type=payload.action_type,
                    params=payload.params,
                    plan_hash=payload.plan_hash,
                    ttl_minutes=payload.ttl_minutes,
                ),
            )
        except MandateError as exc:
            db.rollback()
            raise HTTPException(
                status_code=409, detail={"code": exc.code, "message": exc.message}
            ) from exc
        approval.mandate_id = mandate.id
        mandate_id = mandate.id
        audit_repo.append_event(
            db,
            event_type="mandate_issued",
            actor="dashboard",
            scope=caller.scope,
            action="issue_mandate",
            resource=mandate.id,
            decision="allow",
            plan_id=payload.plan_id,
            mandate_id=mandate.id,
            detail={"via": "submit_approval", "approval_id": approval.id},
        )

    db.commit()
    return {"id": approval.id, "decision": approval.decision, "mandate_id": mandate_id}
