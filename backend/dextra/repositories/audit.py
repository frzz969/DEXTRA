"""Repository audit — append-only dengan hash chaining.

Satu-satunya tempat penulisan `audit_events`. Tidak ada fungsi update atau delete
di sini, dan itu disengaja: audit yang bisa disunting dari kode aplikasi bukan
audit.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models.audit import AuditEvent


def _canonical_at(moment: datetime) -> str:
    """Representasi waktu yang stabil lintas database.

    SQLite mengembalikan datetime tanpa timezone, sementara penulisan memakai
    datetime ber-timezone. Tanpa penyeragaman ini, hash yang dihitung saat
    menulis tidak akan cocok saat verifikasi — dan audit akan tampak rusak
    padahal utuh.
    """
    if moment.tzinfo is not None:
        moment = moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment.isoformat(timespec="microseconds")


def _next_seq(db: Session) -> int:
    current = db.scalar(select(func.max(AuditEvent.seq)))
    return 1 if current is None else int(current) + 1


def append_event(
    db: Session,
    *,
    event_type: str,
    actor: str,
    scope: str = "none",
    action: str = "",
    resource: str = "",
    decision: str = "",
    plan_id: str = "",
    mandate_id: str = "",
    execution_id: str = "",
    correlation_id: str = "",
    detail: dict | None = None,
    at: datetime | None = None,
) -> AuditEvent:
    seq = _next_seq(db)
    previous = db.scalar(select(AuditEvent).order_by(AuditEvent.seq.desc()).limit(1))
    prev_hash = previous.entry_hash if previous is not None else ""
    moment = at or datetime.now(timezone.utc)
    payload = {
        "seq": seq,
        "at": _canonical_at(moment),
        "event_type": event_type,
        "actor": actor,
        "scope": scope,
        "action": action,
        "resource": resource,
        "decision": decision,
        "plan_id": plan_id,
        "mandate_id": mandate_id,
        "execution_id": execution_id,
        "correlation_id": correlation_id,
        "detail": detail or {},
    }
    event = AuditEvent(
        id=f"evt_{seq:08d}",
        seq=seq,
        at=moment,
        event_type=event_type,
        actor=actor,
        scope=scope,
        action=action,
        resource=resource,
        decision=decision,
        plan_id=plan_id,
        mandate_id=mandate_id,
        execution_id=execution_id,
        correlation_id=correlation_id,
        detail_json=json.dumps(detail or {}, sort_keys=True),
        prev_hash=prev_hash,
        entry_hash=AuditEvent.compute_hash(prev_hash, payload),
    )
    db.add(event)
    db.flush()
    return event


def verify_chain(db: Session) -> dict:
    """Rekonstruksi rantai dari awal dan laporkan baris pertama yang rusak."""
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.seq.asc())).all()
    prev_hash = ""
    for event in events:
        payload = {
            "seq": event.seq,
            "at": _canonical_at(event.at),
            "event_type": event.event_type,
            "actor": event.actor,
            "scope": event.scope,
            "action": event.action,
            "resource": event.resource,
            "decision": event.decision,
            "plan_id": event.plan_id,
            "mandate_id": event.mandate_id,
            "execution_id": event.execution_id,
            "correlation_id": event.correlation_id,
            "detail": json.loads(event.detail_json or "{}"),
        }
        expected = AuditEvent.compute_hash(prev_hash, payload)
        if event.prev_hash != prev_hash or event.entry_hash != expected:
            return {"ok": False, "broken_at_seq": event.seq, "checked": len(events)}
        prev_hash = event.entry_hash
    return {"ok": True, "checked": len(events)}


def list_events(db: Session, limit: int = 100, offset: int = 0) -> list[AuditEvent]:
    return list(
        db.scalars(
            select(AuditEvent).order_by(AuditEvent.seq.desc()).limit(min(limit, 500)).offset(offset)
        ).all()
    )
