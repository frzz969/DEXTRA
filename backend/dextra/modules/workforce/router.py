"""Workforce: registri agen. Hanya empat spesialis yang benar-benar ditetapkan."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.security import CallerContext, get_caller
from ...database.session import get_db
from ...models.workforce import Agent

router = APIRouter(tags=["workforce"])

#: §8.4 — menambah slug di sini berarti menambah agen yang harus ada implementasinya.
SPECIALISTS = (
    "workforce-dispatcher",
    "executive-assistant",
    "administrative-officer",
    "adversarial-reviewer",
)


def _serialize(agent: Agent) -> dict:
    return {
        "id": agent.id,
        "slug": agent.slug,
        "display_name": agent.display_name,
        "agent_type": agent.agent_type,
        "description": agent.description,
        "model_provider": agent.model_provider,
        "status": agent.status,
        "is_enabled": agent.is_enabled,
        "capabilities": sorted(c.capability for c in agent.capabilities),
        "versions": len(agent.versions),
    }


@router.get("/agents")
def list_agents(db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)) -> dict:
    agents = db.scalars(select(Agent).order_by(Agent.slug)).all()
    return {
        "items": [_serialize(a) for a in agents],
        "expected_specialists": list(SPECIALISTS),
        #: Agen di luar empat spesialis dilaporkan, bukan disembunyikan.
        "unexpected": [a.slug for a in agents if a.slug not in SPECIALISTS],
    }


@router.get("/agents/{slug}")
def get_agent(
    slug: str, db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)
) -> dict:
    agent = db.scalar(select(Agent).where(Agent.slug == slug))
    if agent is None:
        raise HTTPException(status_code=404, detail="Agen tidak ditemukan.")
    return _serialize(agent)
