import random
from faker import Faker
from models import SessionLocal, init_db, Base, engine, Student, Room, Allocation

fake = Faker()

def seed():
    # Recreate tables with updated schema
    Base.metadata.drop_all(bind=engine)
    init_db()
    
    db = SessionLocal()

    room_types = ['Single', 'Double', 'AC', 'Non-AC']
    blocks = ['Block A', 'Block B', 'Block C']
    departments = ['Computer Science', 'Mechanical Eng', 'Electrical Eng', 'Business Admin', 'Bio Engineering']
    sleep_schedules = ['Night Owl', 'Early Bird', 'Flexible']
    study_habits = ['Quiet', 'Group Study', 'Music']
    cleanliness_levels = ['Strict', 'Moderate', 'Relaxed']

    # Generate 50 rooms (ensuring total capacity > 100 and balanced genders)
    # 25 Male rooms, 25 Female rooms
    rooms = []
    
    for i in range(1, 51):
        block = random.choice(blocks)
        floor = random.randint(1, 4)
        block_floor = f"{block}-{floor}"
        
        # Ground floor (floor 1) rooms are accessible
        is_accessible = 1 if floor == 1 else 0
        
        # Alternating gender designations to ensure exact balance
        designated_gender = 'M' if i <= 25 else 'F'
        
        # Realistic room capacity distribution (averages 2.5 beds per room -> ~125 total capacity)
        if i % 5 == 0:
            capacity = 1
            rtype = 'Single'
        elif i % 2 == 0:
            capacity = 2
            rtype = random.choice(['Double', 'AC'])
        else:
            capacity = 3
            rtype = random.choice(['Double', 'Non-AC', 'AC'])

        room = Room(
            block_floor=block_floor,
            max_capacity=capacity,
            designated_gender=designated_gender,
            room_type=rtype,
            floor=floor,
            is_accessible=is_accessible
        )
        db.add(room)
        rooms.append(room)
        
    db.commit()

    # Generate 100 students (50 Male, 50 Female)
    students = []
    for i in range(1, 101):
        gender = 'M' if i <= 50 else 'F'
        name = fake.name_male() if gender == 'M' else fake.name_female()
        
        # ~8% have accessibility / PWD ground-floor needs
        needs_acc = 1 if i in [3, 14, 28, 42, 61, 75, 89] else 0
        
        student = Student(
            name=name,
            gender=gender,
            academic_year=random.randint(1, 4),
            department=random.choice(departments),
            preferred_room_type=random.choice(room_types),
            requested_roommate_id=None,
            sleep_schedule=random.choice(sleep_schedules),
            study_habit=random.choice(study_habits),
            cleanliness=random.choice(cleanliness_levels),
            needs_accessible=needs_acc
        )
        db.add(student)
        students.append(student)
        
    db.commit()

    # Refresh to get IDs
    for s in students:
        db.refresh(s)

    male_students = [s for s in students if s.gender == 'M']
    female_students = [s for s in students if s.gender == 'F']

    # Create 10 Mutual Roommate pairs (5 male pairs, 5 female pairs)
    for pair_pool in [male_students[:10], female_students[:10]]:
        for idx in range(0, len(pair_pool), 2):
            s1 = pair_pool[idx]
            s2 = pair_pool[idx + 1]
            s1.requested_roommate_id = s2.id
            s2.requested_roommate_id = s1.id

    # Create 8 Unilateral Roommate requests (students who requested a friend, but friend didn't request them back)
    for s_from, s_to in [
        (male_students[12], male_students[15]),
        (male_students[18], male_students[20]),
        (male_students[22], male_students[25]),
        (male_students[30], male_students[35]),
        (female_students[12], female_students[15]),
        (female_students[18], female_students[20]),
        (female_students[22], female_students[25]),
        (female_students[30], female_students[35]),
    ]:
        s_from.requested_roommate_id = s_to.id

    db.commit()

    total_cap = sum(r.max_capacity for r in rooms)
    print(f"Seeded database: {len(students)} students, {len(rooms)} rooms, total capacity: {total_cap} beds.")
    db.close()

if __name__ == '__main__':
    seed()
