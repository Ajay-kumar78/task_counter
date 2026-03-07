import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  ChevronRight,
  LayoutDashboard,
  Settings,
  Search,
  AlertCircle,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, type Task } from './lib/utils';

export default function App() {
  const [workspaceName, setWorkspaceName] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("workspaceName") || "Personal Repo";
  }
  return "Personal Repo";
});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'timeline' | 'urgent' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium' as Task['priority'],
    due_date: ''
  });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchTasks();
    setupWebSocket();
    return () => socketRef.current?.close();
  }, []);

  useEffect(() => {
  localStorage.setItem("workspaceName", workspaceName);
}, [workspaceName]);

  const setupWebSocket = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onmessage = (event) => {
    try {
      const { type, payload } = JSON.parse(event.data);

      if (type === "TASK_CREATED") {
        setTasks((prev) => {
          const exists = prev.some(t => t.id === payload.id);
          if (exists) return prev;
          return [payload, ...prev];
        });
      }

      if (type === "TASK_UPDATED") {
        setTasks((prev) =>
          prev.map((t) => (t.id === payload.id ? { ...t, ...payload } : t))
        );
      }

      if (type === "TASK_DELETED") {
        setTasks((prev) => prev.filter((t) => t.id !== payload));
      }
    } catch (err) {
      console.error("WebSocket message parse error:", err);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting...");
    socketRef.current = null;

    setTimeout(() => {
      setupWebSocket();
    }, 2000);
  };

  socket.onerror = () => {
    socket.close();
  };

  socketRef.current = socket;
};

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    const id = Math.random().toString(36).substring(7);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, id }),
      });
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, status: Task['status']) => {
    updateTask(id, { status });
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
  };

  const generateAIBreakdown = async () => {
    if (!newTask.title) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask.title, description: newTask.description }),
      });
      const { subtasks } = await res.json();
      setNewTask(prev => ({
        ...prev,
        description: prev.description + "\n\nAI Suggested Steps:\n" + subtasks.map((s: string) => `- ${s}`).join('\n')
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleNavClick = (view: 'dashboard' | 'timeline' | 'urgent' | 'settings') => {
  setActiveView(view);
  setSidebarOpen(false);
};

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0F172A] transition-colors duration-300">
      {/* Sidebar */}
      {sidebarOpen && (
  <div
    onClick={() => setSidebarOpen(false)}
    className="fixed inset-0 bg-black/30 z-40 md:hidden"
  />
)}
      <aside className={cn(
        "fixed md:static top-0 left-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-8 transition-transform z-50",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0"
      )}>
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight dark:text-white">AJAY AI</span>
        </div>

        <nav className="flex flex-col gap-1">

  <NavItem 
    icon={<LayoutDashboard size={18} />} 
    label="Dashboard" 
    active={activeView === 'dashboard'} 
    onClick={() => handleNavClick('dashboard')}
  />

  <NavItem 
    icon={<Clock size={18} />} 
    label="Timeline" 
    active={activeView === 'timeline'} 
    onClick={() => handleNavClick('timeline')}
  />

  <NavItem 
    icon={<AlertCircle size={18} />} 
    label="Urgent" 
    active={activeView === 'urgent'} 
    onClick={() => handleNavClick('urgent')}
  />

  <NavItem 
    icon={<Settings size={18} />} 
    label="Settings" 
    active={activeView === 'settings'} 
    onClick={() => handleNavClick('settings')}
  />

</nav>

        <div className="mt-auto p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Workspace</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              {workspaceName
                .split(" ")
                .slice(0, 2)
                .map(word => word[0])
                .join("")
                .toUpperCase()}
            </div>
            <span className="text-sm font-medium dark:text-slate-300">
              {workspaceName}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between">
        <button
  onClick={() => setSidebarOpen(true)}
  className="md:hidden p-2 text-slate-600 dark:text-slate-300"
>
  <LayoutDashboard size={22} />
</button>
          <div className="flex items-center gap-3 flex-1 max-w-xl mx-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Search tasks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent rounded-full text-sm dark:text-slate-200 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
  onClick={() => setIsAdding(true)}
  className="bg-brand-600 hover:bg-brand-700 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 py-2 rounded-full flex items-center justify-center gap-2 shadow-lg"
>
  <Plus size={16} />
  <span className="hidden md:inline">New Task</span>
</button>
          </div>
        </header>

        <div className="p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {activeView === 'settings' ? (
              <SettingsView
                workspaceName={workspaceName}
                setWorkspaceName={setWorkspaceName}
              />
            ) : (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {activeView === 'dashboard' ? 'Task Orchestrator' : 
                       activeView === 'timeline' ? 'Timeline' : 'Urgent Tasks'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      {activeView === 'dashboard' ? 'Manage your engineering workflow with AI precision.' :
                       activeView === 'timeline' ? 'Your tasks organized by time.' : 'High priority items requiring immediate attention.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatCard label="Total" value={tasks.length} />
                    <StatCard label="Pending" value={tasks.filter(t => t.status === 'pending').length} />
                    <StatCard label="Completed" value={tasks.filter(t => t.status === 'completed').length} />
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-brand-600" size={32} />
                  </div>
                ) : (
                  <div className={cn(
  activeView === 'timeline'
    ? "flex flex-col gap-8"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
)}>
                    {activeView === 'timeline' ? (
                      <TimelineContent 
                        tasks={tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
                        onDelete={deleteTask} 
                        onStatusChange={updateStatus} 
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {tasks
                          .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                          .filter(t => activeView === 'urgent' ? t.priority === 'high' : true)
                          .map((task) => (
                          <TaskCard 
                            key={task.id} 
                            task={task} 
                            onDelete={() => deleteTask(task.id)}
                            onStatusChange={(s: any) => updateStatus(task.id, s)}
                          />
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg mx-2 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden transition-colors"
            >
              <form onSubmit={createTask} className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold dark:text-white">Create New Task</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
                    <input 
                      autoFocus
                      type="text"
                      value={newTask.title}
                      onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      placeholder="What needs to be done?"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                      <select 
                        value={newTask.priority}
                        onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                        className="w-full min-w-[120px] px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Timeline (Due Date)</label>
                      <input 
                        type="date"
                        value={newTask.due_date}
                        onChange={e => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                    <textarea 
                      rows={4}
                      value={newTask.description}
                      onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none"
                      placeholder="Add some context..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
  type="submit"
  className="flex-1 md:flex-none md:px-6 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-all shadow-lg shadow-brand-600/20"
>
  Create
</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left",
        active ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SettingsView({ workspaceName, setWorkspaceName }: any) {

  const [aiEnabled, setAiEnabled] = React.useState(true);
  const [name, setName] = React.useState(workspaceName);

  const handleSave = () => {
    if (!name.trim()) return;
    setWorkspaceName(name);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl"
    >
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-8">
        Settings
      </h1>
      
      <div className="space-y-6">

        {/* Workspace */}
        <section className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">

          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
            Workspace Configuration
          </h2>

          <div className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Workspace Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-slate-200"
              />

              {/* SAVE BUTTON */}
              <button
                onClick={handleSave}
                className="mt-3 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Save
              </button>

            </div>

            {/* AI Toggle */}
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  AI Assistance
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enable Gemini-powered task breakdowns
                </p>
              </div>

              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${
                  aiEnabled ? "bg-green-500" : "bg-slate-400"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${
                    aiEnabled ? "right-1" : "left-1"
                  }`}
                />
              </button>

            </div>

          </div>
        </section>

      </div>
    </motion.div>
  );
}

function TimelineContent({ tasks, onDelete, onStatusChange }: any) {
  const grouped = tasks.reduce((acc: any, task: any) => {
    const dateStr = task.due_date || (task.created_at.includes(' ') ? task.created_at.replace(' ', 'T') + 'Z' : task.created_at);
    const dateObj = new Date(dateStr);
    const date = isNaN(dateObj.getTime()) ? 'No Date Set' : dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {});

  // Sort dates: "No Date Set" first, then chronological
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === 'No Date Set') return -1;
    if (b === 'No Date Set') return 1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="space-y-12">
      <AnimatePresence mode="popLayout">
        {sortedDates.map((date: string) => (
          <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            key={date} 
            className="relative"
          >
            <div className="sticky top-20 z-10 py-2 mb-6">
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors">
                {date}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {grouped[date].map((task: any) => (
                <TaskCard key={task.id} task={task} onDelete={() => onDelete(task.id)} onStatusChange={(s: any) => onStatusChange(task.id, s)} />
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {tasks.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          No tasks found in this view.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl flex flex-col items-center min-w-[80px]">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{label}</span>
      <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function TaskCard({ task, onDelete, onStatusChange }: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<null | "priority" | "timeline">(null);

  const isCompleted = task.status === "completed";

  const updateTask = async (updates: any) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    setMenuOpen(false);
    setSubMenu(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "p-4 md:p-6 rounded-2xl md:rounded-[2rem] flex flex-col gap-4 group relative overflow-hidden",
        "bg-[#111c2e] border border-white/5 backdrop-blur-xl",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "hover:border-emerald-400/20",
        "hover:shadow-[0_0_25px_rgba(34,197,94,0.25),0_10px_30px_rgba(0,0,0,0.6)]",
        isCompleted && "opacity-60 grayscale-[0.5]"
      )}
    >
      {/* TOP */}
      <div className="flex items-start justify-between">

        <div className="flex flex-col gap-1">

          <div
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit",
              task.priority === "high"
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                : task.priority === "medium"
                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            )}
          >
            {task.priority}
          </div>

          {task.due_date && (
            <span className="text-[10px] font-bold text-slate-400">
              {task.due_date}
            </span>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">    

          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>

          <div className="relative">

            <button
              onClick={() => {
                setMenuOpen(!menuOpen);
                setSubMenu(null);
              }}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-6 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">

                {!subMenu && (
                  <>
                    <button
                      onClick={() => setSubMenu("priority")}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Priority
                    </button>

                    <button
                      onClick={() => setSubMenu("timeline")}
                      className="block w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                      Timeline
                    </button>
                  </>
                )}

                {subMenu === "priority" && (
                  <>
                    <button
                      onClick={() => updateTask({ priority: "low" })}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Low
                    </button>

                    <button
                      onClick={() => updateTask({ priority: "medium" })}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Medium
                    </button>

                    <button
                      onClick={() => updateTask({ priority: "high" })}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      High
                    </button>
                  </>
                )}

                {subMenu === "timeline" && (
                  <input
                    type="date"
                    onChange={(e) =>
                      updateTask({ due_date: e.target.value })
                    }
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  />
                )}

              </div>
            )}
          </div>
        </div>
      </div>

      {/* TITLE */}
      <div>
        <h3
          className={cn(
            "text-lg font-bold leading-tight text-white",
            isCompleted && "line-through text-slate-500"
          )}
        >
          {task.title}
        </h3>

        <p className="text-sm text-slate-400 mt-2 line-clamp-3 whitespace-pre-wrap">
          {task.description}
        </p>
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between">

        <div className="flex items-center gap-2">

          <button
            onClick={() =>
              onStatusChange(isCompleted ? "pending" : "completed")
            }
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all",
              isCompleted
                ? "bg-brand-500 text-white"
                : "border-2 border-slate-700 text-slate-700 hover:border-brand-500"
            )}
          >
            {isCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
          </button>

          <span className="text-xs text-slate-400">
            {isCompleted ? "Done" : "Mark complete"}
          </span>
        </div>

        <div className="flex -space-x-2">
          <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-700" />
          <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-600" />
        </div>
      </div>
    </motion.div>
  );
}
