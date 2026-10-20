import { useRef, useState } from "react";
import { CheckCircle2, Ban, Save } from "lucide-react";
import { api } from "../lib/api";
import {
  labels,
  idOf,
  waterOptions,
  roadOptions,
  yesNoOptions,
} from "../lib/reports";
import { FieldError } from "./Feedback";
export default function AdminReview({ report, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const guard = useRef(false);
  const [response, setResponse] = useState(report.responseStatus);
  const [responseNotes, setResponseNotes] = useState(
    report.responseNotes || "",
  );
  const [observations, setObservations] = useState({
    waterLevel: report.waterLevel || "",
    roadCondition: report.roadCondition || "",
    homesAffected: report.homesAffected || "",
    peopleNeedHelp: report.peopleNeedHelp || "",
    adminNotes: report.adminNotes || "",
  });
  async function save(path, body) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/reports/${idOf(report)}${path}`, {
        method: "PATCH",
        body,
        authenticated: true,
      });
      onSaved("Report updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <section className="admin-review">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AUTHORITY CONTROLS</p>
          <h2>Review & response</h2>
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <fieldset className="review-lock" disabled={busy}>
        <legend className="sr-only">Review and response actions</legend>
        {busy && <p role="status">Saving changes…</p>}
        <div className="review-columns">
          <section>
            <h3>Verify this observation</h3>
            <p>Inspect the evidence and location before making a decision.</p>
            <button
              className="button primary"
              disabled={busy || report.verificationStatus === "verified"}
              onClick={() =>
                save("/verification", { verificationStatus: "verified" })
              }
            >
              <CheckCircle2 size={17} />
              Mark as verified
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  window.confirm(
                    "Reject this report? It will be removed from public views.",
                  )
                )
                  save("/verification", {
                    verificationStatus: "rejected",
                    rejectionReason: reason.trim(),
                  });
              }}
            >
              <label className="field">
                Reason for rejection
                <textarea
                  rows={2}
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="button danger-outline"
                disabled={
                  busy ||
                  report.verificationStatus === "rejected" ||
                  report.responseStatus !== "unassigned"
                }
              >
                <Ban size={17} />
                Reject report
              </button>
              {report.responseStatus !== "unassigned" && (
                <p className="microcopy">
                  Reset response to awaiting response before rejecting.
                </p>
              )}
            </form>
            {report.rejectionReason && (
              <p className="notice warning">
                Previous rejection: {report.rejectionReason}
              </p>
            )}
          </section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save("/response", { responseStatus: response, responseNotes });
            }}
          >
            <h3>Track the response</h3>
            <p>Response updates require a verified report.</p>
            <label className="field">
              Response progress
              <select
                value={response}
                onChange={(e) => setResponse(e.target.value)}
              >
                {["unassigned", "assigned", "responding", "resolved"].map(
                  (v) => (
                    <option value={v} key={v}>
                      {labels[v]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              Private response notes
              <textarea
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy || report.verificationStatus !== "verified"}
            >
              <Save size={17} />
              Save response
            </button>
          </form>
        </div>
        <details className="optional-details">
          <summary>Update observations and private notes</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(
                "",
                Object.fromEntries(
                  Object.entries(observations).filter(
                    ([key, value]) => value !== "" || key === "adminNotes",
                  ),
                ),
              );
            }}
          >
            <div className="form-grid">
              {[
                ["waterLevel", "Water level", waterOptions],
                ["roadCondition", "Road condition", roadOptions],
                ["homesAffected", "Homes affected", yesNoOptions],
                ["peopleNeedHelp", "People need help", yesNoOptions],
              ].map(([key, label, options]) => (
                <label key={key} className="field">
                  {label}
                  <select
                    value={observations[key]}
                    onChange={(e) =>
                      setObservations({
                        ...observations,
                        [key]: e.target.value,
                      })
                    }
                  >
                    <option value="">Not supplied</option>
                    {options.map((v) => (
                      <option key={v} value={v}>
                        {labels[v]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="field">
              Private administrator notes
              <textarea
                rows={3}
                value={observations.adminNotes}
                onChange={(e) =>
                  setObservations({
                    ...observations,
                    adminNotes: e.target.value,
                  })
                }
                maxLength={2000}
              />
            </label>
            <p className="microcopy">
            The assessment updates automatically from known observations.
            </p>
            <button className="button secondary" disabled={busy}>
              <Save size={17} />
              Save observations
            </button>
          </form>
        </details>
      </fieldset>
    </section>
  );
}
