from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database.db import Base

class User(Base):
    __tablename__ = "users"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String)
    email    = Column(String, unique=True, index=True)
    password = Column(String)

    projects = relationship("Project", back_populates="user")
    tasks    = relationship("Task",    back_populates="user")