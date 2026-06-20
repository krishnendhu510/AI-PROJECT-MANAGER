"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "../../../../services/api";
import { FaMicrophone, FaPaperPlane, FaStop } from "react-icons/fa";

/* ─── Palette ───────────────────────────────────────────────
   Cloud   #CDD0DB   page background
   Azul    #9197AA   muted text, borders, placeholders
   Mimosa  #F7B557   light accent / gradient end
   Orange  #E27921   primary accent / gradient start
   Aperol  #C1521E   danger, high-priority, overdue
─────────────────────────────────────────────────────────── */

/* ─── helpers ─── */
const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

const todayISO = () => new Date().toISOString().split("T")[0];

const daysUntil = (deadline) => {
  if (!deadline) return null;
  const diff = Math.ceil(
    (new Date(deadline + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  return diff;
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
  High:   { color: "#C1521E", bg: "rgba(193,82,30,.1)",   label: "High",   icon: "▲" },
  Medium: { color: "#E27921", bg: "rgba(226,121,33,.1)",  label: "Medium", icon: "●" },
  Low:    { color: "#7a9a5a", bg: "rgba(122,154,90,.1)",  label: "Low",    icon: "▼" },
};

const STATUS_META = {
  "Pending":     { color: "#b07010", bg: "rgba(247,181,87,.2)",   label: "Pending" },
  "In Progress": { color: "#E27921", bg: "rgba(226,121,33,.12)",  label: "In Progress" },
  "Completed":   { color: "#7a9a5a", bg: "rgba(122,154,90,.12)",  label: "Completed" },
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

export default function ProjectDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const projectName = decodeURIComponent(slug);

  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [aiInput, setAiInput]         = useState("");
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  /* calendar */
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarFor, setCalendarFor]   = useState(null);
  const [calendarDate, setCalendarDate] = useState(todayISO());
  const [calMonth, setCalMonth]         = useState(new Date().getMonth());
  const [calYear, setCalYear]           = useState(new Date().getFullYear());

  /* filter */
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast]               = useState(null);

  /* ─── fetch ─── */
  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks");
      setTasks(res.data.filter((t) => (t.project || "General") === projectName));
    } catch (e) { console.log(e); }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [projectName]);

  /* ─── derived ─── */
  const filtered =
    filterStatus === "All"
      ? sortTasks(tasks)
      : sortTasks(tasks.filter((t) => t.status === filterStatus));

  const counts = {
    All: tasks.length,
    Pending: tasks.filter((t) => t.status === "Pending").length,
    "In Progress": tasks.filter((t) => t.status === "In Progress").length,
    Completed: tasks.filter((t) => t.status === "Completed").length,
  };

  /* ─── actions ─── */
  const updateStatus = async (id, status) => {
    try {
      await api.put(`/tasks/${id}/status`, null, { params: { status } });
      await fetchTasks();
      showToast(`Task moved to ${status}`);
    } catch (e) { console.log(e); }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      await fetchTasks();
    } catch (e) { console.log(e); }
  };

  const openDeadlineEditor = (taskId, existingDeadline) => {
    setCalendarFor(taskId);
    const d = existingDeadline ? existingDeadline.split("T")[0] : todayISO();
    setCalendarDate(d);
    const dt = new Date(d + "T00:00:00");
    setCalMonth(dt.getMonth());
    setCalYear(dt.getFullYear());
    setShowCalendar(true);
  };

  const confirmCalendar = async () => {
    if (calendarFor) {
      try {
        await api.put(`/tasks/${calendarFor}/deadline`, null, { params: { deadline: calendarDate } });
        await fetchTasks();
        showToast(`📅 Deadline updated to ${fmt(calendarDate)}`);
      } catch (e) { console.log(e); }
    }
    setShowCalendar(false);
    setCalendarFor(null);
  };

  /* ─── quick-add ─── */
  const submitInput = async (input) => {
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/ai-task", null, { params: { user_input: input } });
      await fetchTasks();
      setAiInput("");
      showToast("Task added!");
    } catch (e) { console.log(e); }
    setSubmitting(false);
  };

  /* ─── voice ─── */
  const recognitionRef = { current: null };
  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice recognition not supported"); return; }
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    recognitionRef.current = r;
    r.start(); setIsListening(true);
    r.onresult = async (ev) => {
      const t = ev.results[0][0].transcript;
      setAiInput(t); setIsListening(false);
      await submitInput(t);
    };
    r.onerror = () => setIsListening(false);
    r.onend   = () => setIsListening(false);
  };

  /* ─── toast ─── */
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  /* ─── urgency label ─── */
  const urgencyLabel = (deadline) => {
    const d = daysUntil(deadline);
    if (d === null) return null;
    if (d < 0)  return { text: `${Math.abs(d)}d overdue`, color: "#C1521E" };
    if (d === 0) return { text: "Due today",               color: "#E27921" };
    if (d === 1) return { text: "Due tomorrow",            color: "#E27921" };
    if (d <= 3)  return { text: `${d}d left`,              color: "#b07010" };
    return               { text: `${d}d left`,              color: "#9197AA" };
  };

  /* ─── progress ─── */
  const progressPct = tasks.length > 0
    ? Math.round((counts.Completed / tasks.length) * 100)
    : 0;

  /* ─── calendar render ─── */
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay    = getFirstDayOfMonth(calYear, calMonth);
    const monthNames  = ["January","February","March","April","May","June",
                         "July","August","September","October","November","December"];
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const today = new Date();

    return (
      <div style={{ width: "100%" }}>
        {/* month nav */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <button
            onClick={() => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}
            style={CAL_NAV_BTN}
          >‹</button>
          <span style={{ fontWeight:700, fontSize:15, color:"#3a2010", fontFamily:"'Syne',sans-serif" }}>
            {monthNames[calMonth]} {calYear}
          </span>
          <button
            onClick={() => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}
            style={CAL_NAV_BTN}
          >›</button>
        </div>

        {/* day labels */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:8 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} style={{ textAlign:"center", fontSize:11, color:"#9197AA", fontWeight:700 }}>{d}</div>
          ))}
        </div>

        {/* day cells */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={`e-${i}`} />;
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const isSel   = calendarDate === dateStr;
            const isToday = today.getDate()===d && today.getMonth()===calMonth && today.getFullYear()===calYear;
            const isPast  = new Date(dateStr+"T00:00:00") < new Date().setHours(0,0,0,0);
            return (
              <button
                key={d}
                onClick={() => setCalendarDate(dateStr)}
                style={{
                  width:"100%", aspectRatio:"1", borderRadius:8, cursor:"pointer",
                  fontSize:13, display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all .12s", lineHeight:1, border:"none",
                  background: isSel ? "#E27921" : isToday ? "rgba(226,121,33,.15)" : "transparent",
                  color: isSel ? "#fff" : isToday ? "#C1521E" : isPast ? "#c8ccd6" : "#5a3a20",
                  fontWeight: isSel || isToday ? 700 : 400,
                  outline: isToday && !isSel ? "1px solid #E27921" : "none",
                }}
              >{d}</button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════ JSX ════════════════════════════════════════════ */
  return (
    <>
      <style>{CSS}</style>

      {/* ── Calendar Modal ── */}
      {showCalendar && (
        <div className="dp-overlay">
          <div className="dp-modal">
            <p className="dp-modal-label">Set deadline</p>
            {renderCalendar()}
            <div style={{ display:"flex", gap:10, marginTop:20, width:"100%" }}>
              <button className="dp-btn-secondary" onClick={() => { setShowCalendar(false); setCalendarFor(null); }}>
                Cancel
              </button>
              <button className="dp-btn-primary" onClick={confirmCalendar}>
                Set {fmtShort(calendarDate)} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className="dp-toast">{toast}</div>}

      <div className="dp-page">

        {/* ── Back nav ── */}
        <button className="dp-back" onClick={() => router.push("/assistant")}>
          ← Back to Board
        </button>

        {/* ── Hero header ── */}
        <div className="dp-hero">
          <div className="dp-hero-left">
            <div className="dp-project-badge">
              <span className="dp-project-dot" />
              Project
            </div>
            <h1 className="dp-project-title">{projectName}</h1>
            <div className="dp-hero-meta">
              <span className="dp-meta-chip">{tasks.length} tasks</span>
              <span className="dp-meta-chip dp-meta-done">{counts.Completed} completed</span>
              {tasks.length > 0 && (
                <span className="dp-meta-chip dp-meta-progress">{progressPct}% done</span>
              )}
            </div>
          </div>

          {/* Progress ring */}
          <div className="dp-ring-wrap">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#bfc3cc" strokeWidth="8"/>
              <circle
                cx="40" cy="40" r="32" fill="none"
                stroke="#E27921" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - progressPct / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset .6s ease" }}
              />
            </svg>
            <span className="dp-ring-pct">{progressPct}%</span>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="dp-progress-bar-wrap">
          <div className="dp-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>

        {/* ── Quick-add input ── */}
        <div className={`dp-add-bar ${isListening ? "dp-add-bar-listening" : ""}`}>
          <input
            className="dp-add-input"
            placeholder={isListening ? "Listening..." : `Add a task to ${projectName}...`}
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitInput(aiInput); }}
          />
          <button className={`dp-icon-btn ${isListening ? "dp-icon-btn-active" : ""}`} onClick={toggleVoice}>
            {isListening ? <FaStop size={13}/> : <FaMicrophone size={13}/>}
          </button>
          <button
            className="dp-send-btn"
            onClick={() => submitInput(aiInput)}
            disabled={submitting || !aiInput.trim()}
          >
            {submitting ? <span className="dp-spinner"/> : <FaPaperPlane size={12}/>}
            <span>{submitting ? "Adding..." : "Add"}</span>
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div className="dp-tabs">
          {["All","Pending","In Progress","Completed"].map((s) => (
            <button
              key={s}
              className={`dp-tab ${filterStatus === s ? "dp-tab-active" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {s}
              <span className="dp-tab-count">{counts[s]}</span>
            </button>
          ))}
        </div>

        {/* ── Task stack ── */}
        {loading ? (
          <div className="dp-loading">
            <span className="dp-spinner" style={{ width:20, height:20, borderWidth:3 }}/>
            Loading tasks...
          </div>
        ) : filtered.length === 0 ? (
          <div className="dp-empty">
            <div className="dp-empty-icon">📭</div>
            <p>No {filterStatus !== "All" ? filterStatus.toLowerCase() : ""} tasks here.</p>
            <p style={{ fontSize:13, color:"#9197AA", marginTop:4 }}>Type something above to add one.</p>
          </div>
        ) : (
          <div className="dp-stack">
            <div className="dp-stack-header">
              <span style={{ minWidth:80 }}>Rank</span>
              <span style={{ flex:1 }}>Task</span>
              <span style={{ width:110 }}>Deadline</span>
              <span style={{ width:100 }}>Status</span>
              <span style={{ width:130, textAlign:"right" }}>Actions</span>
            </div>

            {filtered.map((task, idx) => {
              const pm = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
              const sm = STATUS_META[task.status]     || STATUS_META["Pending"];
              const urg = urgencyLabel(task.deadline);
              const rankLabel = idx === 0 ? "🔥 Top" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx+1}th`;
              const isDone = task.status === "Completed";

              return (
                <div
                  key={task.id}
                  className={`dp-task-row ${isDone ? "dp-task-done" : ""}`}
                  style={{ borderLeft: `3px solid ${pm.color}`, animationDelay: `${idx * 40}ms` }}
                >
                  {/* Rank */}
                  <div className="dp-rank-col">
                    <span className="dp-rank-num" style={{ color: idx === 0 ? pm.color : "#9197AA" }}>
                      {rankLabel}
                    </span>
                    <span className="dp-priority-badge" style={{ color: pm.color, background: pm.bg }}>
                      {pm.icon} {pm.label}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="dp-title-col">
                    <span className="dp-task-title" style={{ textDecoration: isDone ? "line-through" : "none" }}>
                      {task.title}
                    </span>
                    {urg && !isDone && (
                      <span className="dp-urgency" style={{ color: urg.color }}>{urg.text}</span>
                    )}
                  </div>

                  {/* Deadline */}
                  <div className="dp-deadline-col">
                    {task.deadline ? (
                      <button className="dp-deadline-btn" onClick={() => openDeadlineEditor(task.id, task.deadline)}>
                        📅 {fmtShort(task.deadline)} ✎
                      </button>
                    ) : (
                      <button className="dp-deadline-add" onClick={() => openDeadlineEditor(task.id, null)}>
                        + set date
                      </button>
                    )}
                  </div>

                  {/* Status */}
                  <div className="dp-status-col">
                    <span className="dp-status-badge" style={{ color: sm.color, background: sm.bg }}>
                      {sm.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="dp-action-col">
                    {task.status === "Pending" && (
                      <button className="dp-action-btn dp-btn-start" onClick={() => updateStatus(task.id, "In Progress")}>Start</button>
                    )}
                    {task.status === "In Progress" && (
                      <button className="dp-action-btn dp-btn-complete" onClick={() => updateStatus(task.id, "Completed")}>Complete</button>
                    )}
                    {task.status === "Completed" && (
                      <button className="dp-action-btn dp-btn-reopen" onClick={() => updateStatus(task.id, "In Progress")}>Reopen</button>
                    )}
                    <button className="dp-del-btn" onClick={() => deleteTask(task.id)} title="Delete">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Calendar nav button ─── */
const CAL_NAV_BTN = {
  background: "none",
  border: "1px solid #bfc3cc",
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: "pointer",
  fontSize: 20,
  color: "#E27921",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/* ─── CSS ─────────────────────────────────────────────────────────────────────
   Palette
     Cloud   #CDD0DB  — page bg
     Azul    #9197AA  — muted text, borders
     Mimosa  #F7B557  — light accent / gradient end
     Orange  #E27921  — primary CTA / gradient start
     Aperol  #C1521E  — danger / high priority
   Surface hierarchy (light → dark):
     page bg     #CDD0DB  (Cloud)
     card bg     #dde0e8  (Cloud + 8% white)
     card hover  #e8eaef
     border      #bfc3cc
   Text hierarchy:
     primary     #3a2010  (deep warm brown)
     secondary   #6b4a30
     muted       #9197AA  (Azul)
──────────────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'DM Sans', sans-serif;
  background: #CDD0DB;
  color: #3a2010;
  min-height: 100vh;
}

.dp-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 36px 28px 80px;
}

/* ── back ── */
.dp-back {
  background: none; border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; color: #9197AA; cursor: pointer;
  padding: 0; margin-bottom: 32px;
  display: inline-flex; align-items: center; gap: 6px;
  transition: color .15s;
}
.dp-back:hover { color: #E27921; }

/* ── hero ── */
.dp-hero {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 24px; margin-bottom: 20px;
}
.dp-hero-left { display: flex; flex-direction: column; gap: 10px; }
.dp-project-badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
  color: #C1521E;
}
.dp-project-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #E27921; box-shadow: 0 0 8px rgba(226,121,33,.5);
}
.dp-project-title {
  font-family: 'Syne', sans-serif;
  font-size: 40px; font-weight: 800;
  color: #2a1000;
  line-height: 1.1;
}
.dp-hero-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.dp-meta-chip {
  font-size: 12px; font-weight: 600;
  padding: 4px 12px; border-radius: 20px;
  background: #dde0e8; color: #9197AA; border: 1px solid #bfc3cc;
}
.dp-meta-done     { background: #fef0e6; color: #C1521E; border-color: #f7d5b8; }
.dp-meta-progress { background: #fff4e0; color: #E27921; border-color: #fad9a0; }

/* ring */
.dp-ring-wrap { position: relative; flex-shrink: 0; }
.dp-ring-pct {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800; color: #C1521E;
}

/* progress bar */
.dp-progress-bar-wrap {
  height: 4px; background: #bfc3cc; border-radius: 2px; margin-bottom: 32px; overflow: hidden;
}
.dp-progress-bar {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #E27921, #F7B557);
  transition: width .6s ease;
}

/* ── add bar ── */
.dp-add-bar {
  display: flex; align-items: center; gap: 10px;
  background: #dde0e8; border: 1px solid #bfc3cc; border-radius: 14px;
  padding: 12px 16px; margin-bottom: 24px;
  transition: border-color .2s;
}
.dp-add-bar.dp-add-bar-listening {
  border-color: #E27921;
  box-shadow: 0 0 0 3px rgba(226,121,33,.12);
}
.dp-add-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-family: 'DM Sans', sans-serif; font-size: 14px; color: #3a2010;
}
.dp-add-input::placeholder { color: #9197AA; }
.dp-icon-btn {
  width: 34px; height: 34px; border-radius: 9px; border: 1px solid #bfc3cc;
  background: #CDD0DB; color: #9197AA; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s; flex-shrink: 0;
}
.dp-icon-btn:hover { border-color: #E27921; color: #E27921; }
.dp-icon-btn-active {
  border-color: #C1521E; color: #C1521E; background: #fef0e6;
  animation: dpPulse 1.2s infinite;
}
@keyframes dpPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(193,82,30,.4); }
  50%      { box-shadow: 0 0 0 5px rgba(193,82,30,0); }
}
.dp-send-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 0 18px; height: 34px; border-radius: 9px; border: none;
  background: linear-gradient(135deg, #E27921, #F7B557);
  color: #fff; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 700;
  cursor: pointer; transition: opacity .15s; flex-shrink: 0;
}
.dp-send-btn:disabled { opacity: .4; cursor: not-allowed; }
.dp-send-btn:hover:not(:disabled) { opacity: .88; }
.dp-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
  border-radius: 50%; animation: dpSpin .6s linear infinite;
}
@keyframes dpSpin { to { transform: rotate(360deg); } }

/* ── filter tabs ── */
.dp-tabs { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
.dp-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 16px; border-radius: 10px;
  border: 1px solid #bfc3cc; background: #dde0e8;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  color: #9197AA; cursor: pointer; transition: all .15s;
}
.dp-tab:hover { border-color: #E27921; color: #E27921; }
.dp-tab-active { background: #fff4e0; border-color: #E27921; color: #C1521E; }
.dp-tab-count {
  background: #CDD0DB; color: #9197AA;
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 8px;
}
.dp-tab-active .dp-tab-count { background: #fde9cc; color: #C1521E; }

/* ── task stack ── */
.dp-stack-header {
  display: flex; align-items: center; gap: 16px;
  padding: 0 20px 12px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
  color: #9197AA; border-bottom: 1px solid #bfc3cc; margin-bottom: 8px;
}
.dp-stack { display: flex; flex-direction: column; gap: 8px; }

.dp-task-row {
  display: flex; align-items: center; gap: 16px;
  background: #dde0e8; border: 1px solid #c8ccd6;
  border-radius: 14px; padding: 18px 20px;
  border-left-width: 3px;
  transition: background .15s, transform .12s;
  animation: dpRowIn .25s ease both;
}
@keyframes dpRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
.dp-task-row:hover { background: #e8eaef; transform: translateX(3px); }
.dp-task-row.dp-task-done { opacity: 0.55; }

/* columns */
.dp-rank-col    { min-width: 80px; display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
.dp-title-col   { flex: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.dp-deadline-col { width: 120px; flex-shrink: 0; }
.dp-status-col  { width: 100px; flex-shrink: 0; }
.dp-action-col  { width: 130px; display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-shrink: 0; }

.dp-rank-num { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 800; }
.dp-priority-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px; display: inline-block; }
.dp-task-title { font-size: 15px; font-weight: 600; color: #3a2010; line-height: 1.35; }
.dp-urgency { font-size: 11px; font-weight: 700; }

.dp-deadline-btn {
  font-size: 11px; font-weight: 500; color: #C1521E; background: #fde9cc;
  padding: 4px 10px; border-radius: 7px; border: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif; transition: background .15s, color .15s; white-space: nowrap;
}
.dp-deadline-btn:hover { background: #f7d5b8; color: #a83e12; }
.dp-deadline-add {
  font-size: 11px; font-weight: 500; color: #9197AA; background: transparent;
  padding: 4px 10px; border-radius: 7px; border: 1px dashed #bfc3cc; cursor: pointer;
  font-family: 'DM Sans', sans-serif; transition: all .15s;
}
.dp-deadline-add:hover { border-color: #E27921; color: #E27921; }

.dp-status-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 7px; display: inline-block; }

.dp-action-btn {
  border: none; border-radius: 8px; padding: 6px 14px;
  font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 700;
  cursor: pointer; transition: opacity .15s; white-space: nowrap;
}
.dp-action-btn:hover { opacity: .82; }
.dp-btn-start    { background: rgba(247,181,87,.25); color: #b07010; }
.dp-btn-complete { background: rgba(226,121,33,.15); color: #E27921; }
.dp-btn-reopen   { background: rgba(193,82,30,.1);  color: #C1521E; }
.dp-del-btn {
  background: none; border: none; cursor: pointer;
  color: #bfc3cc; font-size: 13px; padding: 4px 6px; border-radius: 6px;
  transition: color .15s, background .15s;
}
.dp-del-btn:hover { color: #C1521E; background: rgba(193,82,30,.1); }

/* ── empty / loading ── */
.dp-empty { text-align: center; padding: 64px 20px; color: #9197AA; }
.dp-empty-icon { font-size: 40px; margin-bottom: 12px; }
.dp-empty p { font-size: 15px; }
.dp-loading {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 64px; color: #9197AA; font-size: 14px;
}

/* ── overlay & modal ── */
.dp-overlay {
  position: fixed; inset: 0;
  background: rgba(160,130,100,.45); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.dp-modal {
  background: #dde0e8; border: 1px solid #bfc3cc; border-radius: 22px;
  padding: 30px 26px 24px; width: 100%; max-width: 340px;
  display: flex; flex-direction: column; align-items: center; gap: 0;
  animation: dpSlideUp .22s ease;
}
@keyframes dpSlideUp {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
.dp-modal-label {
  font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700;
  color: #3a2010; margin-bottom: 18px; align-self: flex-start;
}
.dp-btn-primary {
  flex: 1; background: linear-gradient(135deg, #E27921, #F7B557);
  border: none; border-radius: 11px; padding: 12px 18px;
  font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; color: #fff;
  cursor: pointer; transition: opacity .15s; white-space: nowrap;
}
.dp-btn-primary:hover { opacity: .88; }
.dp-btn-secondary {
  flex: 1; background: #CDD0DB; border: 1px solid #bfc3cc;
  border-radius: 11px; padding: 12px 18px;
  font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; color: #9197AA;
  cursor: pointer; transition: all .15s;
}
.dp-btn-secondary:hover { border-color: #E27921; color: #E27921; }

/* ── toast ── */
.dp-toast {
  position: fixed; bottom: 24px; right: 24px;
  background: #fff4e0; border: 1px solid #E27921; border-radius: 12px;
  padding: 12px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  color: #C1521E; z-index: 2000;
  animation: dpSlideUp .25s ease;
  box-shadow: 0 4px 20px rgba(226,121,33,.15);
}

/* ── responsive ── */
@media (max-width: 760px) {
  .dp-stack-header { display: none; }
  .dp-task-row { flex-direction: column; align-items: flex-start; gap: 10px; }
  .dp-rank-col, .dp-title-col, .dp-deadline-col, .dp-status-col, .dp-action-col {
    width: auto; min-width: 0;
  }
  .dp-action-col { width: 100%; justify-content: flex-start; }
  .dp-project-title { font-size: 28px; }
}
`;