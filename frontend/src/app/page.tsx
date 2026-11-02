import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, LayoutDashboard, ShieldCheck, Settings, Users, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            DormGen
          </div>
          <Link href="/dashboard">
            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-medium text-sm transition-colors shadow-sm">
              Open Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 fill-indigo-500" /> Powered by Genetic Algorithms
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Intelligent Hostel <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">
              Room Allocation.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            DormGen eliminates the headache of manual room assignments. We balance strict gender constraints, room capacities, and student roommate preferences using advanced evolutionary AI.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/dashboard">
              <button className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-full font-semibold transition-all hover:scale-105 shadow-xl shadow-slate-900/10">
                <LayoutDashboard className="w-5 h-5" /> Try the AI Dashboard
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* The Problem & Solution Section */}
      <section className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">The Combinatorial Nightmare</h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                Assigning 1,000 students to 500 rooms isn't just difficult; mathematically, there are more possible combinations than atoms in the universe. Traditional rule-based systems constantly break or get stuck in conflicting constraints.
              </p>
              <ul className="space-y-4">
                <li className="flex gap-3 text-slate-700">
                  <ShieldCheck className="w-6 h-6 text-red-500 shrink-0" />
                  <span><strong>Hard Constraints:</strong> No capacity overflow. Strict gender segregation per room block.</span>
                </li>
                <li className="flex gap-3 text-slate-700">
                  <Users className="w-6 h-6 text-amber-500 shrink-0" />
                  <span><strong>Soft Constraints:</strong> Fulfill mutual roommate requests and respect room type preferences (AC vs Non-AC).</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-900">
                <BrainCircuit className="w-64 h-64" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10">The Genetic Algorithm Solution</h3>
              <p className="text-slate-600 mb-6 relative z-10">
                DormGen relies on a "Survival of the Fittest" algorithm:
              </p>
              <div className="space-y-4 relative z-10">
                <div className="bg-white p-4 rounded-xl shadow-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">1</div>
                  <div>
                    <h4 className="font-bold text-slate-900">Generate Population</h4>
                    <p className="text-sm text-slate-500">Creates hundreds of random room schedules.</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">2</div>
                  <div>
                    <h4 className="font-bold text-slate-900">Evaluate Fitness</h4>
                    <p className="text-sm text-slate-500">Penalizes broken rules & rewards fulfilled preferences.</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">3</div>
                  <div>
                    <h4 className="font-bold text-slate-900">Crossover & Mutate</h4>
                    <p className="text-sm text-slate-500">Breeds the best schedules and swaps students to avoid dead ends.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Enterprise Grade Features</h2>
            <p className="text-slate-600 mt-4">Everything you need to manage your university accommodations.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 mb-6">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Live Algorithm Controls</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Tune the population size, max generations, and mutation rate directly from the dashboard to optimize solver speed vs accuracy.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Visualization</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Watch the AI learn. Monitor the fitness curve as it climbs out of negative penalties into a perfect zero-conflict allocation.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 mb-6">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Interactive Floor Maps</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Switch from a flat data table to a grid-based floor map view. See exact capacity utilization and student assignments per room.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / CTA */}
      <footer className="bg-slate-900 text-slate-400 py-16 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-white text-3xl font-bold mb-6">Ready to optimize your campus?</h2>
          <Link href="/dashboard">
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-bold transition-all shadow-lg shadow-indigo-600/20">
              Launch DormGen Optimizer
            </button>
          </Link>
          <div className="mt-16 flex items-center justify-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-slate-300">DormGen</span> © {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
