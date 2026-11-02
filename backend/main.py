import io
import csv
import json
import asyncio
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from models import SessionLocal, Student, Room, Allocation
from ga_solver import GASolver
import seed_data

app = FastAPI(title="DormGen - Intelligent Hostel Allocation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RunConfig(BaseModel):
    pop_size: int = 60
    generations: int = 150
    mutation_rate: float = 0.08
    elitism: int = 3

class ManualAssignRequest(BaseModel):
    student_id: int
    target_room_id: int

@app.get("/api/students")
def get_students(db: Session = Depends(get_db)):
    return db.query(Student).all()

@app.get("/api/rooms")
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()

@app.post("/api/run-allocation")
def run_allocation(config: RunConfig, db: Session = Depends(get_db)):
    solver = GASolver(
        db, 
        pop_size=config.pop_size, 
        max_generations=config.generations,
        mutation_rate=config.mutation_rate,
        elitism_count=config.elitism
    )
    best_chrom, best_fit, history, metrics = solver.solve()
    
    # Save best chromosome into allocations table
    db.query(Allocation).delete()
    students = db.query(Student).order_by(Student.id).all()
    
    allocations_to_add = []
    for idx, room_id in enumerate(best_chrom):
        student_id = students[idx].id
        allocations_to_add.append(Allocation(student_id=student_id, room_id=room_id))
        
    db.add_all(allocations_to_add)
    db.commit()
    
    return {
        "message": "Allocation completed successfully", 
        "fitness": float(best_fit),
        "metrics": metrics,
        "history": history
    }

@app.get("/api/stream-allocation")
async def stream_allocation(
    pop_size: int = 60,
    generations: int = 150,
    mutation_rate: float = 0.08,
    elitism: int = 3,
    db: Session = Depends(get_db)
):
    """Server-Sent Events endpoint to stream generation-by-generation evolution"""
    solver = GASolver(
        db,
        pop_size=pop_size,
        max_generations=generations,
        mutation_rate=mutation_rate,
        elitism_count=elitism
    )

    async def event_generator():
        stream = solver.solve_stream()
        for event in stream:
            if event["type"] == "progress":
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.015)
            elif event["type"] == "completed":
                best_chrom = event["best_chromosome"]
                # Save into database
                db.query(Allocation).delete()
                students = db.query(Student).order_by(Student.id).all()
                allocs = [Allocation(student_id=students[i].id, room_id=best_chrom[i]) for i in range(len(best_chrom))]
                db.add_all(allocs)
                db.commit()
                yield f"data: {json.dumps(event)}\n\n"
        yield "data: {\"type\": \"end\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/results")
def get_results(db: Session = Depends(get_db)):
    results = db.query(Allocation, Student, Room)\
        .join(Student, Allocation.student_id == Student.id)\
        .join(Room, Allocation.room_id == Room.id)\
        .all()
        
    if not results:
        return []

    # Map allocations for quick lookups
    alloc_map = {a.student_id: a.room_id for a, _, _ in results}
    room_occupants_map = {}
    for a, _, _ in results:
        room_occupants_map[a.room_id] = room_occupants_map.get(a.room_id, 0) + 1

    data = []
    for allocation, student, room in results:
        # Constraint checks
        gender_match = (student.gender == room.designated_gender)
        capacity_ok = (room_occupants_map.get(room.id, 0) <= room.max_capacity)
        accessible_ok = (student.needs_accessible == 0 or room.is_accessible == 1)
        type_match = (student.preferred_room_type == room.room_type)
        
        # Roommate request fulfillment
        roommate_fulfilled = None
        if student.requested_roommate_id:
            roommate_fulfilled = (alloc_map.get(student.requested_roommate_id) == room.id)

        all_hard_passed = (gender_match and capacity_ok and accessible_ok)

        data.append({
            "student_id": student.id,
            "student_name": student.name,
            "student_gender": student.gender,
            "academic_year": student.academic_year,
            "department": student.department,
            "sleep_schedule": student.sleep_schedule,
            "study_habit": student.study_habit,
            "cleanliness": student.cleanliness,
            "needs_accessible": student.needs_accessible,
            "preferred_room_type": student.preferred_room_type,
            "requested_roommate_id": student.requested_roommate_id,
            "roommate_fulfilled": roommate_fulfilled,
            
            "room_id": room.id,
            "block_floor": room.block_floor,
            "room_type": room.room_type,
            "room_gender": room.designated_gender,
            "floor": room.floor,
            "is_accessible": room.is_accessible,
            "room_max_capacity": room.max_capacity,
            "current_occupants": room_occupants_map.get(room.id, 0),
            
            "gender_match": gender_match,
            "capacity_ok": capacity_ok,
            "accessible_ok": accessible_ok,
            "type_match": type_match,
            "constraint_passed": all_hard_passed
        })
    return data

@app.get("/api/metrics")
def get_metrics(db: Session = Depends(get_db)):
    allocs = db.query(Allocation).all()
    students = db.query(Student).all()
    rooms = db.query(Room).all()
    
    total_capacity = sum(r.max_capacity for r in rooms)
    total_students = len(students)
    
    if not allocs:
        return {
            "placed_students": 0,
            "total_students": total_students,
            "total_capacity": total_capacity,
            "occupancy_rate": 0,
            "roommate_success_rate": 0,
            "pref_room_success_rate": 0,
            "capacity_violations": 0,
            "gender_violations": 0,
            "accessibility_violations": 0,
            "hard_violations": 0,
            "satisfaction_index": 0
        }
        
    placed = len(allocs)
    occupancy_rate = round((placed / total_capacity * 100), 1) if total_capacity else 0
    
    alloc_dict = {a.student_id: a.room_id for a in allocs}
    room_dict = {r.id: r for r in rooms}
    student_dict = {s.id: s for s in students}

    requests = 0
    roommate_success = 0
    pref_success = 0
    gender_violations = 0
    accessibility_violations = 0
    
    for s in students:
        r_id = alloc_dict.get(s.id)
        if r_id and r_id in room_dict:
            r = room_dict[r_id]
            if s.gender != r.designated_gender:
                gender_violations += 1
            if s.needs_accessible and r.is_accessible == 0:
                accessibility_violations += 1
            if s.preferred_room_type == r.room_type:
                pref_success += 1
                
        if s.requested_roommate_id:
            requests += 1
            if alloc_dict.get(s.id) == alloc_dict.get(s.requested_roommate_id):
                roommate_success += 1
                
    roommate_rate = round((roommate_success / requests * 100), 1) if requests > 0 else 100.0
    pref_rate = round((pref_success / total_students * 100), 1) if total_students > 0 else 100.0
    
    room_counts = {}
    for a in allocs:
        room_counts[a.room_id] = room_counts.get(a.room_id, 0) + 1
        
    capacity_violations = 0
    for r in rooms:
        count = room_counts.get(r.id, 0)
        if count > r.max_capacity:
            capacity_violations += (count - r.max_capacity)
            
    hard_violations = gender_violations + capacity_violations + accessibility_violations
    
    # Calculate holistic satisfaction index (0-100%)
    satisfaction = (
        (roommate_rate * 0.45) + 
        (pref_rate * 0.35) + 
        (max(0, 100 - (hard_violations * 20)) * 0.20)
    )
    satisfaction_index = round(min(100.0, max(0.0, satisfaction)), 1)
            
    return {
        "placed_students": placed,
        "total_students": total_students,
        "total_capacity": total_capacity,
        "occupancy_rate": occupancy_rate,
        "roommate_success_rate": roommate_rate,
        "pref_room_success_rate": pref_rate,
        "capacity_violations": capacity_violations,
        "gender_violations": gender_violations,
        "accessibility_violations": accessibility_violations,
        "hard_violations": hard_violations,
        "satisfaction_index": satisfaction_index
    }

@app.post("/api/manual-assign")
def manual_assign(req: ManualAssignRequest, db: Session = Depends(get_db)):
    """Admin Manual Override: Move a student to a target room with real-time constraint validation"""
    student = db.query(Student).filter(Student.id == req.student_id).first()
    room = db.query(Room).filter(Room.id == req.target_room_id).first()
    
    if not student or not room:
        raise HTTPException(status_code=404, detail="Student or Room not found")
        
    # Check current occupants of target room
    current_occupants = db.query(Allocation).filter(Allocation.room_id == room.id).count()
    
    warnings = []
    if student.gender != room.designated_gender:
        warnings.append(f"Gender mismatch: Student is {student.gender}, but room is designated for {room.designated_gender}")
    if current_occupants >= room.max_capacity:
        warnings.append(f"Room capacity exceeded: Room is already at full capacity ({current_occupants}/{room.max_capacity})")
    if student.needs_accessible and room.is_accessible == 0:
        warnings.append("Accessibility warning: Student requires accessible/ground-floor room, but this room is on floor " + str(room.floor))

    # Update or create allocation
    alloc = db.query(Allocation).filter(Allocation.student_id == student.id).first()
    if alloc:
        alloc.room_id = room.id
    else:
        alloc = Allocation(student_id=student.id, room_id=room.id)
        db.add(alloc)
    db.commit()

    return {
        "success": True,
        "message": f"Assigned {student.name} to Room #{room.id} ({room.block_floor})",
        "warnings": warnings,
        "has_violations": len(warnings) > 0
    }

@app.get("/api/export-allocations-csv")
def export_allocations_csv(db: Session = Depends(get_db)):
    """Export current allocations to a downloadable CSV"""
    results = db.query(Allocation, Student, Room)\
        .join(Student, Allocation.student_id == Student.id)\
        .join(Room, Allocation.room_id == Room.id)\
        .order_by(Room.block_floor, Room.id)\
        .all()
        
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Student ID", "Student Name", "Gender", "Academic Year", "Department",
        "Preferred Room Type", "Requested Roommate ID", "Sleep Schedule", "Study Habit",
        "Cleanliness", "Needs Accessible", "Assigned Room ID", "Block & Floor",
        "Room Type", "Room Designated Gender", "Room Max Capacity", "Is Accessible", "Constraint Status"
    ])
    
    for allocation, student, room in results:
        status = "PASSED"
        if student.gender != room.designated_gender or (student.needs_accessible and room.is_accessible == 0):
            status = "HARD_CONSTRAINT_VIOLATION"
            
        writer.writerow([
            student.id, student.name, student.gender, student.academic_year, student.department,
            student.preferred_room_type, student.requested_roommate_id or "None",
            student.sleep_schedule, student.study_habit, student.cleanliness,
            "Yes" if student.needs_accessible else "No",
            room.id, room.block_floor, room.room_type, room.designated_gender,
            room.max_capacity, "Yes" if room.is_accessible else "No", status
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dormgen_allocation_report.csv"}
    )

@app.post("/api/reset-seed")
def reset_seed():
    """Reseed database with fresh data"""
    seed_data.seed()
    return {"message": "Database successfully reseeded with 100 students and 50 rooms."}
