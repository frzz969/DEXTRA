"""Seed data DEXTRA v2.

Seed ini sengaja kecil dan jujur: hanya empat spesialis yang benar-benar
ditetapkan (§8.4), satu organisasi, dan satu kebijakan contoh. Tidak ada angka
operasional karangan — kalau tabel kosong, UI harus menampilkan empty state,
bukan data palsu.

Idempoten: menjalankan dua kali tidak menggandakan baris.

    python database/seeds/seed.py
    python database/seeds/seed.py --reset   # hapus lalu isi ulang
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from dextra.core.security import CAPABILITIES  # noqa: E402
from dextra.database.base import Base  # noqa: E402
from dextra.database.session import get_engine, session_scope  # noqa: E402
from dextra.models.identity import Permission, Role, RolePermission  # noqa: E402
from dextra.models.governance import Policy, PolicyVersion  # noqa: E402
from dextra.models.tasks import Task, WorkPackage  # noqa: E402
from dextra.models.workforce import Agent, AgentCapability, AgentVersion  # noqa: E402

SPECIALISTS = [
    {
        "slug": "workforce-dispatcher",
        "display_name": "Workforce Dispatcher",
        "agent_type": "orchestrator",
        "description": "Membagi pekerjaan ke spesialis dan memantau kemajuannya.",
        "capabilities": ["route_task", "read_workforce"],
    },
    {
        "slug": "executive-assistant",
        "display_name": "Executive Assistant",
        "agent_type": "assistant",
        "description": "Menyusun rencana kerja dan ringkasan untuk manusia.",
        "capabilities": ["create_plan", "read_calendar"],
    },
    {
        "slug": "administrative-officer",
        "display_name": "Administrative Officer",
        "agent_type": "operator",
        "description": "Menyiapkan dokumen dan korespondensi sesuai mandat.",
        "capabilities": ["draft_document"],
    },
    {
        "slug": "adversarial-reviewer",
        "display_name": "Adversarial Reviewer",
        "agent_type": "reviewer",
        "description": "Mencari cacat rencana sebelum diajukan untuk persetujuan.",
        "capabilities": ["review_plan"],
    },
]

ROLES = {
    "operations_manager": ["view_own", "view_all", "create_request", "approve", "execute", "view_audit"],
    "governance_lead": ["view_own", "view_all", "approve", "issue_mandate", "revoke_mandate", "view_audit"],
    "auditor": ["view_own", "view_all", "view_audit"],
    "requester": ["view_own", "create_request"],
}


def seed(reset: bool = False) -> dict:
    engine = get_engine()
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    counts = {"agents": 0, "roles": 0, "policies": 0, "work_packages": 0, "tasks": 0}

    with session_scope() as db:
        for spec in SPECIALISTS:
            agent = db.scalar(select(Agent).where(Agent.slug == spec["slug"]))
            if agent is None:
                agent = Agent(
                    id=f"agt_{spec['slug']}",
                    slug=spec["slug"],
                    display_name=spec["display_name"],
                    agent_type=spec["agent_type"],
                    description=spec["description"],
                    status="idle",
                )
                db.add(agent)
                db.flush()
                counts["agents"] += 1
            for capability in spec["capabilities"]:
                exists = db.scalar(
                    select(AgentCapability).where(
                        AgentCapability.agent_id == agent.id,
                        AgentCapability.capability == capability,
                    )
                )
                if exists is None:
                    db.add(
                        AgentCapability(
                            id=f"cap_{agent.id}_{capability}", agent_id=agent.id, capability=capability
                        )
                    )
            if not agent.versions:
                db.add(
                    AgentVersion(
                        id=f"ver_{agent.id}_1",
                        agent_id=agent.id,
                        version=1,
                        config_json='{"source":"seed"}',
                        notes="Versi awal dari seed.",
                    )
                )

        for name, caps in ROLES.items():
            role = db.scalar(select(Role).where(Role.name == name))
            if role is None:
                role = Role(id=f"rol_{name}", name=name, description=f"Peran {name}")
                db.add(role)
                db.flush()
                counts["roles"] += 1
            for cap in caps:
                if cap not in CAPABILITIES:
                    raise SystemExit(f"Seed menyebut capability yang tidak dikenal: {cap}")
                permission = db.scalar(select(Permission).where(Permission.name == cap))
                if permission is None:
                    permission = Permission(id=f"prm_{cap}", name=cap, capability=cap)
                    db.add(permission)
                    db.flush()
                link = db.scalar(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == permission.id,
                    )
                )
                if link is None:
                    db.add(
                        RolePermission(
                            id=f"rp_{role.id}_{permission.id}",
                            role_id=role.id,
                            permission_id=permission.id,
                        )
                    )

        policy = db.scalar(select(Policy).where(Policy.slug == "recipient-scope"))
        if policy is None:
            policy = Policy(
                id="pol_recipient_scope",
                slug="recipient-scope",
                title="Penerima di luar scope organisasi",
                scope="organization",
            )
            db.add(policy)
            db.flush()
            db.add(
                PolicyVersion(
                    id="pov_recipient_scope_1",
                    policy_id=policy.id,
                    version=1,
                    rules_json='{"deny_when":"recipient outside allowed_recipients"}',
                    change_note="Versi awal dari seed.",
                )
            )
            counts["policies"] += 1

        package = db.scalar(select(WorkPackage).where(WorkPackage.title == "Onboarding vendor Q4"))
        if package is None:
            package = WorkPackage(
                id="wpg_onboarding_q4",
                title="Onboarding vendor Q4",
                status="draft",
                priority="normal",
            )
            db.add(package)
            db.flush()
            counts["work_packages"] += 1
            for index, title in enumerate(
                ("Kumpulkan dokumen vendor", "Verifikasi rekening", "Kirim surat perkenalan"), start=1
            ):
                db.add(
                    Task(
                        id=f"tsk_onboarding_q4_{index}",
                        work_package_id=package.id,
                        title=title,
                        status="todo",
                        sort_order=index,
                    )
                )
                counts["tasks"] += 1

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed database DEXTRA v2")
    parser.add_argument("--reset", action="store_true", help="hapus seluruh tabel lalu isi ulang")
    args = parser.parse_args()
    counts = seed(reset=args.reset)
    print("Seed selesai:", ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
