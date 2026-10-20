import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { FieldError } from "../components/Feedback";
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  async function submit(e) {
    e.preventDefault();
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      const from = location.state?.from;
      navigate(from?.startsWith("/admin") ? from : "/admin", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <div className="page login-page">
      <div className="login-intro">
        <LockKeyhole size={32} />
        <p className="eyebrow">FOR AUTHORISED TEAMS</p>
        <h1>Authority workspace</h1>
        <p>Review community observations and coordinate your response.</p>
        <span className="caption">
          Citizens do not need an account to report flooding.
        </span>
      </div>
      <form className="login-form" onSubmit={submit}>
        <h2>Sign in</h2>
        <p>Use the administrator account provided by your team.</p>
        <label className="field">
          Email address
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <FieldError>{error}</FieldError>
        <button className="button primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in to workspace"}
          <ArrowRight size={17} />
        </button>
        <p className="microcopy">
          Access is restricted. Contact your team administrator if you need an
          account.
        </p>
      </form>
    </div>
  );
}
