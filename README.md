# 🏢 DormGen - AI-Powered Hostel Room Allocation Engine

> **Intelligent, multi-constraint hostel room allocation powered by Genetic Algorithms (GA), FastAPI, and Next.js.**

![DormGen Banner](https://img.shields.io/badge/Optimization-Genetic_Algorithm-blue?style=for-the-badge&logo=dna)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)
![Next.js](https://img.shields.io/badge/Frontend-Next.js_15-black?style=for-the-badge&logo=next.js)
![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

---

## 📌 Problem Overview
Allocating hundreds of students to hostel rooms is an **NP-hard combinatorial optimization problem**. For $100$ students and $50$ rooms, the search space contains over $50^{100} \approx 10^{170}$ possible assignments—far greater than the number of atoms in the observable universe. 

Standard rule-based systems frequently get stuck in conflicting constraints. **DormGen** leverages an integer-encoded **Genetic Algorithm with penalty-based constraint evaluation, elitism, adaptive mutation, and memetic local search** to reach a zero-hard-violation, high-satisfaction allocation in seconds.

---

## ✨ Key Features

### 🧬 Enhanced Genetic Algorithm Solver
- **Integer-Encoded Chromosome**: 1D array mapping `Student ID` $\rightarrow$ `Room ID` ensuring every student is assigned to exactly one room.
- **Strict Hard Constraints (Heavy Penalties)**:
  - 🚫 Gender segregation per designated room.
  - 🚫 Room maximum bed capacity.
  - ♿ Ground-floor / accessibility priority for differently-abled (PWD) students.
- **Soft Constraints (Optimization Objectives)**:
  - 🤝 Mutual roommate requests ($+120$ pts) vs unilateral requests ($+45$ pts).
  - 🛏️ Preferred room type match (Single, Double, AC, Non-AC).
  - 🌙 Lifestyle compatibility matching (Night Owl / Early Bird, study habits, cleanliness).
  - 🎓 Academic year & department cohort grouping.
- **Advanced Operators**:
  - **Tournament Selection ($K=5$)**
  - **Single-Point Crossover**
  - **Constraint-Aware Same-Gender Swap Mutation**
  - **Elitism**: Retains top $3-5\%$ solutions across generations.
  - **Adaptive Mutation**: Dynamically scales mutation rate when fitness plateaus.
  - **Memetic Local Search**: 2-opt hill climbing polish for capacity & mutual pairs.

### 💻 Full-Stack Interactive Architecture
- **Interactive 2D Floor Plan Grid**: Visual architectural floor-by-floor view of rooms, occupancy meters, gender badges, and student occupants.
- **All Rooms Directory (50 Rooms)**: Complete inventory table with occupancy status (Full, Partial, Vacant, Over).
- **Live SSE Streaming Evolution**: Real-time Server-Sent Events stream generational fitness convergence to the frontend graph.
- **Admin Manual Override**: Allows wardens to reassign students with live constraint guardrails.
- **1-Click CSV Export**: Downloads complete allocation schedules.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide React, Recharts.
- **Backend**: Python 3.10+, FastAPI, NumPy, Uvicorn, Pydantic.
- **Database & ORM**: SQLite, SQLAlchemy.
- **Communication Protocol**: REST APIs + Server-Sent Events (SSE).

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/Diven10/DormGen.git
cd DormGen
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed the database
python seed_data.py

# Start the FastAPI server
uvicorn main:app --reload --port 8001
```
* Backend API & Swagger Docs: [http://localhost:8001/docs](http://localhost:8001/docs)

### 3. Frontend Setup
```bash
# In a new terminal tab:
cd frontend

# Install packages
npm install

# Start Next.js development server
npm run dev -- -p 3001
```
* Web Application: [http://localhost:3001](http://localhost:3001)
* Optimizer Dashboard: [http://localhost:3001/dashboard](http://localhost:3001/dashboard)

---

## 📂 Project Structure
```
DormGen/
├── backend/
│   ├── main.py              # FastAPI endpoints, SSE streaming, manual override
│   ├── ga_solver.py         # Genetic Algorithm core (crossover, mutation, local search)
│   ├── models.py            # SQLAlchemy models (Student, Room, Allocation)
│   ├── seed_data.py         # Realistic mock dataset generator (100 students, 50 rooms)
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx            # Public landing page explaining the problem
│   │       ├── dashboard/page.tsx  # Analytics dashboard, floor plan, controls
│   │       ├── layout.tsx
│   │       └── globals.css
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

## 📜 License
This project is open source and available under the [MIT License](LICENSE).
