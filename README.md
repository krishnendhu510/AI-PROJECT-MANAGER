# 🤖 AI Work Organizer

An AI-powered task and project management web app built with Next.js, FastAPI, and Groq AI.

🔗 **Live Demo:** https://ai-project-manager-liart.vercel.app

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure login and signup
- 🤖 **AI Task Creation** — Describe tasks in natural language, AI extracts title, priority, deadline and project
- 🎤 **Voice Input** — Add tasks using your voice
- 📋 **Kanban Board** — Visualize tasks across Pending, In Progress, and Completed
- 📅 **Calendar & Time Picker** — Set deadlines with date and time
- 📆 **Weekly View** — See tasks due this week ranked by priority
- 🗃 **Archive** — Archive completed tasks to keep board clean
- 🌙 **Dark / Light Mode** — Toggle between themes
- ⌨️ **Keyboard Shortcuts** — N, B, W, A, P, D, Esc
- 🔍 **Project Search** — Search and navigate projects instantly
- 📤 **CSV Export** — Export all tasks to spreadsheet
- 🗓 **Google Calendar Sync** — Sync deadlines to Google Calendar

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React |
| Backend | FastAPI, Python |
| Database | SQLite |
| AI | Groq API (LLaMA 3.3 70B) |
| Auth | JWT (JSON Web Tokens) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key (free at console.groq.com)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file inside the `backend` folder:

```
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_secret_key
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file inside the `frontend` folder:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Run the frontend:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📁 Project Structure

```
AI-PROJECT-MANAGER/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes (tasks, projects, auth, ai)
│   │   ├── models/       # SQLAlchemy models (user, task, project)
│   │   ├── core/         # JWT auth logic
│   │   ├── ai/           # Groq AI task extractor
│   │   └── database/     # Database connection
│   ├── main.py           # App entry point
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── assistant/    # Main Kanban board
    │   ├── login/        # Login and signup page
    │   └── layout.tsx
    └── services/
        └── api.js        # Axios API instance
```

---

## 🌐 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://ai-project-manager-liart.vercel.app |
| Backend | Railway | https://ai-project-manager-production-3335.up.railway.app |

---

## 👨‍💻 Author

**Krishnendhu Santhosh**
- GitHub: [@krishnendhu510](https://github.com/krishnendhu510)
