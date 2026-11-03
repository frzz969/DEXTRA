"""Eksekusi: jejak, langkah, idempotensi.

`idempotency_key` unik per (mandate_id, action_id) — inilah yang mencegah aksi
yang sama dijalankan dua kali karena retry. Unik di level database, bukan di
level aplikasi, karena aplikasi bisa mati di antara dua pengecekan.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base, IdMixin, TimestampMixin, utcnow

EXECUTION_STATUSES = ("pending", "running", "succeeded", "failed", "blocked", "skipped")


class Execution(Base, IdMixin, TimestampMixin):
    __tablename__ = "executions"
    __table_args__ = (
        UniqueConstraint("mandate_id", "action_id", name="execution_mandate_action"),
    )

    plan_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mandate_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action_id: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    adapter: Mapped[str] = mapped_column(String(32), default="mcp", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(64), default="", nullable=False, index=True)

    steps: Mapped[list["ExecutionStep"]] = relationship(
        back_populates="execution", cascade="all, delete-orphan", lazy="selectin"
    )


class ExecutionStep(Base, IdMixin):
    __tablename__ = "execution_steps"

    execution_id: Mapped[str] = mapped_column(
        ForeignKey("executions.id", ondelete="CASCADE"), nullable=False
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="running", nullable=False)
    detail: Mapped[str] = mapped_column(Text, default="", nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    execution: Mapped[Execution] = relationship(back_populates="steps")


class ActionRecord(Base, IdMixin):
    """Parameter aksi yang benar-benar dieksekusi, disimpan untuk pembanding hash."""

    __tablename__ = "action_records"

    execution_id: Mapped[str] = mapped_column(
        ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    params_json: Mapped[str] = mapped_column(Text, nullable=False)
    params_hash: Mapped[str] = mapped_column(String(128), nullable=False)
