"""Ringkasan operasional. Semua angka dihitung dari database — tidak ada yang dikarang."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...core.security import CallerContext, get_caller
from ...database.session import get_db
from ...models.execution import Execution
from ...models.governance import Approval, Mandate
from ...models.tasks import WorkPackage
from ...models.workforce import Agent

router = APIRouter(tags=["overview"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)) -> dict:
    now = datetime.now(timezone.utc)

    def count(model, *conditions) -> int:
        stmt = select(func.count()).select_from(model)
        for condition in conditions:
            stmt = stmt.where(condition)
        return int(db.scalar(stmt) or 0)

    active_mandates = db.scalars(
        select(Mandate).where(Mandate.status.in_(("issued", "approved", "executing")))
    ).all()
    usable = [m for m in active_mandates if m.is_usable(now)]

    return {
        "generated_at": now.isoformat(),
        "scope": caller.scope,
        "kpi": {
            "active_agents": count(Agent, Agent.is_enabled.is_(True)),
            "open_work_packages": count(
                WorkPackage, WorkPackage.status.notin_(("completed", "cancelled", "rejected"))
            ),
            "pending_approvals": count(Approval, Approval.decision == "pending"),
            "failed_executions": count(Execution, Execution.status == "failed"),
            "active_mandates": len(usable),
        },
        #: Rata-rata waktu respons approval belum dihitung: tabel approvals belum
        #: menyimpan waktu permintaan diajukan, hanya waktu keputusan. Dilaporkan
        #: sebagai tidak tersedia alih-alih angka tebakan.
        "unavailable": ["approval_response_time"],
    }
