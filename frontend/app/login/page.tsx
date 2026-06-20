"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../services/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]       = useState("login"); // "login" | "signup"
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      let res;
      if (mode === "signup") {
        res = await api.post("/auth/register", null, { params: { name, email, password } });
      } else {
        res = await api.post("/auth/login", null, { params: { email, password } });
      }
      localStorage.setItem("aw_token", res.data.access_token);
      localStorage.setItem("aw_user", res.data.name);
      router.push("/assistant");
    } catch (e) {
      setError((e as any)?.response?.data?.detail || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="auth-bg">
        <div className="auth-card">
          <div className="auth-logo">✦</div>
          <h1 className="auth-title">Work Organizer</h1>
          <p className="auth-sub">AI-powered task management</p>

          <div className="auth-tabs">
            <button className={`auth-tab ${mode==="login"?"auth-tab-active":""}`} onClick={()=>{setMode("login");setError("");}}>Sign In</button>
            <button className={`auth-tab ${mode==="signup"?"auth-tab-active":""}`} onClick={()=>{setMode("signup");setError("");}}>Sign Up</button>
          </div>

          {mode === "signup" && (
            <input className="auth-input" placeholder="Your name" value={name}
              onChange={e=>setName(e.target.value)} />
          )}
          <input className="auth-input" placeholder="Email address" type="email"
            value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          <input className="auth-input" placeholder="Password" type="password"
            value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="auth-spinner"/> : null}
            {loading ? "Please wait..." : mode==="login" ? "Sign In →" : "Create Account →"}
          </button>

          <p className="auth-switch">
            {mode === "login" ? (
              <>No account? <button className="auth-switch-btn" onClick={() => { setMode("signup"); setError(""); }}>Sign up here</button></>
            ) : (
              <>Already have an account? <button className="auth-switch-btn" onClick={() => { setMode("login"); setError(""); }}>Sign in</button></>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: #CDD0DB; }

.auth-bg {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #CDD0DB 0%, #e8ddd0 100%);
  padding: 20px;
}
.auth-card {
  background: #f5efe8;
  border: 1px solid #e0d0c0;
  border-radius: 28px;
  padding: 48px 40px 40px;
  width: 100%; max-width: 420px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.12);
}
.auth-logo {
  font-size: 36px; color: #E27921;
  background: linear-gradient(135deg, #E27921, #C1521E);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  font-family: 'Syne', sans-serif; font-weight: 800;
  margin-bottom: 4px;
}
.auth-title {
  font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800;
  background: linear-gradient(135deg, #E27921, #C1521E);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.auth-sub { font-size: 13px; color: #9197AA; margin-top: -6px; margin-bottom: 6px; }

.auth-tabs {
  display: flex; width: 100%;
  background: #e8e0d8; border-radius: 12px; padding: 4px; gap: 4px;
}
.auth-tab {
  flex: 1; padding: 9px; border-radius: 9px; border: none;
  font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all .18s; color: #9197AA; background: transparent;
}
.auth-tab-active { background: #fff; color: #C1521E; box-shadow: 0 2px 8px rgba(0,0,0,.08); }

.auth-input {
  width: 100%; background: #fff8f0; border: 1px solid #e0d0c0;
  border-radius: 12px; padding: 14px 16px;
  font-family: 'DM Sans', sans-serif; font-size: 14px; color: #2a1f14;
  outline: none; transition: border-color .15s;
}
.auth-input:focus { border-color: #E27921; box-shadow: 0 0 0 3px rgba(226,121,33,.1); }
.auth-input::placeholder { color: #9197AA; }

.auth-error {
  width: 100%; padding: 11px 16px; border-radius: 10px;
  background: rgba(193,82,30,.1); border: 1px solid rgba(193,82,30,.3);
  color: #C1521E; font-size: 13px; font-weight: 500; text-align: center;
}
.auth-btn {
  width: 100%; padding: 15px;
  background: linear-gradient(135deg, #E27921, #C1521E);
  border: none; border-radius: 12px;
  font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700;
  color: #fff; cursor: pointer; transition: opacity .15s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 4px;
}
.auth-btn:hover:not(:disabled) { opacity: .9; }
.auth-btn:disabled { opacity: .5; cursor: not-allowed; }
.auth-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
  border-radius: 50%; animation: spin .6s linear infinite;
}
.auth-switch {
  font-size: 13px; color: #9197AA; text-align: center;
}
.auth-switch-btn {
  background: none; border: none; cursor: pointer;
  color: #E27921; font-size: 13px; font-weight: 600;
  font-family: 'DM Sans', sans-serif; padding: 0;
  text-decoration: underline; transition: color .15s;
}
.auth-switch-btn:hover { color: #C1521E; }
@keyframes spin { to { transform: rotate(360deg); } }
`;