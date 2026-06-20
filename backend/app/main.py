from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.db import Base, engine
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.api.projects import router as project_router
from app.api.tasks import router as task_router
from app.api.ai import router as ai_router
from app.api.auth import router as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(project_router)
app.include_router(task_router)
app.include_router(ai_router)

@app.get("/")
def home():
    return {"message": "AI Work Organizer Running"}