from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.project import Project
from app.models.user import User
from app.core.auth import get_current_user, get_db

router = APIRouter()

@router.post("/projects")
def create_project(title: str, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    project = Project(title=title, user_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("/projects")
def get_projects(db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    return db.query(Project).filter(Project.user_id == current_user.id).all()

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        return {"message": "Project not found"}
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}