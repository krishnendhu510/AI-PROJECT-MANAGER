from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.core.auth import get_current_user, get_db

router = APIRouter()

@router.post("/tasks")
def create_task(title: str, deadline: str, project_id: int,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    new_task = Task(
        title=title, deadline=deadline,
        project_id=project_id, user_id=current_user.id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.get("/tasks/export")
def export_tasks_csv(db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Priority", "Status", "Deadline", "Project", "Notes"])
    for task in tasks:
        project = db.query(Project).filter(Project.id == task.project_id).first()
        writer.writerow([
            task.id,
            task.title,
            task.priority or "",
            task.status or "",
            task.deadline or "",
            project.title if project else "General",
            task.notes or ""
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks.csv"}
    )

@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    result = []
    for task in tasks:
        project = db.query(Project).filter(Project.id == task.project_id).first()
        result.append({
            "id": task.id,
            "title": task.title,
            "deadline": task.deadline,
            "priority": task.priority,
            "project": project.title if project else "General",
            "status": task.status,
            "notes": task.notes or "",
        })
    return result

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        return {"message": "Task not found"}
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}

@router.put("/tasks/{task_id}/status")
def update_task_status(task_id: int, status: str,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        return {"error": "Task not found"}
    task.status = status
    db.commit()
    return {"message": "Status updated", "status": task.status}

@router.put("/tasks/{task_id}/deadline")
def update_task_deadline(task_id: int, deadline: str,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        return {"error": "Task not found"}
    task.deadline = deadline
    db.commit()
    return {"message": "Deadline updated", "deadline": task.deadline}

@router.put("/tasks/{task_id}")
def update_task(task_id: int, title: str = None, priority: str = None, notes: str = None,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        return {"error": "Task not found"}
    if title    is not None: task.title    = title
    if priority is not None: task.priority = priority
    if notes    is not None: task.notes    = notes
    db.commit()
    db.refresh(task)
    return task