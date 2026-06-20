from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.ai.extractor import extract_task_info
from app.core.auth import get_current_user, get_db

router = APIRouter()

@router.post("/ai-extract")
def extract_task(user_input: str):
    return extract_task_info(user_input)

@router.post("/ai-task")
def create_ai_task(user_input: str, project_id: int = None,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    extracted   = extract_task_info(user_input)
    project_name = extracted["project"]
    task_title  = extracted["task"]
    deadline    = extracted["deadline"]
    priority    = extracted["priority"]

    if project_id:
        project = db.query(Project).filter(
            Project.id == project_id, Project.user_id == current_user.id
        ).first()
    else:
        project = db.query(Project).filter(
            Project.title == project_name, Project.user_id == current_user.id
        ).first()

    if not project:
        project = Project(title=project_name, user_id=current_user.id)
        db.add(project)
        db.commit()
        db.refresh(project)

    task = Task(
        title=task_title, deadline=deadline,
        priority=priority, project_id=project.id,
        user_id=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "message": "AI task created successfully",
        "task": {"title": task.title, "deadline": task.deadline, "project": project.title}
    }