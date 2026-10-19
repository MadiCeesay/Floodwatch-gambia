import { useRef, useState } from "react";
import { Radio, CheckCircle2 } from "lucide-react";
import LocationPicker from "../components/LocationPicker";
import { FieldError } from "../components/Feedback";
import { api } from "../lib/api";
import { labels } from "../lib/reports";
export default function Emergency() {
  const [location, setLocation] = useState(null);
  const [data, setData] = useState({
    helpType: "general",
    message: "",
    contact: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (guard.current) return;
    if (!location) {
      setError("Please share or select the place where help is needed.");
      return;
    }
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api("/emergencies", {
        method: "POST",
        body: { ...data, ...location },
      });
      setResult(response);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <div className="page narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REQUEST REVIEW</p>
          <h1>Ask for help</h1>
        </div>
        <Radio size={28} />
      </div>
      <div className="notice warning">
        <strong>
          FloodWatch does not contact or dispatch emergency services. Requests
          are stored for administrator review, with no guaranteed response. Do
          not rely on this form for urgent assistance.
        </strong>
      </div>
      {result ? (
        <div className="success-page">
          <CheckCircle2 size={40} />
          <h2>Request stored for review</h2>
          <p>{result.notice}</p>
          <p>Reference: {result.data.id.slice(-8).toUpperCase()}</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h2>Where is help needed?</h2>
          <LocationPicker value={location} onChange={setLocation} />
          <label className="field">
            What kind of help?
            <select
              value={data.helpType}
              onChange={(e) => setData({ ...data, helpType: e.target.value })}
            >
              {["general", "trapped", "evacuation", "medical"].map((v) => (
                <option key={v} value={v}>
                  {labels[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            A message (optional)
            <textarea
              rows={3}
              maxLength={500}
              value={data.message}
              onChange={(e) => setData({ ...data, message: e.target.value })}
            />
          </label>
          <label className="field">
            Contact details (optional)
            <input
              maxLength={150}
              value={data.contact}
              onChange={(e) => setData({ ...data, contact: e.target.value })}
            />
            <span className="microcopy">Visible only to administrators.</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I understand this form does not contact emergency services or
            guarantee a response.
          </label>
          <FieldError>{error}</FieldError>
          <button className="button primary" disabled={busy || !confirmed}>
            {busy ? "Saving request…" : "Send for administrator review"}
          </button>
        </form>
      )}
    </div>
  );
}
