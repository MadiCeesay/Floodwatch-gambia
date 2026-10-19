import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, MapPin, Clock3, ShieldCheck } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { labels, placeOf, formatTime } from "../lib/reports";
import { Badge } from "../components/ReportCard";
import { Loading, ErrorState } from "../components/Feedback";
import MapView from "../components/MapView";
import AdminReview from "../components/AdminReview";
function Audit({ id }) {
  const resource = useResource(`/admin/reports/${id}/audit`, true);
  return (
    <details className="optional-details">
      <summary>Review history</summary>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : (
        <ol className="audit-list">
          {resource.data.data.map((item) => (
            <li key={item._id}>
              <strong>
                {item.action === "verification"
                  ? `Review: ${labels[item.changes.verificationStatus]}`
                  : item.action === "response"
                    ? `Response: ${labels[item.changes.responseStatus]}`
                    : "Observations updated"}
              </strong>
              <time>{formatTime(item.createdAt)}</time>
            </li>
          ))}
          {!resource.data.data.length && <p>No administrator changes yet.</p>}
        </ol>
      )}
    </details>
  );
}
export default function ReportDetail({ admin = false }) {
  const { id } = useParams();
  const [message, setMessage] = useState("");
  const resource = useResource(
    `${admin ? "/admin" : ""}/reports/${encodeURIComponent(id)}`,
    admin,
  );
  if (resource.loading) return <Loading text="Loading report…" />;
  if (resource.error)
    return (
      <div className="page narrow">
        <Link
          className="back-link"
          to={admin ? "/admin/reports" : "/my-reports"}
        >
          <ArrowLeft size={16} />
          Back to reports
        </Link>
        {resource.error.status === 404 ? (
          <div className="notice warning">
            <p>
              This report is no longer publicly available. Rejected reports are
              hidden from public views.
            </p>
          </div>
        ) : (
          <ErrorState error={resource.error} retry={resource.reload} />
        )}
      </div>
    );
  const report = resource.data.data;
  const point = {
    latitude: report.location.coordinates[1],
    longitude: report.location.coordinates[0],
  };
  return (
    <div className={admin ? "admin-page" : "page detail-page"}>
      <Link className="back-link" to={admin ? "/admin/reports" : "/map"}>
        <ArrowLeft size={16} />
        Back to {admin ? "reports" : "flood map"}
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REPORT {id.slice(-8).toUpperCase()}</p>
          <h1>{placeOf(report)}</h1>
          <p className="inline">
            <MapPin size={16} />
            Flood observation <span>·</span>
            <Clock3 size={16} />
            {formatTime(report.submittedAt)}
          </p>
        </div>
        <Badge value={report.verificationStatus} />
      </div>
      {message && (
        <p className="notice info" role="status">
          {message}
        </p>
      )}
      {report.verificationStatus === "pending" && (
        <div className="notice warning">
          <ShieldCheck size={22} />
          <p>
            Community report — not yet verified. Conditions may have changed
            since this observation.
          </p>
        </div>
      )}
      <div className="detail-grid">
        <section>
          <div className="detail-states">
            <div>
              <span>Assessment</span>
              <Badge value={report.severityLevel} />
            </div>
            <div>
              <span>Response</span>
              <Badge value={report.responseStatus} />
            </div>
          </div>
          {report.severityLevel === "unassessed" && (
            <p className="caption">
              Not enough observations for an assessment. This does not mean the
              situation is low risk.
            </p>
          )}
          <h2>What was reported</h2>
          {report.description && (
            <p className="report-description">{report.description}</p>
          )}
          <dl className="conditions-list">
            {[
              ["waterLevel", "Water level"],
              ["roadCondition", "Road condition"],
              ["homesAffected", "Homes affected"],
              ["peopleNeedHelp", "People need help"],
            ]
              .filter(([key]) => report[key])
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{labels[report[key]]}</dd>
                </div>
              ))}
          </dl>
          {report.photo && (
            <figure className="evidence-photo">
              <img
                src={report.photo.url}
                alt="Photo submitted with this flood report"
                loading="lazy"
              />
              <figcaption>
                Community-submitted photo ·{" "}
                {formatTime(report.photo.uploadedAt)}
              </figcaption>
            </figure>
          )}
          {admin && report.voiceRecording && (
            <section>
              <h3>Voice evidence</h3>
              <audio
                controls
                preload="none"
                src={report.voiceRecording.url}
                aria-label="Submitted voice evidence"
              />
            </section>
          )}
          {admin && (report.reporterContact || report.reporterName) && (
            <section className="private-info">
              <h3>Private reporter details</h3>
              <p>{report.reporterName}</p>
              <p>{report.reporterContact}</p>
            </section>
          )}
        </section>
        <section>
          <h2>Incident location</h2>
          <MapView compact location={point} />
          <p className="caption">
            Location supplied by the reporter. Check current conditions
            independently.
          </p>
        </section>
      </div>
      {admin && (
        <>
          <AdminReview
            report={report}
            onSaved={(text) => {
              setMessage(text);
              resource.reload();
            }}
          />
          <Audit id={id} />
        </>
      )}
    </div>
  );
}
