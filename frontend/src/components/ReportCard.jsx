import { Link } from "react-router-dom";
import { MapPin, ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { labels, idOf, placeOf, formatTime } from "../lib/reports";
export function Badge({ value }) {
  return (
    <span className={`badge ${value}`}>
      {value === "verified" ? (
        <CheckCircle2 size={13} />
      ) : value === "pending" ? (
        <Clock3 size={13} />
      ) : null}
      {labels[value] || value}
    </span>
  );
}
export default function ReportCard({ report, admin = false }) {
  return (
    <article className="report-row">
      <div className={`incident-symbol ${report.severityLevel}`}>
        <MapPin size={21} />
      </div>
      <div className="report-row-body">
        <div className="inline wrap">
          <Link
            className="report-title"
            to={`${admin ? "/admin" : ""}/reports/${idOf(report)}`}
          >
            {placeOf(report)}
          </Link>
          <Badge value={report.verificationStatus} />
        </div>
        <p>
          {report.description ||
            labels[report.roadCondition] ||
            labels[report.waterLevel] ||
            "Community flood observation"}
        </p>
        <div className="report-meta">
          <time dateTime={report.submittedAt}>
            {formatTime(report.submittedAt)}
          </time>
          <span>{labels[report.severityLevel]}</span>
          <span>{labels[report.responseStatus]}</span>
        </div>
      </div>
      <Link
        className="icon-button"
        to={`${admin ? "/admin" : ""}/reports/${idOf(report)}`}
        aria-label={`View report in ${placeOf(report)}`}
      >
        <ArrowUpRight size={19} />
      </Link>
    </article>
  );
}
