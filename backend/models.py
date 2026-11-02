from sqlalchemy import Column, Integer, String, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class Student(Base):
    __tablename__ = 'students'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    gender = Column(String)  # M/F
    academic_year = Column(Integer)
    department = Column(String, default="General")
    preferred_room_type = Column(String)
    requested_roommate_id = Column(Integer, ForeignKey('students.id'), nullable=True)
    sleep_schedule = Column(String, default="Flexible")  # Night Owl, Early Bird, Flexible
    study_habit = Column(String, default="Quiet")        # Quiet, Group Study, Music
    cleanliness = Column(String, default="Moderate")     # Strict, Moderate, Relaxed
    needs_accessible = Column(Integer, default=0)        # 1 if PWD / ground-floor required

class Room(Base):
    __tablename__ = 'rooms'
    id = Column(Integer, primary_key=True, index=True)
    block_floor = Column(String)
    max_capacity = Column(Integer)
    designated_gender = Column(String) # M/F
    room_type = Column(String)
    floor = Column(Integer, default=1)
    is_accessible = Column(Integer, default=0) # 1 if wheelchair/PWD accessible

class Allocation(Base):
    __tablename__ = 'allocations'
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey('students.id'))
    room_id = Column(Integer, ForeignKey('rooms.id'))

SQLALCHEMY_DATABASE_URL = "sqlite:///./dorm.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
