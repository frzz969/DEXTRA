"""Eksekusi terkontrol.

Urutan yang tidak boleh dibalik:
1. validasi mandate (ulang, tepat sebelum aksi),
2. cek idempotensi di database,
3. jalankan aksi,
4. catat hasil + audit.

Langkah 2 sengaja memakai constraint unik di database, bukan pengecekan
aplikasi, karena proses bisa mati di antara dua pengecekan.
"""
from __future__ import annotations

import json
import secrets
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...governance import mandate as mandate_service
from ...governance.mandate import MandateError
from ...models.execution import ActionRecord, Execution, ExecutionStep
from ...repositories import audit as audit_repo


class ExecutionError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _adapter_result(action_type: str, params: dict) -> dict:
    """Adapter mock yang jujur: menyatakan dirinya mock, bukan pura-pura mengirim."""
    return {
        "adapter": "mock",
        "note": "Adapter mock: tidak ada sistem eksternal yang benar-benar dipanggil.",
        "action_type": action_type,
        "accepted_params": sorted(params.keys()),
    }


def execute(
    db: Session,
    *,
    mandate_id: str,
    action_id: str,
    action_type: str,
    params: dict,
    actor: str = "executor",
    correlation_id: str = "",
) -> Execution:
    # Idempotensi diperiksa LEBIH DULU. Permintaan ulang untuk (mandate, aksi) yang
    # sama tidak boleh menjalankan aksi lagi, dan tidak boleh berubah menjadi
    # penolakan hanya karena status mandate sudah bergerak ke "executing" setelah
    # eksekusi pertama. Yang dikembalikan adalah catatan eksekusi yang sudah ada.
    key = f"{mandate_id}:{action_id}:{mandate_service.params_digest(params)}"
    existing = db.scalar(select(Execution).where(Execution.idempotency_key == key))
    if existing is not None:
        return existing

    try:
        mandate = mandate_service.validate_for_execution(
            db, mandate_id=mandate_id, action_id=action_id, params=params
        )
    except MandateError as exc:
        audit_repo.append_event(
            db,
            event_type="action_blocked",
            actor=actor,
            scope="ops",
            action=action_type,
            resource=mandate_id,
            decision="deny",
            mandate_id=mandate_id,
            correlation_id=correlation_id,
            detail={"code": exc.code, "message": exc.message},
        )
        db.commit()
        raise ExecutionError(exc.code, exc.message) from exc

    started = datetime.now(timezone.utc)
    execution = Execution(
        # Suffix acak: milidetik saja tidak cukup unik ketika dua mandate
        # dieksekusi pada milidetik yang sama.
        id=f"exe_{int(time.time() * 1000)}_{secrets.token_hex(3)}",
        plan_id=mandate.plan_id,
        mandate_id=mandate.id,
        action_id=action_id,
        agent_id=mandate.agent_id,
        adapter="mcp",
        status="running",
        idempotency_key=key,
        started_at=started,
        correlation_id=correlation_id,
    )
    db.add(execution)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        again = db.scalar(select(Execution).where(Execution.idempotency_key == key))
        if again is None:
            raise
        return again

    db.add(
        ExecutionStep(
            id=f"stp_{execution.id}_1",
            execution_id=execution.id,
            seq=1,
            name="mandate_validated",
            status="succeeded",
            detail=f"nonce={mandate.nonce}",
        )
    )

    result = _adapter_result(action_type, params)
    finished = datetime.now(timezone.utc)
    execution.status = "succeeded"
    execution.finished_at = finished
    execution.duration_ms = int((finished - started).total_seconds() * 1000)
    execution.result_json = json.dumps(result, sort_keys=True)
    mandate.status = "executing"

    db.add(
        ActionRecord(
            id=f"act_{execution.id}",
            execution_id=execution.id,
            action_type=action_type,
            params_json=json.dumps(params, sort_keys=True),
            params_hash=mandate.params_hash,
        )
    )
    db.add(
        ExecutionStep(
            id=f"stp_{execution.id}_2",
            execution_id=execution.id,
            seq=2,
            name="action_executed",
            status="succeeded",
            detail=result["note"],
        )
    )

    audit_repo.append_event(
        db,
        event_type="action_executed",
        actor=actor,
        scope="ops",
        action=action_type,
        resource=mandate_id,
        decision="allow",
        plan_id=mandate.plan_id,
        mandate_id=mandate.id,
        execution_id=execution.id,
        correlation_id=correlation_id,
        detail={"adapter": "mock", "duration_ms": execution.duration_ms},
    )
    db.commit()
    return execution
