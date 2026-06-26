"use client";
 
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "../../services/api";
import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";
import { MdOutlineDocumentScanner } from "react-icons/md";
 
/* ─── helpers ─── */
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
 
const todayISO = () => new Date().toISOString().split("T")[0];
 
const daysUntil = (deadline) => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline + "T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000);
};
 
const isThisWeek = (deadline) => {
  if (!deadline) return false;
  const d = daysUntil(deadline);
  return d !== null && d >= 0 && d <= 7;
};
 
const priorityRank = { High: 0, Medium: 1, Low: 2 };
 
const sortTasks = (tasks) =>
  [...tasks].sort((a, b) => {
    const pr = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
    if (pr !== 0) return pr;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
 
const PRIORITY_META = {
  High:   { color: "#C1521E", bg: "rgba(193,82,30,.1)",  label: "High",   icon: "▲" },
  Medium: { color: "#E27921", bg: "rgba(226,121,33,.1)", label: "Medium", icon: "●" },
  Low:    { color: "#9197AA", bg: "rgba(145,151,170,.1)",label: "Low",    icon: "▼" },
};
 
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

/* ─── safe helper to read user name from localStorage ─── */
const getUserName = () => {
  try {
    const raw = localStorage.getItem("aw_user");
    if (!raw) return "there";
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed.name || parsed.username || parsed.email || "there";
    }
    return raw; // it was stored as a plain string
  } catch {
    return localStorage.getItem("aw_user") || "there"; // JSON.parse failed, use raw string
  }
};
 
export default function AssistantPage() {
  const [aiInput, setAiInput]             = useState("");
  const [tasks, setTasks]                 = useState([]);
  const [projects, setProjects]           = useState([]);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [fileContent, setFileContent]     = useState("");
  const [isListening, setIsListening]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [boardView, setBoardView]         = useState("board");
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [userName, setUserName]           = useState("there");
 
  /* modals */
  const [showWelcome, setShowWelcome]             = useState(false);
  const [newProjectName, setNewProjectName]       = useState("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [pendingTaskData, setPendingTaskData]     = useState(null);
  const [pickerMode, setPickerMode]               = useState("pick");
  const [pickerNewProject, setPickerNewProject]   = useState("");
  const [showCalendar, setShowCalendar]           = useState(false);
  const [calendarFor, setCalendarFor]             = useState(null);
  const [calendarDate, setCalendarDate]           = useState(todayISO());
  const [calMonth, setCalMonth]                   = useState(new Date().getMonth());
  const [calYear, setCalYear]                     = useState(new Date().getFullYear());
  const [reminder, setReminder]                   = useState(null);
  const [showNewProject, setShowNewProject]       = useState(false);
  const [newProjectInput, setNewProjectInput]     = useState("");

  /* deadline edit modal */
  const [deadlineCalendarOpen, setDeadlineCalendarOpen] = useState(false);
  const [deadlineCalendarFor, setDeadlineCalendarFor]   = useState(null);
  const [deadlineCalDate, setDeadlineCalDate]           = useState(todayISO());
  const [deadlineCalMonth, setDeadlineCalMonth]         = useState(new Date().getMonth());
  const [deadlineCalYear, setDeadlineCalYear]           = useState(new Date().getFullYear());
  const [deadlineCalTime, setDeadlineCalTime]           = useState("09:00");

  /* edit modal */
  const [editTask, setEditTask]         = useState(null);
  const [editTitle, setEditTitle]       = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editNotes, setEditNotes]       = useState("");
 
  /* dark mode */
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("aw_dark") === "1";
    return false;
  });
 
  /* time picker */
  const [calTime, setCalTime] = useState("09:00");
 
  /* search */
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
 
  /* expanded notes on cards */
  const [expandedNotes, setExpandedNotes] = useState({});
 
  const router = useRouter();
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
 
  useEffect(() => {
    fetchTasks();
    fetchProjects();
    const seen = localStorage.getItem("aw_welcomed");
    if (!seen) setShowWelcome(true);
    setUserName(getUserName());
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("aw_token");
    if (!token) router.push("/login");
  }, []);
 
  const fetchTasks = async () => {
    try { const res = await api.get("/tasks"); setTasks(res.data); }
    catch (e) { console.log(e); }
  };
 
  const fetchProjects = async () => {
    try { const res = await api.get("/projects"); setProjects(res.data); }
    catch (e) { console.log(e); }
  };
 
  /* ── dark mode ── */
  const toggleDark = () => {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("aw_dark", next ? "1" : "0");
      return next;
    });
  };

  /* ── export CSV ── */
  const exportCSV = async () => {
    try {
      const res = await api.get("/tasks/export", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "tasks.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.log(e);
      showReminder("❌ Export failed. Try again.");
    }
  };
 
  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); textareaRef.current?.focus(); }
      if (e.key === "b" || e.key === "B") setBoardView("board");
      if (e.key === "w" || e.key === "W") setBoardView("week");
      if (e.key === "a" || e.key === "A") setBoardView("archive");
      if (e.key === "d" || e.key === "D") toggleDark();
      if (e.key === "p" || e.key === "P") setShowNewProject(true);
      if (e.key === "Escape") {
        setEditTask(null);
        setShowNewProject(false);
        setShowCalendar(false);
        setShowProjectPicker(false);
        setDeadlineCalendarOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
 
  /* ── new project ── */
  const createNewProject = async () => {
    if (!newProjectInput.trim()) return;
    try {
      await api.post("/projects", null, { params: { title: newProjectInput.trim() } });
      await fetchProjects();
      setNewProjectInput(""); setShowNewProject(false);
    } catch (e) { console.log(e); }
  };
 
  /* ── welcome ── */
  const handleWelcomeDone = async () => {
    if (newProjectName.trim()) {
      try { await api.post("/projects", null, { params: { title: newProjectName.trim() } }); await fetchProjects(); }
      catch (e) { console.log(e); }
    }
    localStorage.setItem("aw_welcomed", "1"); setShowWelcome(false);
  };
 
  /* ── AI submit ── */
  const submitInput = async (input) => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const extractRes = await api.post("/ai-extract", null, { params: { user_input: input } });
      const extracted = extractRes.data;
      const match = projects.find(p => p.title.toLowerCase() === (extracted.project || "").toLowerCase());
      if (match) {
        await api.post("/ai-task", null, { params: { user_input: input, project_id: match.id } });
        await fetchTasks(); triggerCalendarPrompt();
      } else {
        setPendingTaskData({ user_input: input, extracted });
        setPickerNewProject(extracted.project || "");
        setPickerMode("pick"); setShowProjectPicker(true);
      }
    } catch (e) {
      try { await api.post("/ai-task", null, { params: { user_input: input } }); await fetchTasks(); await fetchProjects(); triggerCalendarPrompt(); }
      catch (e2) { console.log(e2); }
    }
    setAiInput(""); setLoading(false);
  };
 
  const triggerCalendarPrompt = () => {
    setCalendarDate(todayISO()); setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear());
    setShowCalendar(true);
  };
 
  /* ── picker ── */
  const confirmProjectPicker = async (projectId) => {
    if (!pendingTaskData) return;
    setLoading(true);
    try { await api.post("/ai-task", null, { params: { user_input: pendingTaskData.user_input, project_id: projectId } }); await fetchTasks(); await fetchProjects(); }
    catch (e) { console.log(e); }
    setShowProjectPicker(false); setPendingTaskData(null); setLoading(false); triggerCalendarPrompt();
  };
 
  const confirmNewProject = async () => {
    if (!pickerNewProject.trim() || !pendingTaskData) return;
    setLoading(true);
    try {
      const projRes = await api.post("/projects", null, { params: { title: pickerNewProject.trim() } });
      await api.post("/ai-task", null, { params: { user_input: pendingTaskData.user_input, project_id: projRes.data.id } });
      await fetchTasks(); await fetchProjects();
    } catch (e) {
      try { await api.post("/ai-task", null, { params: { user_input: pendingTaskData.user_input } }); await fetchTasks(); await fetchProjects(); } catch (e2) { console.log(e2); }
    }
    setShowProjectPicker(false); setPendingTaskData(null); setLoading(false); triggerCalendarPrompt();
  };
 
  /* ── calendar confirm + Google Calendar sync ── */
  const confirmCalendar = async () => {
    if (calendarFor) {
      try {
        const deadlineWithTime = calTime ? `${calendarDate}T${calTime}` : calendarDate;
        await api.put(`/tasks/${calendarFor}/deadline`, null, { params: { deadline: deadlineWithTime } });
        await fetchTasks();
        try {
          const task = tasks.find(t => t.id === calendarFor);
          const title = task?.title || "Task";
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 1000,
              messages: [{ role: "user", content: `Create a Google Calendar event titled "${title}" on ${calendarDate}. Use the calendar tool to create it.` }],
              mcp_servers: [{ type: "url", url: "https://calendarmcp.googleapis.com/mcp/v1", name: "google-calendar" }],
            }),
          });
          if (response.ok) showReminder(`📅 Deadline set & added to Google Calendar!`);
          else showReminder(`📅 Deadline set: ${fmt(calendarDate)}`);
        } catch { showReminder(`📅 Deadline set: ${fmt(calendarDate)}`); }
      } catch (e) { console.log(e); }
    }
    setShowCalendar(false); setCalendarFor(null);
  };

  /* ── deadline edit handlers ── */
  const openDeadlineEditor = (taskId, existingDeadline) => {
    setDeadlineCalendarFor(taskId);
    const d = existingDeadline ? existingDeadline.split("T")[0] : todayISO();
    setDeadlineCalDate(d);
    const dt = new Date(d + "T00:00:00");
    setDeadlineCalMonth(dt.getMonth());
    setDeadlineCalYear(dt.getFullYear());
    if (existingDeadline && existingDeadline.includes("T")) {
      setDeadlineCalTime(existingDeadline.split("T")[1].slice(0,5));
    } else {
      setDeadlineCalTime("09:00");
    }
    setDeadlineCalendarOpen(true);
  };

  const confirmDeadlineEdit = async () => {
    if (deadlineCalendarFor) {
      try {
        const deadlineWithTime = deadlineCalTime ? `${deadlineCalDate}T${deadlineCalTime}` : deadlineCalDate;
        await api.put(`/tasks/${deadlineCalendarFor}/deadline`, null, { params: { deadline: deadlineWithTime } });
        await fetchTasks();
        showReminder(`📅 Deadline updated to ${fmt(deadlineCalDate)}${deadlineCalTime ? " " + deadlineCalTime : ""}`);
      } catch (e) { console.log(e); }
    }
    setDeadlineCalendarOpen(false);
    setDeadlineCalendarFor(null);
  };

  const showReminder = (msg) => { setReminder({ message: msg }); setTimeout(() => setReminder(null), 4000); };
 
  /* ── voice ── */
  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice recognition not supported"); return; }
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    recognitionRef.current = r; r.start(); setIsListening(true);
    r.onresult = async (ev) => { const t = ev.results[0][0].transcript; setAiInput(t); setIsListening(false); await submitInput(t); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
  };
 
  /* ── file ── */
  const handleFileSelect = (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setFileContent(e.target.result);
    reader.readAsText(file);
  };
  const analyzeFile = async () => {
    if (!fileContent) { alert("Upload a text file first"); return; }
    await submitInput(fileContent); setSelectedFile(null); setFileContent("");
  };
 
  /* ── task actions ── */
  const updateStatus = async (id, status) => {
    try { await api.put(`/tasks/${id}/status`, null, { params: { status } }); fetchTasks(); }
    catch (e) { console.log(e); }
  };
 
  const deleteTask = async (id) => {
    try { await api.delete(`/tasks/${id}`); fetchTasks(); }
    catch (e) { console.log(e); }
  };
 
  const archiveTask = async (id) => {
    try { await api.put(`/tasks/${id}/status`, null, { params: { status: "Archived" } }); fetchTasks(); }
    catch (e) { console.log(e); }
  };
 
  /* ── edit task ── */
  const openEdit = (task) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority || "Medium");
    setEditNotes(task.notes || "");
  };
 
  const saveEdit = async () => {
    if (!editTask) return;
    try {
      await api.put(`/tasks/${editTask.id}`, null, {
        params: { title: editTitle, priority: editPriority, notes: editNotes }
      });
      await fetchTasks();
    } catch (e) { console.log(e); }
    setEditTask(null);
  };
 
  /* ── grouping ── */
  const activeTasks   = tasks.filter(t => t.status !== "Archived");
  const archivedTasks = tasks.filter(t => t.status === "Archived");
 
  const grouped = activeTasks.reduce((acc, t) => {
    const key = t.project || "General";
    if (!acc[key]) acc[key] = { Pending: [], "In Progress": [], Completed: [] };
    if (acc[key][t.status] !== undefined) acc[key][t.status].push(t);
    return acc;
  }, {});
 
  const projectNames      = Object.keys(grouped);
  const searchSuggestions = searchQuery.trim()
    ? projectNames.filter(n => n.toLowerCase().includes(searchQuery.toLowerCase()))
    : projectNames;
 
  const pending    = activeTasks.filter(t => t.status === "Pending");
  const inProgress = activeTasks.filter(t => t.status === "In Progress");
  const completed  = activeTasks.filter(t => t.status === "Completed");
 
  /* ── this week ── */
  const weekTasks = sortTasks(activeTasks.filter(t => isThisWeek(t.deadline) && t.status !== "Completed"));
 
  /* ── calendar render (reusable) ── */
  const renderCalendar = (
    dateVal = calendarDate,
    setDate = setCalendarDate,
    month = calMonth,
    setMonth = setCalMonth,
    year = calYear,
    setYear = setCalYear
  ) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const today = new Date();
    return (
      <div style={{ width: "100%" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <button onClick={() => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }} style={CAL_NAV}>‹</button>
          <span style={{ fontWeight:700, fontSize:15, color:"#2a1f14", fontFamily:"'Syne',sans-serif" }}>{monthNames[month]} {year}</span>
          <button onClick={() => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }} style={CAL_NAV}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:8 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{ textAlign:"center",fontSize:11,color:"#9197AA",fontWeight:600 }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
          {cells.map((d,i) => {
            if (!d) return <div key={`e-${i}`}/>;
            const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const isSel = dateVal === dateStr;
            const isToday = today.getDate()===d && today.getMonth()===month && today.getFullYear()===year;
            return (
              <button key={d} onClick={()=>setDate(dateStr)} style={{
                width:"100%", aspectRatio:"1", borderRadius:8, cursor:"pointer", fontSize:13,
                display:"flex", alignItems:"center", justifyContent:"center", transition:"all .12s", lineHeight:1,
                border: isToday&&!isSel ? "1.5px solid #E27921" : "none",
                background: isSel?"#E27921":isToday?"rgba(226,121,33,.1)":"transparent",
                color: isSel?"#fff":isToday?"#E27921":"#2a1f14",
                fontWeight: isSel||isToday?700:400,
              }}>{d}</button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── drawer styles (inline, dark-aware) ── */
  const drawerBg         = darkMode ? "#1e1612" : "#fff8f3";
  const drawerBorder     = darkMode ? "1px solid #3a2e24" : "1px solid #f0dcc8";
  const drawerTitleClr   = darkMode ? "#f5ede4" : "#2a1f14";
  const drawerDivider    = darkMode ? "#3a2e24" : "#f0dcc8";
  const drawerItemClr    = darkMode ? "#f5ede4" : "#2a1f14";
  const drawerItemHover  = darkMode ? "rgba(226,121,33,.12)" : "rgba(226,121,33,.08)";
  const kbdBg            = darkMode ? "#2e2218" : "#f0dcc8";
  const shortcutLabelClr = darkMode ? "#d4bfaa" : "#5a4a3a";
 
  return (
    <div className={darkMode ? "dark-root" : "light-root"}>
 
      {/* ── Edit Modal ── */}
      {editTask && (
        <div className="overlay" onClick={e => { if(e.target.classList.contains("overlay")) setEditTask(null); }}>
          <div className="modal" style={{ maxWidth:440 }}>
            <div className="modal-emoji">✏️</div>
            <h2 className="modal-title">Edit Task</h2>
            <input className="modal-input" value={editTitle} onChange={e=>setEditTitle(e.target.value)} placeholder="Task title..." />
            <div style={{ width:"100%", marginTop:4 }}>
              <p style={{ fontSize:12, color:"#9197AA", fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Priority</p>
              <div style={{ display:"flex", gap:8 }}>
                {["High","Medium","Low"].map(p => {
                  const pm = PRIORITY_META[p];
                  return (
                    <button key={p} onClick={()=>setEditPriority(p)} style={{
                      flex:1, padding:"8px 0", borderRadius:10, border:"1.5px solid",
                      borderColor: editPriority===p ? pm.color : "#e0d0c0",
                      background: editPriority===p ? pm.bg : "transparent",
                      color: editPriority===p ? pm.color : "#9197AA",
                      fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, cursor:"pointer",
                      transition:"all .15s",
                    }}>{pm.icon} {p}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ width:"100%", marginTop:4 }}>
              <p style={{ fontSize:12, color:"#9197AA", fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Notes</p>
              <textarea
                className="modal-input"
                style={{ minHeight:90, resize:"vertical" }}
                placeholder="Add notes, sub-tasks, or any details..."
                value={editNotes}
                onChange={e=>setEditNotes(e.target.value)}
              />
            </div>
            <div style={{ display:"flex", gap:10, marginTop:4, width:"100%" }}>
              <button className="modal-btn-secondary" onClick={()=>setEditTask(null)}>Cancel</button>
              <button className="modal-btn-primary" onClick={saveEdit}>Save Changes →</button>
            </div>
          </div>
        </div>
      )}
 
      {/* ── Welcome Modal ── */}
      {showWelcome && (
        <div className="overlay">
          <div className="modal welcome-modal">
            <div className="modal-emoji">🌱</div>
            <h2 className="modal-title">Welcome to AI Work Organizer</h2>
            <p className="modal-sub">Let's set up your first project to get started.</p>
            <input className="modal-input" placeholder="e.g. Internship Tasks, Final Year Project..." value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleWelcomeDone()} autoFocus />
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button className="modal-btn-secondary" onClick={()=>{localStorage.setItem("aw_welcomed","1");setShowWelcome(false);}}>Skip for now</button>
              <button className="modal-btn-primary" onClick={handleWelcomeDone}>Create Project →</button>
            </div>
          </div>
        </div>
      )}
 
      {/* ── Project Picker Modal ── */}
      {showProjectPicker && (
        <div className="overlay">
          <div className="modal">
            <div className="modal-emoji">📁</div>
            <h2 className="modal-title">Which project is this for?</h2>
            {pendingTaskData?.extracted && <div className="detected-pill">AI detected: <strong>{pendingTaskData.extracted.task}</strong></div>}
            {pickerMode==="pick" ? (
              <>
                <div className="project-list">
                  {projects.map(p=>(
                    <button key={p.id} className="project-option" onClick={()=>confirmProjectPicker(p.id)}>
                      <span className="project-dot"/>{p.title}
                    </button>
                  ))}
                  <button className="project-option new-project-option" onClick={()=>setPickerMode("create")}>
                    <span style={{fontSize:18,marginRight:8,color:"#E27921"}}>+</span>Create new project
                  </button>
                </div>
                <button className="modal-btn-secondary" onClick={()=>{setShowProjectPicker(false);setPendingTaskData(null);}} style={{marginTop:12}}>Cancel</button>
              </>
            ) : (
              <>
                <input className="modal-input" placeholder="New project name..." value={pickerNewProject} onChange={e=>setPickerNewProject(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmNewProject()} autoFocus />
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <button className="modal-btn-secondary" onClick={()=>setPickerMode("pick")}>← Back</button>
                  <button className="modal-btn-primary" onClick={confirmNewProject}>Create & Add →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
 
      {/* ── Post-add Calendar Modal ── */}
      {showCalendar && (
        <div className="overlay">
          <div className="modal calendar-modal">
            <div className="modal-emoji">📅</div>
            <h2 className="modal-title">Set a deadline?</h2>
            <p className="modal-sub">We'll add it to Google Calendar too.</p>
            {renderCalendar()}
            <div className="time-picker-row">
              <span className="time-label">⏰ Time</span>
              <input type="time" className="time-input" value={calTime} onChange={e => setCalTime(e.target.value)} />
              <span className="time-hint">optional</span>
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button className="modal-btn-secondary" onClick={()=>{setShowCalendar(false);setCalendarFor(null);}}>Skip</button>
              <button className="modal-btn-primary" onClick={confirmCalendar}>Set {fmt(calendarDate)}{calTime ? " " + calTime : ""} →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deadline Edit Modal ── */}
      {deadlineCalendarOpen && (
        <div className="overlay" onClick={e => { if(e.target.classList.contains("overlay")) setDeadlineCalendarOpen(false); }}>
          <div className="modal calendar-modal">
            <div className="modal-emoji">📅</div>
            <h2 className="modal-title">Edit deadline</h2>
            {renderCalendar(deadlineCalDate, setDeadlineCalDate, deadlineCalMonth, setDeadlineCalMonth, deadlineCalYear, setDeadlineCalYear)}
            <div className="time-picker-row">
              <span className="time-label">⏰ Time</span>
              <input type="time" className="time-input" value={deadlineCalTime} onChange={e => setDeadlineCalTime(e.target.value)} />
              <span className="time-hint">optional</span>
            </div>
            <div style={{display:"flex", gap:10, marginTop:18, width:"100%"}}>
              <button className="modal-btn-secondary" onClick={() => setDeadlineCalendarOpen(false)}>Cancel</button>
              <button className="modal-btn-primary" onClick={confirmDeadlineEdit}>Set {fmt(deadlineCalDate)}{deadlineCalTime ? " " + deadlineCalTime : ""} →</button>
            </div>
          </div>
        </div>
      )}
 
      {/* ── New Project Modal ── */}
      {showNewProject && (
        <div className="overlay" onClick={e=>{if(e.target.classList.contains("overlay"))setShowNewProject(false);}}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-emoji">🗂️</div>
            <h2 className="modal-title">New Project</h2>
            <p className="modal-sub">Give your project a name to get started.</p>
            <input className="modal-input" placeholder="e.g. Final Year Project, Internship..." value={newProjectInput} onChange={e=>setNewProjectInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createNewProject()} autoFocus />
            <div style={{display:"flex",gap:10,marginTop:4,width:"100%"}}>
              <button className="modal-btn-secondary" onClick={()=>{setShowNewProject(false);setNewProjectInput("");}}>Cancel</button>
              <button className="modal-btn-primary" onClick={createNewProject} disabled={!newProjectInput.trim()}>Create →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer Backdrop ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position:"fixed", inset:0, zIndex:1000,
            background:"rgba(0,0,0,0.35)",
            backdropFilter:"blur(2px)",
          }}
        />
      )}

      {/* ── Side Drawer ── */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, zIndex:1001,
        width:300, maxWidth:"85vw",
        background: drawerBg,
        borderLeft: drawerBorder,
        boxShadow:"-8px 0 32px rgba(0,0,0,0.15)",
        transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
        transition:"transform 0.28s cubic-bezier(.4,0,.2,1)",
        display:"flex", flexDirection:"column",
        padding:"28px 24px",
        gap:6,
        overflowY:"auto",
      }}>
        {/* Drawer Header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20}}>
          <span style={{fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:17, color:drawerTitleClr}}>
            Menu
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#9197AA", lineHeight:1, padding:4}}
          >✕</button>
        </div>

        {/* Dark mode */}
        <DrawerItem
          icon={darkMode ? "☀️" : "🌙"}
          label={darkMode ? "Light mode" : "Dark mode"}
          onClick={toggleDark}
          color={drawerItemClr}
          hoverBg={drawerItemHover}
        />

        {/* Export CSV */}
        <DrawerItem
          icon="⬇"
          label="Export CSV"
          onClick={() => { exportCSV(); setDrawerOpen(false); }}
          color={drawerItemClr}
          hoverBg={drawerItemHover}
        />

        {/* Divider */}
        <div style={{height:1, background:drawerDivider, margin:"10px 0"}}/>

        {/* Shortcuts section */}
        <p style={{
          fontSize:11, fontWeight:700, textTransform:"uppercase",
          letterSpacing:".08em", color:"#9197AA", margin:"0 0 8px 4px",
        }}>
          Keyboard Shortcuts
        </p>
        {[
          ["N","New task"],
          ["B","Board"],
          ["W","Week"],
          ["A","Archive"],
          ["P","New project"],
          ["D","Dark mode"],
          ["Esc","Close"],
        ].map(([key, label]) => (
          <div key={key} style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"5px 4px",
          }}>
            <span style={{fontSize:13, color:shortcutLabelClr}}>{label}</span>
            <kbd style={{
              fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:6,
              background:kbdBg, color:"#E27921",
              border:"1px solid #E27921",
              fontFamily:"monospace",
            }}>{key}</kbd>
          </div>
        ))}

        {/* Divider */}
        <div style={{height:1, background:drawerDivider, margin:"10px 0"}}/>

        {/* Sign out */}
        <DrawerItem
          icon="🚪"
          label="Sign out"
          onClick={() => {
            localStorage.removeItem("aw_token");
            localStorage.removeItem("aw_user");
            localStorage.removeItem("aw_welcomed");
            router.push("/login");
          }}
          color="#C1521E"
          hoverBg="rgba(193,82,30,.08)"
        />
      </div>
 
      {/* ── Toast ── */}
      {reminder && <div className="reminder-toast">{reminder.message}</div>}
 
      <div className={`page ${darkMode ? "dark" : ""}`}>
        {/* ── Header ── */}
        <div className="header-row">
          <div>
            <p style={{ fontSize:13, color:"#9197AA", fontWeight:500, marginBottom:2 }}>
              👋 Hi, <strong style={{ color:"#E27921" }}>{userName}</strong>
            </p>
            <h1 className="page-title">Work Organizer</h1>
            <p className="page-sub">AI-powered task management</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div className="search-wrap" ref={searchRef}>
              <div className={`search-box ${searchFocused?"search-focused":""}`}>
                <span className="search-icon">⌕</span>
                <input className="search-input" placeholder="Search project..." value={searchQuery}
                  onChange={e=>{setSearchQuery(e.target.value);setSearchFocused(true);}}
                  onFocus={()=>setSearchFocused(true)}
                  onBlur={()=>setTimeout(()=>setSearchFocused(false),150)}
                  onKeyDown={e=>{
                    if(e.key==="Escape"){setSearchQuery("");setSearchFocused(false);}
                    if(e.key==="Enter"&&searchSuggestions.length>0){router.push("/assistant/project/"+encodeURIComponent(searchSuggestions[0]));setSearchFocused(false);}
                  }}
                />
                {searchQuery && <button className="search-clear" onClick={()=>setSearchQuery("")}>✕</button>}
              </div>
              {searchFocused && searchSuggestions.length > 0 && (
                <div className="search-dropdown">
                  {searchSuggestions.map(name=>{
                    const ptasks = activeTasks.filter(t=>(t.project||"General")===name);
                    return (
                      <button key={name} className="search-option" onMouseDown={()=>{router.push("/assistant/project/"+encodeURIComponent(name));setSearchFocused(false);setSearchQuery("");}}>
                        <span className="search-option-dot"/>
                        <span className="search-option-name">{name}</span>
                        <span className="search-option-count">{ptasks.length} task{ptasks.length!==1?"s":""}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button className="new-project-btn" onClick={()=>setShowNewProject(true)}>
              <span style={{fontSize:18,lineHeight:1}}>+</span> New Project
            </button>
            <div className="stats-row">
              <div className="stat-pill stat-total">{activeTasks.length} Total</div>
              <div className="stat-pill stat-pending">{pending.length} Pending</div>
              <div className="stat-pill stat-inprogress">{inProgress.length} In Progress</div>
              <div className="stat-pill stat-done">{completed.length} Done</div>
              {archivedTasks.length > 0 && <div className="stat-pill stat-archived">{archivedTasks.length} Archived</div>}
            </div>
            {/* ── Hamburger ── */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              title="Menu"
              style={{
                display:"flex", flexDirection:"column", justifyContent:"center",
                alignItems:"center", gap:5,
                width:40, height:40,
                background:"none",
                border: darkMode ? "1.5px solid #3a2e24" : "1.5px solid #e0d0c0",
                borderRadius:10,
                cursor:"pointer",
                padding:"10px 9px",
                flexShrink:0,
                transition:"background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(226,121,33,.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              {[0,1,2].map(i => (
                <span key={i} style={{
                  display:"block", width:18, height:2,
                  background:"#E27921", borderRadius:2,
                }}/>
              ))}
            </button>
          </div>
        </div>
 
        {/* ── Input Card ── */}
        <div className={`input-card ${isListening?"listening":""}`}>
          <textarea ref={textareaRef} rows={1}
            placeholder={isListening?"Listening...":"Describe a task or paste notes... (Enter to send)"}
            value={aiInput} onChange={e=>setAiInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitInput(aiInput);}}}
          />
          <div className="input-actions">
            <button className={`icon-btn ${isListening?"icon-btn-active":""}`} onClick={toggleVoice} title={isListening?"Stop":"Voice"}>
              {isListening?<FaStop size={14}/>:<FaMicrophone size={14}/>}
            </button>
            <input type="file" id="file-upload" hidden onChange={handleFileSelect}/>
            <button className="icon-btn" onClick={()=>document.getElementById("file-upload").click()} title="Upload file"><FiUpload size={14}/></button>
            <button className="icon-btn" title="Scan document"><MdOutlineDocumentScanner size={15}/></button>
            <button className="send-btn" onClick={()=>submitInput(aiInput)} disabled={loading||!aiInput.trim()}>
              {loading?<span className="spinner"/>:<FaPaperPlane size={13}/>}
              <span>{loading?"Processing...":"Add Task"}</span>
            </button>
          </div>
        </div>
 
        {selectedFile && (
          <div className="file-bar">
            <span>📎 {selectedFile.name}</span>
            <button className="modal-btn-primary" onClick={analyzeFile} style={{padding:"5px 16px",fontSize:13}}>Analyze</button>
            <button className="modal-btn-secondary" onClick={()=>{setSelectedFile(null);setFileContent("");}} style={{padding:"5px 12px",fontSize:13}}>✕</button>
          </div>
        )}
 
        {/* ── View Tabs ── */}
        <div className="view-tabs">
          <button className={`view-tab ${boardView==="board"?"view-tab-active":""}`} onClick={()=>setBoardView("board")}>
            📋 Board
          </button>
          <button className={`view-tab ${boardView==="week"?"view-tab-active":""}`} onClick={()=>setBoardView("week")}>
            📆 This Week <span className="view-tab-badge">{weekTasks.length}</span>
          </button>
          <button className={`view-tab ${boardView==="archive"?"view-tab-active":""}`} onClick={()=>setBoardView("archive")}>
            🗃 Archive <span className="view-tab-badge">{archivedTasks.length}</span>
          </button>
        </div>
 
        {/* ── BOARD VIEW ── */}
        {boardView==="board" && (
          <>
            <div className="board-header">
              <h2 className="board-title">Task Board</h2>
              <span className="board-sub">{Object.keys(grouped).length} project{Object.keys(grouped).length!==1?"s":""}</span>
            </div>
            <div className="board-cols">
              {[
                { key:"Pending",     colClass:"col-pending",    dotClass:"dot-pending",    count:pending.length,    action:"Start",    actionStatus:"In Progress", actionClass:"btn-start" },
                { key:"In Progress", colClass:"col-inprogress", dotClass:"dot-inprogress", count:inProgress.length, action:"Complete", actionStatus:"Completed",   actionClass:"btn-complete" },
                { key:"Completed",   colClass:"col-completed",  dotClass:"dot-completed",  count:completed.length,  action:"Reopen",   actionStatus:"In Progress", actionClass:"btn-reopen" },
              ].map(col => (
                <div key={col.key} className={`col ${col.colClass}`}>
                  <div className="col-header">
                    <span className={`col-dot ${col.dotClass}`}/>
                    <span className="col-label">{col.key}</span>
                    <span className="col-count">{col.count}</span>
                  </div>
                  {Object.entries(grouped).map(([projectName, cols]) =>
                    sortTasks(cols[col.key] || []).length > 0 ? (
                      <div className="project-group" key={projectName}>
                        <div className="group-title">
                          <span className="group-dot"/>
                          {projectName}
                          <span className="group-count">{(cols[col.key]||[]).length}</span>
                        </div>
                        {sortTasks(cols[col.key]).map(task => (
                          <TaskCard key={task.id} task={task}
                            onDelete={deleteTask} onStatus={updateStatus}
                            onEdit={openEdit} onArchive={archiveTask}
                            onEditDeadline={openDeadlineEditor}
                            action={col.action} actionStatus={col.actionStatus} actionClass={col.actionClass}
                            expandedNotes={expandedNotes} setExpandedNotes={setExpandedNotes}
                          />
                        ))}
                      </div>
                    ) : null
                  )}
                  {col.count===0 && <div className="col-empty">{col.key==="Pending"?"No pending tasks 🎉":col.key==="In Progress"?"Nothing in progress yet":"No completed tasks yet"}</div>}
                </div>
              ))}
            </div>
          </>
        )}
 
        {/* ── WEEK VIEW ── */}
        {boardView==="week" && (
          <div className="week-view">
            <div className="board-header">
              <h2 className="board-title">This Week</h2>
              <span className="board-sub">Tasks due in the next 7 days</span>
            </div>
            {weekTasks.length===0 ? (
              <div className="week-empty">
                <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                <p>Nothing due this week. Enjoy!</p>
              </div>
            ) : weekTasks.map((task, idx) => {
              const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
              const d = daysUntil(task.deadline);
              const urgency = d===0?"Due today":d===1?"Due tomorrow":`${d} days left`;
              const urgColor = d<=1?"#C1521E":d<=3?"#E27921":"#9197AA";
              return (
                <div key={task.id} className="week-row" style={{ borderLeft:`3px solid ${pm.color}`, animationDelay:`${idx*40}ms` }}>
                  <div className="week-rank">{idx===0?"🔥 Top":idx===1?"2nd":idx===2?"3rd":`${idx+1}th`}</div>
                  <div className="week-main">
                    <span className="week-title">{task.title}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
                      <span className="tc-priority" style={{color:pm.color,background:pm.bg}}>{pm.icon} {pm.label}</span>
                      <span className="week-project">📁 {task.project||"General"}</span>
                      <span style={{fontSize:11,fontWeight:700,color:urgColor}}>{urgency}</span>
                    </div>
                  </div>
                  <button className="tc-deadline-btn" onClick={() => openDeadlineEditor(task.id, task.deadline)}>
                    📅 {fmt(task.deadline)} ✎
                  </button>
                  <div style={{display:"flex",gap:6}}>
                    <button className="tc-action btn-start" style={{padding:"5px 12px",fontSize:12}} onClick={()=>updateStatus(task.id,"In Progress")}>Start</button>
                    <button className="tc-edit-btn" onClick={()=>openEdit(task)} title="Edit">✏️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
 
        {/* ── ARCHIVE VIEW ── */}
        {boardView==="archive" && (
          <div className="week-view">
            <div className="board-header">
              <h2 className="board-title">Archive</h2>
              <span className="board-sub">{archivedTasks.length} archived task{archivedTasks.length!==1?"s":""}</span>
            </div>
            {archivedTasks.length===0 ? (
              <div className="week-empty">
                <div style={{fontSize:48,marginBottom:12}}>🗃</div>
                <p>No archived tasks yet.</p>
                <p style={{fontSize:13,color:"#9197AA",marginTop:4}}>Archive completed tasks to keep your board clean.</p>
              </div>
            ) : archivedTasks.map((task, idx) => {
              const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
              return (
                <div key={task.id} className="week-row" style={{ borderLeft:`3px solid #bec2cf`, opacity:.75, animationDelay:`${idx*30}ms` }}>
                  <div className="week-rank" style={{color:"#9197AA"}}>🗃</div>
                  <div className="week-main">
                    <span className="week-title" style={{textDecoration:"line-through",color:"#9197AA"}}>{task.title}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                      <span className="tc-priority" style={{color:pm.color,background:pm.bg}}>{pm.icon} {pm.label}</span>
                      <span className="week-project">📁 {task.project||"General"}</span>
                    </div>
                  </div>
                  {task.deadline && <span className="week-date">📅 {fmt(task.deadline)}</span>}
                  <div style={{display:"flex",gap:6}}>
                    <button className="modal-btn-secondary" style={{padding:"5px 12px",fontSize:12,borderRadius:8}} onClick={()=>updateStatus(task.id,"Pending")}>Restore</button>
                    <button className="tc-del" onClick={()=>deleteTask(task.id)} title="Delete permanently">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DrawerItem helper ─── */
function DrawerItem({ icon, label, onClick, color, hoverBg }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:"flex", alignItems:"center", gap:12,
        width:"100%", padding:"11px 12px",
        background: hovered ? hoverBg : "none",
        border: "1.5px solid transparent",
        borderColor: hovered ? "rgba(226,121,33,.2)" : "transparent",
        borderRadius:10,
        fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600,
        color: color,
        cursor:"pointer", textAlign:"left",
        transition:"background 0.13s, border-color 0.13s",
      }}
    >
      <span style={{fontSize:16}}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
 
/* ─── TaskCard ─── */
function TaskCard({ task, onDelete, onStatus, onEdit, onArchive, onEditDeadline, action, actionStatus, actionClass, expandedNotes, setExpandedNotes }) {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
  const d = daysUntil(task.deadline);
  const isUrgent = d !== null && d <= 2 && task.status !== "Completed";
  const isOverdue = d !== null && d < 0 && task.status !== "Completed";
  const hasNotes = task.notes && task.notes.trim().length > 0;
  const notesOpen = expandedNotes[task.id];
 
  let urgencyBorder = "1px solid #f0dcc8";
  if (isOverdue) urgencyBorder = "1.5px solid #C1521E";
  else if (isUrgent) urgencyBorder = "1.5px solid #E27921";
 
  return (
    <div className="task-card" style={{ border: urgencyBorder, boxShadow: isOverdue ? "0 0 0 3px rgba(193,82,30,.1)" : isUrgent ? "0 0 0 3px rgba(226,121,33,.08)" : undefined }}>
      {(isOverdue || isUrgent) && (
        <div className="urgency-banner" style={{ background: isOverdue ? "rgba(193,82,30,.1)" : "rgba(226,121,33,.08)", color: isOverdue ? "#C1521E" : "#E27921" }}>
          {isOverdue ? `⚠️ Overdue by ${Math.abs(d)} day${Math.abs(d)!==1?"s":""}` : d===0 ? "🔴 Due today" : `🟡 Due tomorrow`}
        </div>
      )}
      <div className="tc-top">
        <span className="tc-title">{task.title}</span>
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          <button className="tc-edit-btn" onClick={()=>onEdit(task)} title="Edit">✏️</button>
          <button className="tc-del" onClick={()=>onDelete(task.id)} title="Delete">✕</button>
        </div>
      </div>
      <div className="tc-meta">
        <span className="tc-priority" style={{color:pm.color,background:pm.bg}}>{pm.icon} {pm.label}</span>
        {task.deadline ? (
          <button className="tc-deadline-btn" onClick={() => onEditDeadline(task.id, task.deadline)}>
            📅 {fmt(task.deadline)} ✎
          </button>
        ) : (
          <button className="tc-deadline-add" onClick={() => onEditDeadline(task.id, null)}>
            + set date
          </button>
        )}
        {task.completed_at && <span className="tc-done-date">✓ {fmt(task.completed_at)}</span>}
      </div>
      {hasNotes && (
        <button className="notes-toggle" onClick={()=>setExpandedNotes(prev=>({...prev,[task.id]:!prev[task.id]}))}>
          {notesOpen ? "▲ Hide notes" : "▼ Show notes"}
        </button>
      )}
      {hasNotes && notesOpen && (
        <div className="notes-body">{task.notes}</div>
      )}
      <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
        <button className={`tc-action ${actionClass}`} onClick={()=>onStatus(task.id,actionStatus)}>{action}</button>
        {task.status==="Completed" && (
          <button className="tc-archive-btn" onClick={()=>onArchive(task.id)} title="Archive">🗃</button>
        )}
      </div>
    </div>
  );
}
 
const CAL_NAV = {
  background:"none", border:"1px solid #e0d0c0", borderRadius:8,
  width:32, height:32, cursor:"pointer", fontSize:18,
  color:"#E27921", display:"flex", alignItems:"center", justifyContent:"center",
};