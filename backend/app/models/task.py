from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.db import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)

    deadline = Column(String)

    priority = Column(String)

    status = Column(String, default="Pending")
    notes = Column(String, default="")
    user_id    = Column(Integer, ForeignKey("users.id"))
    project_id = Column(
        Integer,
        ForeignKey("projects.id")
    )
    
    user    = relationship("User",    back_populates="tasks")
    project = relationship(
        "Project",
        back_populates="tasks"
    )