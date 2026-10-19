import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
  Send,
  MapPin,
} from "lucide-react";
import LocationPicker from "../components/LocationPicker";
import ChoiceGroup from "../components/ChoiceGroup";
import MediaEvidence from "../components/MediaEvidence";
import { FieldError } from "../components/Feedback";
import { api } from "../lib/api";
import {
  waterOptions,
  roadOptions,
  yesNoOptions,
  labels,
  hasEvidence,
  reportBody,
  rememberReport,
  formatTime,
} from "../lib/reports";
export default function ReportFlow() {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState(null);
  const [data, setData] = useState({
    description: "",
    community: "",
    reporterContact: "",
    anonymous: true,
  });
  const [photo, setPhoto] = useState(null);
  const [voice, setVoice] = useState(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(true);
  const guard = useRef(false);
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step, result]);
  const set = (field, value) => setData((old) => ({ ...old, [field]: value }));
  async function submit(e) {
    e.preventDefault();
    if (guard.current || mediaBusy) return;
    setError("");
    if (step === 1) {
      if (!location) {
        setError(
          "Please share your location or choose the flood location on the map.",
        );
        return;
      }
      setStep(2);
      return;
    }
    if (!hasEvidence(data, photo, voice)) {
      setError(
        "Add a photo, voice message, short description or one observation you know.",
      );
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    guard.current = true;
    setBusy(true);
    try {
      const response = await api("/reports", {
        method: "POST",
        body: reportBody(data, location, photo, voice),
      });
      setSaved(rememberReport(response.data.id));
      setResult(response.data);
    } catch (e) {
      setError(
        e.message +
          (e.details?.length ? " Check your entries and try again." : ""),
      );
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  if (result)
    return (
      <div className="page narrow success-page">
        <CheckCircle2 size={52} />
        <p className="eyebrow">OBSERVATION RECEIVED</p>
        <h1 ref={heading} tabIndex="-1">
          Thank you for speaking up.
        </h1>
        <p>
          Your report is awaiting review. It can help people understand what’s
          happening.
        </p>
        <div className="receipt">
          <span>Report reference</span>
          <strong>{result.id.slice(-8).toUpperCase()}</strong>
          <span>{formatTime(result.submittedAt)} · Awaiting review</span>
        </div>
        {!saved && (
          <p className="notice warning">
            This browser couldn’t save your report reference. Keep the link to
            check it later.
          </p>
        )}
        <div className="inline wrap">
          <Link className="button primary" to={`/reports/${result.id}`}>
            View your report <ArrowRight size={18} />
          </Link>
          <Link className="button secondary" to="/">
            Back to home
          </Link>
        </div>
        <p className="caption">
          Submitting a report does not request or guarantee emergency
          assistance.
        </p>
      </div>
    );
  return (
    <div className="page narrow">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        Back to community watch
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SHARE AN OBSERVATION</p>
          <h1>Report flooding</h1>
          <p>Only report from somewhere safe. Share what you know.</p>
        </div>
        <ShieldCheck size={29} className="teal" />
      </div>
      <ol className="stepper" aria-label="Reporting progress">
        {["Location", "What you see", "Review & send"].map((text, i) => (
          <li
            key={text}
            className={
              step === i + 1 ? "current" : step > i + 1 ? "complete" : ""
            }
            aria-current={step === i + 1 ? "step" : undefined}
          >
            <span>{step > i + 1 ? <Check size={16} /> : i + 1}</span>
            {text}
          </li>
        ))}
      </ol>
      <form onSubmit={submit}>
        <h2 ref={heading} tabIndex="-1" className="step-heading">
          {step === 1
            ? "Where is the flooding?"
            : step === 2
              ? "What are you seeing?"
              : "Ready to share?"}
        </h2>
        {step === 1 && (
          <LocationPicker value={location} onChange={setLocation} />
        )}
        {step === 2 && (
          <>
            <MediaEvidence
              photo={photo}
              voice={voice}
              onPhoto={setPhoto}
              onVoice={setVoice}
              onBusy={setMediaBusy}
            />
            <label className="field">
              A few words, if you like{" "}
              <span className="optional">Optional</span>
              <textarea
                maxLength={500}
                rows={3}
                value={data.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="For example: water is covering the road near the market"
              />
              <span className="microcopy">{data.description.length}/500</span>
            </label>
            <div className="observations">
              <h2>Or choose what you know</h2>
              <p>These questions are optional. It’s fine to be unsure.</p>
              <ChoiceGroup
                legend="How high is the water?"
                options={waterOptions}
                value={data.waterLevel}
                onChange={(v) => set("waterLevel", v)}
              />
              <ChoiceGroup
                legend="Can vehicles pass?"
                options={roadOptions}
                value={data.roadCondition}
                onChange={(v) => set("roadCondition", v)}
              />
              <ChoiceGroup
                legend="Are homes affected?"
                options={yesNoOptions}
                value={data.homesAffected}
                onChange={(v) => set("homesAffected", v)}
              />
              <ChoiceGroup
                legend="Do people need help?"
                options={yesNoOptions}
                value={data.peopleNeedHelp}
                onChange={(v) => set("peopleNeedHelp", v)}
              />
            </div>
            <details className="optional-details">
              <summary>Add a place name or contact details (optional)</summary>
              <label className="field">
                Community or nearby landmark
                <input
                  value={data.community}
                  maxLength={100}
                  onChange={(e) => set("community", e.target.value)}
                />
              </label>
              <label className="field">
                Contact number or email
                <input
                  value={data.reporterContact}
                  maxLength={150}
                  onChange={(e) => set("reporterContact", e.target.value)}
                />
                <span className="microcopy">
                  Private. Only authorised administrators can see this.
                </span>
              </label>
            </details>
          </>
        )}
        {step === 3 && (
          <>
            <p>Check your observation before sending.</p>
            <dl className="review-summary">
              <div>
                <dt>
                  <MapPin size={18} />
                  Flood location
                </dt>
                <dd>
                  {location?.locationSource === "gps"
                    ? "Device location shared"
                    : "Selected on map"}
                </dd>
              </div>
              {data.community && (
                <div>
                  <dt>Place</dt>
                  <dd>{data.community}</dd>
                </div>
              )}
              {data.description && (
                <div>
                  <dt>Your words</dt>
                  <dd>{data.description}</dd>
                </div>
              )}
              {[
                ["waterLevel", "Water level"],
                ["roadCondition", "Road"],
                ["homesAffected", "Homes affected"],
                ["peopleNeedHelp", "People need help"],
              ]
                .filter(([key]) => data[key])
                .map(([key, name]) => (
                  <div key={key}>
                    <dt>{name}</dt>
                    <dd>{labels[data[key]]}</dd>
                  </div>
                ))}
              <div>
                <dt>Evidence</dt>
                <dd>
                  {[
                    photo && "Photo attached",
                    voice && "Voice message attached",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Your observations"}
                </dd>
              </div>
            </dl>
            <div className="notice info">
              <ShieldCheck size={22} />
              <p>
                Your flood location, photo and observations will be public.
                Voice messages and contact details are only listed for
                administrators. Avoid sharing identifying details in photos or
                descriptions.
              </p>
            </div>
            <p className="caption">
              This is a community report, not an emergency call. Your
              observation will be marked as awaiting review.
            </p>
          </>
        )}
        <FieldError>{error}</FieldError>
        <div className="form-actions">
          {step > 1 ? (
            <button
              type="button"
              className="button secondary"
              disabled={busy || mediaBusy}
              onClick={() => {
                setError("");
                setStep((s) => s - 1);
              }}
            >
              <ArrowLeft size={17} />
              Back
            </button>
          ) : (
            <span className="microcopy">No account needed</span>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={busy || mediaBusy}
          >
            {busy
              ? "Sending report…"
              : step === 3
                ? "Send report"
                : step === 2
                  ? "Review report"
                  : "Continue"}
            {step === 3 ? <Send size={17} /> : <ArrowRight size={17} />}
          </button>
        </div>
      </form>
      <p className="draft-note">
        Your draft stays here while you move between these steps. Leaving this
        page will discard it.
      </p>
    </div>
  );
}
