from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.db import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, unique=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    user  = relationship("User", back_populates="projects")
    tasks = relationship(
        "Task",
        back_populates="project"
    )