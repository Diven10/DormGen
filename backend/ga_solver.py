import random
import numpy as np
from sqlalchemy.orm import Session
from models import Student, Room

class GASolver:
    def __init__(self, db: Session, pop_size=60, max_generations=150, mutation_rate=0.08, elitism_count=3):
        self.db = db
        self.pop_size = pop_size
        self.max_generations = max_generations
        self.base_mutation_rate = mutation_rate
        self.mutation_rate = mutation_rate
        self.elitism_count = max(2, min(elitism_count, pop_size // 4))
        
        self.students = self.db.query(Student).order_by(Student.id).all()
        self.rooms = self.db.query(Room).all()
        
        self.student_idx = {s.id: idx for idx, s in enumerate(self.students)}
        self.room_dict = {r.id: r for r in self.rooms}
        self.student_dict = {s.id: s for s in self.students}
        self.room_ids = [r.id for r in self.rooms]

        # Gender & Accessibility index caches for Smart Initialization
        self.male_rooms = [r.id for r in self.rooms if r.designated_gender == 'M']
        self.female_rooms = [r.id for r in self.rooms if r.designated_gender == 'F']
        self.male_acc_rooms = [r.id for r in self.rooms if r.designated_gender == 'M' and r.is_accessible == 1]
        self.female_acc_rooms = [r.id for r in self.rooms if r.designated_gender == 'F' and r.is_accessible == 1]
        
        # Pre-compute mutual roommate lookups
        self.mutual_roommates = set()
        for s in self.students:
            if s.requested_roommate_id:
                other = self.student_dict.get(s.requested_roommate_id)
                if other and other.requested_roommate_id == s.id:
                    self.mutual_roommates.add(tuple(sorted((s.id, other.id))))

    def _init_population(self):
        """Smart Initialization: Gender-aware and Accessibility-aware to eliminate Gen-0 hard violations"""
        population = []
        for _ in range(self.pop_size):
            chromosome = []
            for s in self.students:
                if s.gender == 'M':
                    if s.needs_accessible and self.male_acc_rooms:
                        room_id = random.choice(self.male_acc_rooms)
                    else:
                        room_id = random.choice(self.male_rooms)
                else:
                    if s.needs_accessible and self.female_acc_rooms:
                        room_id = random.choice(self.female_acc_rooms)
                    else:
                        room_id = random.choice(self.female_rooms)
                chromosome.append(room_id)
            population.append(chromosome)
        return population

    def _calculate_fitness_and_metrics(self, chromosome):
        penalty = 0
        hard_violations = 0
        
        room_occupants = {r: [] for r in self.room_ids}
        room_counts = {r: 0 for r in self.room_ids}
        
        roommate_req_count = 0
        roommate_req_fulfilled = 0
        pref_room_count = len(self.students)
        pref_room_fulfilled = 0
        
        for idx, room_id in enumerate(chromosome):
            student = self.students[idx]
            room = self.room_dict[room_id]
            
            room_counts[room_id] += 1
            room_occupants[room_id].append(student)
            
            # --- Hard Constraint: Gender Match ---
            if student.gender != room.designated_gender:
                penalty -= 10000
                hard_violations += 1
                
            # --- Hard Constraint: Accessibility (PWD) ---
            if student.needs_accessible and room.is_accessible == 0:
                penalty -= 5000
                hard_violations += 1
                
            # --- Soft Constraint: Preferred Room Type ---
            if student.preferred_room_type == room.room_type:
                penalty += 20
                pref_room_fulfilled += 1
            else:
                penalty -= 10
                
            # --- Soft Constraint: Roommate Requests ---
            if student.requested_roommate_id:
                roommate_req_count += 1
                req_idx = self.student_idx.get(student.requested_roommate_id)
                if req_idx is not None and req_idx < len(chromosome):
                    is_mutual = tuple(sorted((student.id, student.requested_roommate_id))) in self.mutual_roommates
                    if chromosome[req_idx] == room_id:
                        penalty += 120 if is_mutual else 45
                        roommate_req_fulfilled += 1
                    else:
                        penalty -= 40 if is_mutual else 15

        # --- Room Level Constraints ---
        lifestyle_matches = 0
        lifestyle_comparisons = 0
        
        for room_id, count in room_counts.items():
            room = self.room_dict[room_id]
            
            # Hard Constraint: Capacity
            if count > room.max_capacity:
                overflow = count - room.max_capacity
                penalty -= 10000 * overflow
                hard_violations += overflow
                
            occupants = room_occupants[room_id]
            if len(occupants) > 1:
                # Academic Year Cohort Grouping
                years = [o.academic_year for o in occupants]
                if len(set(years)) == 1:
                    penalty += 25
                else:
                    penalty -= 10
                    
                # Lifestyle & Habits Pairwise Checks
                for i in range(len(occupants)):
                    for j in range(i + 1, len(occupants)):
                        lifestyle_comparisons += 1
                        o1 = occupants[i]
                        o2 = occupants[j]
                        
                        # Sleep Schedule
                        if o1.sleep_schedule == o2.sleep_schedule:
                            penalty += 20
                            lifestyle_matches += 1
                        elif (o1.sleep_schedule == 'Night Owl' and o2.sleep_schedule == 'Early Bird') or \
                             (o1.sleep_schedule == 'Early Bird' and o2.sleep_schedule == 'Night Owl'):
                            penalty -= 25  # Severe lifestyle conflict
                        
                        # Study Habit
                        if o1.study_habit == o2.study_habit:
                            penalty += 15
                            lifestyle_matches += 1
                            
                        # Cleanliness
                        if o1.cleanliness == o2.cleanliness:
                            penalty += 15
                            lifestyle_matches += 1
                        elif (o1.cleanliness == 'Strict' and o2.cleanliness == 'Relaxed') or \
                             (o1.cleanliness == 'Relaxed' and o2.cleanliness == 'Strict'):
                            penalty -= 15
                            
                        # Department Cohesion
                        if o1.department == o2.department:
                            penalty += 10

        roommate_rate = round((roommate_req_fulfilled / roommate_req_count * 100), 1) if roommate_req_count > 0 else 100.0
        pref_rate = round((pref_room_fulfilled / pref_room_count * 100), 1)
        lifestyle_rate = round((lifestyle_matches / max(1, lifestyle_comparisons * 3) * 100), 1)

        metrics = {
            "hard_violations": hard_violations,
            "roommate_satisfaction": roommate_rate,
            "room_preference_satisfaction": pref_rate,
            "lifestyle_score": lifestyle_rate,
            "fitness": penalty
        }
        return penalty, metrics

    def _tournament_selection(self, population, fitnesses, k=5):
        selected_indices = random.sample(range(len(population)), k)
        best_idx = max(selected_indices, key=lambda idx: fitnesses[idx])
        return population[best_idx]

    def _crossover(self, parent1, parent2):
        pt = random.randint(1, len(parent1) - 1)
        child1 = parent1[:pt] + parent2[pt:]
        child2 = parent2[:pt] + parent1[pt:]
        return child1, child2

    def _mutate(self, chromosome):
        if random.random() < self.mutation_rate:
            idx1 = random.randint(0, len(chromosome) - 1)
            gender1 = self.students[idx1].gender
            
            same_gender_indices = [i for i, s in enumerate(self.students) if s.gender == gender1 and i != idx1]
            if same_gender_indices:
                idx2 = random.choice(same_gender_indices)
                chromosome[idx1], chromosome[idx2] = chromosome[idx2], chromosome[idx1]
        return chromosome

    def _local_search_refine(self, chromosome):
        """Memetic step: Local search hill-climbing to balance capacities and fix mutual pairs"""
        refined = list(chromosome)
        
        # 1. Resolve room overflow by moving to an under-capacity room of same gender
        room_counts = {}
        for r_id in refined:
            room_counts[r_id] = room_counts.get(r_id, 0) + 1
            
        for idx, r_id in enumerate(refined):
            room = self.room_dict[r_id]
            if room_counts[r_id] > room.max_capacity:
                student = self.students[idx]
                candidate_rooms = self.male_rooms if student.gender == 'M' else self.female_rooms
                if student.needs_accessible:
                    acc_candidates = [r for r in candidate_rooms if self.room_dict[r].is_accessible == 1]
                    if acc_candidates:
                        candidate_rooms = acc_candidates
                        
                for cand_id in candidate_rooms:
                    if room_counts.get(cand_id, 0) < self.room_dict[cand_id].max_capacity:
                        room_counts[r_id] -= 1
                        room_counts[cand_id] = room_counts.get(cand_id, 0) + 1
                        refined[idx] = cand_id
                        break
                        
        # 2. Check mutual roommate requests
        for s1_id, s2_id in self.mutual_roommates:
            idx1 = self.student_idx[s1_id]
            idx2 = self.student_idx[s2_id]
            r1 = refined[idx1]
            r2 = refined[idx2]
            if r1 != r2:
                # If room r1 has capacity, move s2 into r1
                if room_counts.get(r1, 0) < self.room_dict[r1].max_capacity:
                    room_counts[r2] -= 1
                    room_counts[r1] += 1
                    refined[idx2] = r1
                elif room_counts.get(r2, 0) < self.room_dict[r2].max_capacity:
                    room_counts[r1] -= 1
                    room_counts[r2] += 1
                    refined[idx1] = r2

        return refined

    def solve_stream(self):
        """Generator that yields progress events for each generation (for Server-Sent Events / WebSockets)"""
        population = self._init_population()
        best_chromosome = None
        best_fitness = float('-inf')
        best_metrics = {}
        stagnant_gens = 0

        for generation in range(self.max_generations):
            evaluated = [self._calculate_fitness_and_metrics(chrom) for chrom in population]
            fitnesses = [e[0] for e in evaluated]
            
            max_fit_idx = np.argmax(fitnesses)
            gen_best_fit = fitnesses[max_fit_idx]
            
            if gen_best_fit > best_fitness:
                best_fitness = gen_best_fit
                best_chromosome = list(population[max_fit_idx])
                best_metrics = evaluated[max_fit_idx][1]
                stagnant_gens = 0
                self.mutation_rate = self.base_mutation_rate
            else:
                stagnant_gens += 1
                # Adaptive mutation: boost mutation rate if stagnant
                if stagnant_gens >= 10:
                    self.mutation_rate = min(0.35, self.base_mutation_rate * 2.0)

            # Memetic local search on top chromosome periodically
            if (generation + 1) % 25 == 0 or generation == self.max_generations - 1:
                refined = self._local_search_refine(best_chromosome)
                ref_fit, ref_metrics = self._calculate_fitness_and_metrics(refined)
                if ref_fit > best_fitness:
                    best_fitness = ref_fit
                    best_chromosome = refined
                    best_metrics = ref_metrics

            progress_data = {
                "generation": generation + 1,
                "best_fitness": int(best_fitness),
                "avg_fitness": int(np.mean(fitnesses)),
                "hard_violations": best_metrics.get("hard_violations", 0),
                "roommate_satisfaction": best_metrics.get("roommate_satisfaction", 0),
                "room_preference_satisfaction": best_metrics.get("room_preference_satisfaction", 0),
                "lifestyle_score": best_metrics.get("lifestyle_score", 0),
                "mutation_rate": round(self.mutation_rate, 3)
            }
            yield {"type": "progress", "data": progress_data}

            # Elitism: retain top individuals
            sorted_indices = np.argsort(fitnesses)[::-1]
            elites = [population[i] for i in sorted_indices[:self.elitism_count]]

            new_population = list(elites)
            while len(new_population) < self.pop_size:
                p1 = self._tournament_selection(population, fitnesses)
                p2 = self._tournament_selection(population, fitnesses)
                c1, c2 = self._crossover(p1, p2)
                c1 = self._mutate(c1)
                c2 = self._mutate(c2)
                new_population.extend([c1, c2])

            population = new_population[:self.pop_size]

        # Final local search polish
        final_chromosome = self._local_search_refine(best_chromosome)
        final_fit, final_metrics = self._calculate_fitness_and_metrics(final_chromosome)
        if final_fit >= best_fitness:
            best_chromosome = final_chromosome
            best_fitness = final_fit
            best_metrics = final_metrics

        yield {
            "type": "completed",
            "best_chromosome": best_chromosome,
            "best_fitness": int(best_fitness),
            "best_metrics": best_metrics
        }

    def solve(self):
        """Synchronous solver"""
        return self._run_full()

    def _run_full(self):
        population = self._init_population()
        best_chromosome = None
        best_fitness = float('-inf')
        best_metrics = {}
        history = []
        stagnant_gens = 0

        for generation in range(self.max_generations):
            evaluated = [self._calculate_fitness_and_metrics(chrom) for chrom in population]
            fitnesses = [e[0] for e in evaluated]
            
            max_fit_idx = np.argmax(fitnesses)
            gen_best_fit = fitnesses[max_fit_idx]
            
            if gen_best_fit > best_fitness:
                best_fitness = gen_best_fit
                best_chromosome = list(population[max_fit_idx])
                best_metrics = evaluated[max_fit_idx][1]
                stagnant_gens = 0
                self.mutation_rate = self.base_mutation_rate
            else:
                stagnant_gens += 1
                if stagnant_gens >= 10:
                    self.mutation_rate = min(0.35, self.base_mutation_rate * 2.0)

            history.append({
                "generation": generation + 1,
                "best_fitness": int(best_fitness),
                "avg_fitness": int(np.mean(fitnesses)),
                "hard_violations": best_metrics.get("hard_violations", 0),
                "roommate_satisfaction": best_metrics.get("roommate_satisfaction", 0),
                "room_preference_satisfaction": best_metrics.get("room_preference_satisfaction", 0),
                "lifestyle_score": best_metrics.get("lifestyle_score", 0),
                "mutation_rate": round(self.mutation_rate, 3)
            })

            # Elitism
            sorted_indices = np.argsort(fitnesses)[::-1]
            elites = [population[i] for i in sorted_indices[:self.elitism_count]]

            new_population = list(elites)
            while len(new_population) < self.pop_size:
                p1 = self._tournament_selection(population, fitnesses)
                p2 = self._tournament_selection(population, fitnesses)
                c1, c2 = self._crossover(p1, p2)
                c1 = self._mutate(c1)
                c2 = self._mutate(c2)
                new_population.extend([c1, c2])

            population = new_population[:self.pop_size]

        final_chrom = self._local_search_refine(best_chromosome)
        final_fit, final_metrics = self._calculate_fitness_and_metrics(final_chrom)
        if final_fit >= best_fitness:
            best_chromosome = final_chrom
            best_fitness = final_fit
            best_metrics = final_metrics

        return best_chromosome, best_fitness, history, best_metrics
