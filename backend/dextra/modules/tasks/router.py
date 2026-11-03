"""Work package dan task."""
from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.security import CallerContext, get_caller, require_capability
from ...database.session import get_db
from ...models.tasks import Task, WorkPackage

router = APIRouter(tags=["tasks"])


class TaskCreate(BaseModel):
    work_package_id: str
    title: str = Field(min_length=1, max_length=200)
    description: str = ""


@router.get("/work-packages")
def list_work_packages(
    db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)
) -> dict:
    rows = db.scalars(select(WorkPackage).order_by(WorkPackage.created_at.desc())).all()
    return {
        "items": [
            {
                "id": wp.id,
                "title": wp.title,
                "status": wp.status,
                "priority": wp.priority,
                "task_count": len(wp.tasks),
                "due_at": wp.due_at.isoformat() if wp.due_at else None,
            }
            for wp in rows
        ]
    }


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db), caller: CallerContext = Depends(get_caller)) -> dict:
    rows = db.scalars(select(Task).order_by(Task.sort_order, Task.created_at)).all()
    return {
        "items": [
            {
                "id": t.id,
                "work_package_id": t.work_package_id,
                "title": t.title,
                "status": t.status,
                "assigned_agent_id": t.assigned_agent_id,
            }
            for t in rows
        ]
    }


@router.post("/tasks", status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(require_capability("create_request")),
) -> dict:
    package = db.get(WorkPackage, payload.work_package_id)
    if package is None:
        raise HTTPException(status_code=404, detail="Work package tidak ditemukan.")
    task = Task(
        id=f"tsk_{len(package.tasks) + 1:04d}_{package.id[-6:]}",
        work_package_id=package.id,
        title=payload.title,
        description=payload.description,
    )
    db.add(task)
    db.commit()
    return {"id": task.id, "status": task.status}
