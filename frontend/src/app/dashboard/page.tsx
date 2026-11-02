"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Users, Activity, ShieldCheck, Download, RefreshCw, Play, 
  LayoutGrid, Table as TableIcon, Building2, CheckCircle2, 
  AlertTriangle, Search, Bed, Zap, Heart, ArrowLeft, SlidersHorizontal, UserCheck,
  DoorOpen
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

interface AllocationResult {
  student_id: number;
  student_name: string;
  student_gender: string;
  academic_year: number;
  department: string;
  sleep_schedule: string;
  study_habit: string;
  cleanliness: string;
  needs_accessible: number;
  preferred_room_type: string;
  requested_roommate_id: number | null;
  roommate_fulfilled: boolean | null;
  room_id: number;
  block_floor: string;
  room_type: string;
  room_gender: string;
  floor: number;
  is_accessible: number;
  room_max_capacity: number;
  current_occupants: number;
  gender_match: boolean;
  capacity_ok: boolean;
  accessible_ok: boolean;
  type_match: boolean;
  constraint_passed: boolean;
}

interface Room {
  id: number;
  block_floor: string;
  max_capacity: number;
  designated_gender: string;
  room_type: string;
  floor: number;
  is_accessible: number;
}

interface Student {
  id: number;
  name: string;
  gender: string;
  academic_year: number;
  department: string;
  preferred_room_type: string;
  requested_roommate_id: number | null;
  sleep_schedule: string;
  study_habit: string;
  cleanliness: string;
  needs_accessible: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AllocationResult[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  
  // View controls: 'table' (students) | 'rooms' (all 50 rooms directory) | 'floorplan' (2D visual grid)
  const [activeTab, setActiveTab] = useState<'table' | 'rooms' | 'floorplan'>('rooms');
  const [selectedBlock, setSelectedBlock] = useState<string>('ALL');
  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [issueFilter, setIssueFilter] = useState('ALL');
  const [roomOccupancyFilter, setRoomOccupancyFilter] = useState('ALL');

  // GA Parameters
  const [popSize, setPopSize] = useState(60);
  const [generations, setGenerations] = useState(150);
  const [mutationRate, setMutationRate] = useState(0.08);
  const [elitism, setElitism] = useState(3);
  const [isStreaming, setIsStreaming] = useState(true);

  // Manual Override State
  const [overrideStudentId, setOverrideStudentId] = useState<number | null>(null);
  const [overrideRoomId, setOverrideRoomId] = useState<number | null>(null);
  const [overrideMsg, setOverrideMsg] = useState<{ text: string, type: 'success' | 'warn' | 'error' } | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const fetchData = async () => {
    try {
      const [resResults, resRooms, resStudents, resMetrics] = await Promise.all([
        fetch(`${API_BASE}/api/results`),
        fetch(`${API_BASE}/api/rooms`),
        fetch(`${API_BASE}/api/students`),
        fetch(`${API_BASE}/api/metrics`)
      ]);
      const dataResults = await resResults.json();
      const dataRooms = await resRooms.json();
      const dataStudents = await resStudents.json();
      const dataMetrics = await resMetrics.json();
      
      setResults(dataResults);
      setRooms(dataRooms);
      setStudents(dataStudents);
      setMetrics(dataMetrics);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Run Optimizer (with choice of live SSE streaming or fast batch)
  const runAlgorithm = async () => {
    setLoading(true);
    setHistory([]);

    if (isStreaming) {
      try {
        const url = `${API_BASE}/api/stream-allocation?pop_size=${popSize}&generations=${generations}&mutation_rate=${mutationRate}&elitism=${elitism}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = async (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.type === "progress") {
              setHistory((prev) => [...prev, parsed.data]);
            } else if (parsed.type === "completed" || parsed.type === "end") {
              eventSource.close();
              await fetchData();
              setLoading(false);
            }
          } catch (err) {
            console.error("SSE parse error", err);
          }
        };

        eventSource.onerror = async () => {
          eventSource.close();
          await fetchData();
          setLoading(false);
        };
      } catch (err) {
        console.error("Streaming error:", err);
        setLoading(false);
      }
    } else {
      try {
        const res = await fetch(`${API_BASE}/api/run-allocation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pop_size: popSize, generations, mutation_rate: mutationRate, elitism })
        });
        const data = await res.json();
        setHistory(data.history || []);
        await fetchData();
      } catch (error) {
        console.error("Failed to run algorithm:", error);
        alert("Error running algorithm. Check if backend is reachable.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleManualAssign = async () => {
    if (!overrideStudentId || !overrideRoomId) {
      setOverrideMsg({ text: "Select both a student and a room", type: "error" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/manual-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: overrideStudentId, target_room_id: overrideRoomId })
      });
      const data = await res.json();
      if (data.warnings && data.warnings.length > 0) {
        setOverrideMsg({ text: `Assigned with warnings: ${data.warnings.join(", ")}`, type: "warn" });
      } else {
        setOverrideMsg({ text: data.message, type: "success" });
      }
      await fetchData();
    } catch (err) {
      setOverrideMsg({ text: "Assignment failed", type: "error" });
    }
  };

  const handleResetData = async () => {
    if (!confirm("Reseed sample dataset with 100 students and 50 rooms?")) return;
    try {
      await fetch(`${API_BASE}/api/reset-seed`, { method: "POST" });
      await fetchData();
      setHistory([]);
      alert("Sample data reset successfully.");
    } catch (e) {
      alert("Failed to reset sample data.");
    }
  };

  // Derived Metrics
  const totalStudents = students.length;
  const allocatedStudents = results.length;
  const unallocatedStudents = totalStudents - allocatedStudents;
  const allocatedPercentage = totalStudents > 0 ? Math.round((allocatedStudents / totalStudents) * 100) : 0;
  const unallocatedPercentage = totalStudents > 0 ? Math.round((unallocatedStudents / totalStudents) * 100) : 0;

  const totalRooms = rooms.length;
  const occupiedRoomIds = new Set(results.map(r => r.room_id));
  const roomsUtilized = occupiedRoomIds.size;
  const roomsUtilizedPercentage = totalRooms > 0 ? Math.round((roomsUtilized / totalRooms) * 100) : 0;

  // Pie Chart Data (Gender Distribution)
  const maleCount = students.filter(s => s.gender === 'M').length;
  const femaleCount = students.filter(s => s.gender === 'F').length;
  const pieData = [
    { name: 'Male', value: maleCount },
    { name: 'Female', value: femaleCount },
  ];
  const COLORS = ['#0284c7', '#0d9488'];

  // Bar Chart Data (Room Utilization by Floor)
  const floorDataMap: Record<string, { totalCapacity: number, occupied: number }> = {};
  rooms.forEach(r => {
    const floor = r.block_floor;
    if (!floorDataMap[floor]) floorDataMap[floor] = { totalCapacity: 0, occupied: 0 };
    floorDataMap[floor].totalCapacity += r.max_capacity;
  });
  results.forEach(r => {
    const floor = r.block_floor;
    if (floorDataMap[floor]) floorDataMap[floor].occupied += 1;
  });
  const barData = Object.keys(floorDataMap).sort().map(floor => ({
    name: floor,
    'Total Capacity': floorDataMap[floor].totalCapacity,
    'Occupied': floorDataMap[floor].occupied
  }));

  const currentGen = history.length > 0 ? history[history.length - 1].generation : 0;
  const bestFitness = history.length > 0 ? history[history.length - 1].best_fitness : (metrics?.hard_violations === 0 ? "Optimal" : 0);
  const satisfactionIndex = metrics?.satisfaction_index || 0;
  const hardViolations = metrics?.hard_violations ?? 0;

  // Filtered Results for Students Table View
  const filteredResults = useMemo(() => {
    return results.filter(item => {
      const matchesSearch = 
        item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.student_id.toString().includes(searchQuery) ||
        item.block_floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.room_id.toString().includes(searchQuery) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase());
        
      const matchesGender = genderFilter === 'ALL' || item.student_gender === genderFilter;
      const matchesIssue = 
        issueFilter === 'ALL' ||
        (issueFilter === 'ISSUES_ONLY' && !item.constraint_passed) ||
        (issueFilter === 'PASSED_ONLY' && item.constraint_passed);

      return matchesSearch && matchesGender && matchesIssue;
    });
  }, [results, searchQuery, genderFilter, issueFilter]);

  // Comprehensive Room Directory (all 50 rooms with their occupants)
  const allRoomsDirectory = useMemo(() => {
    return rooms.map(room => {
      const occupants = results.filter(res => res.room_id === room.id);
      const isFull = occupants.length >= room.max_capacity && occupants.length <= room.max_capacity;
      const isOver = occupants.length > room.max_capacity;
      const isEmpty = occupants.length === 0;
      const isPartial = occupants.length > 0 && occupants.length < room.max_capacity;

      let status = 'empty';
      if (isOver) status = 'over';
      else if (isFull) status = 'full';
      else if (isPartial) status = 'partial';

      return {
        ...room,
        occupants,
        status
      };
    });
  }, [rooms, results]);

  // Filtered Rooms for Rooms Directory Tab
  const filteredRooms = useMemo(() => {
    return allRoomsDirectory.filter(r => {
      const matchesSearch = 
        r.id.toString().includes(searchQuery) ||
        r.block_floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.room_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.occupants.some(o => o.student_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesGender = genderFilter === 'ALL' || r.designated_gender === genderFilter;
      
      const matchesBlock = selectedBlock === 'ALL' || r.block_floor.startsWith(selectedBlock);
      const matchesFloor = selectedFloor === 'ALL' || r.floor === Number(selectedFloor);

      const matchesOccupancy = 
        roomOccupancyFilter === 'ALL' ||
        (roomOccupancyFilter === 'FULL' && r.status === 'full') ||
        (roomOccupancyFilter === 'PARTIAL' && r.status === 'partial') ||
        (roomOccupancyFilter === 'EMPTY' && r.status === 'empty') ||
        (roomOccupancyFilter === 'OVER' && r.status === 'over');

      return matchesSearch && matchesGender && matchesBlock && matchesFloor && matchesOccupancy;
    });
  }, [allRoomsDirectory, searchQuery, genderFilter, selectedBlock, selectedFloor, roomOccupancyFilter]);

  // Floor Plan Rooms (Supports 'ALL' Blocks and 'ALL' Floors)
  const floorPlanRooms = useMemo(() => {
    return allRoomsDirectory.filter(r => {
      const matchesBlock = selectedBlock === 'ALL' || r.block_floor.startsWith(selectedBlock);
      const matchesFloor = selectedFloor === 'ALL' || r.floor === Number(selectedFloor);
      return matchesBlock && matchesFloor;
    });
  }, [allRoomsDirectory, selectedBlock, selectedFloor]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-6 flex justify-center">
      <div className="max-w-[1440px] w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* Navigation & Header */}
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">DormGen</h1>
                <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-indigo-500" /> AI Optimizer v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500">Hostel Room Allocation & Management System ({totalRooms} Total Rooms)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleResetData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reseed Data
            </button>
            <a 
              href={`${API_BASE}/api/export-allocations-csv`}
              download
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
          </div>
        </div>

        <div className="p-6">
          {/* Key Metrics Row */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Metrics</h2>
            {metrics && (
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span>Roommate Match: <strong className="text-slate-800">{metrics.roommate_success_rate}%</strong></span>
                <span>•</span>
                <span>Room Type Match: <strong className="text-slate-800">{metrics.pref_room_success_rate}%</strong></span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-600 mb-2">Total Students</div>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-bold">{totalStudents}</span>
                <Users className="w-6 h-6 text-slate-400" />
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-600 mb-2">Allocated Students</div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl font-bold">{allocatedStudents}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">{allocatedPercentage}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${allocatedPercentage}%` }}></div>
              </div>
              <div className="text-xs text-slate-500 mt-2">{allocatedPercentage}% Allocated</div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-600 mb-2">Total Rooms & Util</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-bold text-sky-600">{roomsUtilized} / {totalRooms}</span>
                  <div className="text-xs text-slate-500 mt-1">{roomsUtilizedPercentage}% Utilized</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                  <DoorOpen className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-600 mb-2">Hard Violations</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-3xl font-bold ${hardViolations === 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {hardViolations}
                  </span>
                  <div className="text-xs text-slate-500 mt-1">
                    {hardViolations === 0 ? "0 Rule Breaches" : "Violations Detected"}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hardViolations === 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-center items-center">
              <div className="text-sm font-medium text-slate-600 mb-2 w-full">Algorithm Status</div>
              <div className="flex items-center justify-between w-full">
                <span className="text-sm">Status: <span className={loading ? "text-emerald-500 font-semibold" : "text-slate-500"}>{loading ? 'Optimizing...' : 'Idle'}</span></span>
                <div className={`w-3.5 h-3.5 rounded-full ${loading ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-300'}`}></div>
              </div>
              {loading && (
                <div className="w-full text-xs text-slate-500 mt-2 font-mono">
                  Gen: {currentGen} / {generations}
                </div>
              )}
            </div>
          </div>

          {/* Visualizations Row */}
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Data Visualizations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="text-sm font-semibold mb-1">Student Demographics</div>
              <div className="text-xs text-slate-500 mb-4">Gender & Capacity Distribution</div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="text-sm font-semibold mb-1">Floor Occupancy</div>
              <div className="text-xs text-slate-500 mb-4">Total Bed Capacity vs Occupied</div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 9}} />
                    <YAxis tick={{fontSize: 9}} />
                    <RechartsTooltip />
                    <Legend iconType="square" wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="Total Capacity" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Occupied" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-semibold mb-0.5">Evolution Convergence</div>
                  <div className="text-xs text-slate-500">Real-Time Fitness Progression</div>
                </div>
                <div className="text-xs bg-slate-100 p-2 rounded text-right font-mono">
                  <div>Gen: <span className="font-bold text-slate-900">{currentGen}</span></div>
                  <div>Best Fit: <span className="font-bold text-emerald-600">{bestFitness}</span></div>
                </div>
              </div>
              <div className="h-40 w-full flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="generation" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="best_fitness" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Best Fitness" />
                    <Line type="monotone" dataKey="avg_fitness" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Avg Fitness" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom Interactive Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Columns: 3 Tabs (Rooms Directory, 2D Floor Plan, Student Table) */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              
              {/* View Switcher Tabs */}
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('rooms')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'rooms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <DoorOpen className="w-3.5 h-3.5" /> All Rooms Directory ({totalRooms})
                  </button>
                  <button 
                    onClick={() => setActiveTab('floorplan')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'floorplan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> 2D Floor Plan Grid
                  </button>
                  <button 
                    onClick={() => setActiveTab('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" /> Students Table ({allocatedStudents})
                  </button>
                </div>

                {/* Filter Controls Header */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search room #, block, student..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500 w-44 bg-white"
                    />
                  </div>

                  {activeTab !== 'table' && (
                    <>
                      <select 
                        value={selectedBlock} 
                        onChange={e => setSelectedBlock(e.target.value)}
                        className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
                      >
                        <option value="ALL">All Blocks</option>
                        <option value="Block A">Block A</option>
                        <option value="Block B">Block B</option>
                        <option value="Block C">Block C</option>
                      </select>

                      <select 
                        value={selectedFloor} 
                        onChange={e => setSelectedFloor(e.target.value)}
                        className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
                      >
                        <option value="ALL">All Floors (1-4)</option>
                        <option value="1">Floor 1 (Accessible ♿)</option>
                        <option value="2">Floor 2</option>
                        <option value="3">Floor 3</option>
                        <option value="4">Floor 4</option>
                      </select>
                    </>
                  )}

                  {activeTab === 'rooms' && (
                    <select 
                      value={roomOccupancyFilter} 
                      onChange={e => setRoomOccupancyFilter(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
                    >
                      <option value="ALL">All Occupancy</option>
                      <option value="FULL">Full Only</option>
                      <option value="PARTIAL">Partial Only</option>
                      <option value="EMPTY">Vacant / Empty</option>
                      <option value="OVER">Over Capacity</option>
                    </select>
                  )}

                  {activeTab === 'table' && (
                    <select 
                      value={genderFilter} 
                      onChange={e => setGenderFilter(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
                    >
                      <option value="ALL">All Genders</option>
                      <option value="M">Male Only</option>
                      <option value="F">Female Only</option>
                    </select>
                  )}
                </div>
              </div>

              {/* View 1: ALL 50 ROOMS DIRECTORY */}
              {activeTab === 'rooms' && (
                <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Showing <strong>{filteredRooms.length}</strong> of <strong>{totalRooms}</strong> rooms in hostel inventory</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Full</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Partial</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Empty</span>
                    </div>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-3 font-semibold text-slate-600">Room # & Block</th>
                        <th className="p-3 font-semibold text-slate-600">Designation</th>
                        <th className="p-3 font-semibold text-slate-600">Type & Feature</th>
                        <th className="p-3 font-semibold text-slate-600">Capacity</th>
                        <th className="p-3 font-semibold text-slate-600">Status</th>
                        <th className="p-3 font-semibold text-slate-600">Current Occupants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRooms.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No rooms match your filter.</td></tr>
                      ) : (
                        filteredRooms.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900 text-sm">Room #{r.id}</div>
                              <div className="text-[11px] text-slate-500">{r.block_floor}</div>
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                r.designated_gender === 'M' ? 'bg-sky-100 text-sky-700' : 'bg-pink-100 text-pink-700'
                              }`}>
                                {r.designated_gender === 'M' ? 'Male Only' : 'Female Only'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800">{r.room_type}</div>
                              <div className="text-[10px] text-slate-500">
                                {r.is_accessible === 1 ? <span className="text-blue-600 font-bold">♿ Ground Floor Accessible</span> : `Floor ${r.floor}`}
                              </div>
                            </td>
                            <td className="p-3 font-bold text-slate-700">
                              {r.occupants.length} / {r.max_capacity} Beds
                            </td>
                            <td className="p-3">
                              {r.status === 'full' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  ● Full
                                </span>
                              )}
                              {r.status === 'partial' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                  ● Available ({r.max_capacity - r.occupants.length} bed left)
                                </span>
                              )}
                              {r.status === 'empty' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  ○ Vacant
                                </span>
                              )}
                              {r.status === 'over' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                                  ⚠️ Over capacity
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {r.occupants.length === 0 ? (
                                <span className="text-slate-400 italic text-[11px]">No students assigned</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {r.occupants.map((occ, idx) => (
                                    <span key={idx} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                      {occ.student_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 2: Interactive 2D Floor Plan Grid */}
              {activeTab === 'floorplan' && (
                <div className="p-5 max-h-[440px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                    <span>Showing <strong>{floorPlanRooms.length}</strong> of <strong>{totalRooms}</strong> total rooms</span>
                    <span>Click on any room to inspect occupants</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {floorPlanRooms.map((room) => {
                      const isFull = room.occupants.length >= room.max_capacity && room.occupants.length <= room.max_capacity;
                      const isOver = room.occupants.length > room.max_capacity;
                      return (
                        <div 
                          key={room.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isOver 
                              ? 'border-red-300 bg-red-50/50' 
                              : isFull 
                              ? 'border-emerald-200 bg-emerald-50/20' 
                              : 'border-slate-200 bg-white hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-slate-900">Room #{room.id}</span>
                              <span className="text-[10px] text-slate-400">({room.block_floor})</span>
                              {room.is_accessible === 1 && (
                                <span className="text-xs" title="Wheelchair / Accessible Ground Floor">♿</span>
                              )}
                            </div>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              room.designated_gender === 'M' ? 'bg-sky-100 text-sky-700' : 'bg-pink-100 text-pink-700'
                            }`}>
                              {room.designated_gender === 'M' ? 'Male' : 'Female'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                            <span>{room.room_type}</span>
                            <span className="font-bold">{room.occupants.length} / {room.max_capacity} Beds</span>
                          </div>

                          {/* Occupants list */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            {room.occupants.length === 0 ? (
                              <div className="text-[11px] text-slate-400 italic">Empty Room</div>
                            ) : (
                              room.occupants.map((occ, idx) => (
                                <div key={idx} className="bg-white p-1.5 rounded border border-slate-100 shadow-2xs flex items-center justify-between">
                                  <div className="truncate">
                                    <div className="font-bold text-[11px] text-slate-800 truncate">{occ.student_name}</div>
                                    <div className="text-[9px] text-slate-400 truncate">{occ.department}</div>
                                  </div>
                                  {occ.needs_accessible === 1 && <span className="text-[10px]">♿</span>}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View 3: Data Table (Students) */}
              {activeTab === 'table' && (
                <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-3 font-semibold text-slate-600">Student & Dept</th>
                        <th className="p-3 font-semibold text-slate-600">Lifestyle Profile</th>
                        <th className="p-3 font-semibold text-slate-600">Room # & Type</th>
                        <th className="p-3 font-semibold text-slate-600">Block & Floor</th>
                        <th className="p-3 font-semibold text-slate-600 text-center">Roommate</th>
                        <th className="p-3 font-semibold text-slate-600 text-center">Constraint Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredResults.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No matching records found.</td></tr>
                      ) : (
                        filteredResults.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{r.student_name}</div>
                              <div className="text-[11px] text-slate-500">{r.department} • Year {r.academic_year} ({r.student_gender})</div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{r.sleep_schedule}</span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{r.study_habit}</span>
                                {r.needs_accessible === 1 && (
                                  <span className="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px]">♿ PWD</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-900">Room {r.room_id}</span>
                              <div className="text-[11px] text-slate-500">{r.room_type} ({r.current_occupants}/{r.room_max_capacity})</div>
                            </td>
                            <td className="p-3 font-medium text-slate-700">{r.block_floor}</td>
                            <td className="p-3 text-center">
                              {r.requested_roommate_id ? (
                                r.roommate_fulfilled ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    🤝 Matched
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                    Separate
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {r.constraint_passed ? (
                                <div className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded text-[11px] font-bold" title="Hard constraint broken">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Conflict
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>

            {/* Right Column: Optimizer Controls & Manual Override Drawer */}
            <div className="space-y-6">
              
              {/* Genetic Algorithm Controls */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Algorithm Controls</h2>
                    <p className="text-xs text-slate-500">Hyperparameters & Evolution Mode</p>
                  </div>
                  <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                </div>
                
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-lg">
                    <label className="text-xs font-semibold text-slate-600">Population Size</label>
                    <input 
                      type="number" 
                      value={popSize} 
                      onChange={e=>setPopSize(Number(e.target.value))} 
                      className="w-16 text-right text-xs outline-none font-bold" 
                    />
                  </div>
                  <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-lg">
                    <label className="text-xs font-semibold text-slate-600">Max Generations</label>
                    <input 
                      type="number" 
                      value={generations} 
                      onChange={e=>setGenerations(Number(e.target.value))} 
                      className="w-16 text-right text-xs outline-none font-bold" 
                    />
                  </div>
                  <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-lg">
                    <label className="text-xs font-semibold text-slate-600">Mutation Rate</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={mutationRate} 
                      onChange={e=>setMutationRate(Number(e.target.value))} 
                      className="w-16 text-right text-xs outline-none font-bold" 
                    />
                  </div>
                  <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-lg">
                    <label className="text-xs font-semibold text-slate-600">Elitism Count</label>
                    <input 
                      type="number" 
                      value={elitism} 
                      onChange={e=>setElitism(Number(e.target.value))} 
                      className="w-16 text-right text-xs outline-none font-bold" 
                    />
                  </div>

                  <div className="flex items-center justify-between p-2">
                    <span className="text-xs font-medium text-slate-600">Live Real-Time Stream</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isStreaming} 
                        onChange={e => setIsStreaming(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                <button 
                  onClick={runAlgorithm}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold text-xs py-3.5 rounded-lg shadow-sm transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  {loading ? "Simulating Evolution..." : "Run Allocation Optimizer"}
                </button>
              </div>

              {/* Admin Manual Override Card */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Admin Manual Override</h2>
                    <p className="text-xs text-slate-500">Relocate student with constraint guardrails</p>
                  </div>
                  <UserCheck className="w-4 h-4 text-slate-400" />
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Select Student</label>
                    <select 
                      value={overrideStudentId || ''} 
                      onChange={e => setOverrideStudentId(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 bg-white p-2 rounded-lg outline-none"
                    >
                      <option value="">Choose a student...</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          #{s.id} {s.name} ({s.gender}) - {s.department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Room</label>
                    <select 
                      value={overrideRoomId || ''} 
                      onChange={e => setOverrideRoomId(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 bg-white p-2 rounded-lg outline-none"
                    >
                      <option value="">Choose target room...</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>
                          Room #{r.id} ({r.block_floor} • {r.designated_gender} • Cap: {r.max_capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {overrideMsg && (
                  <div className={`p-2.5 rounded text-xs mb-3 font-medium ${
                    overrideMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    overrideMsg.type === 'warn' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {overrideMsg.text}
                  </div>
                )}

                <button 
                  onClick={handleManualAssign}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Confirm Manual Reassignment
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
