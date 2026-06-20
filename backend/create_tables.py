from app.database.db import engine, Base

from app.models.project import Project
from app.models.task import Task

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")