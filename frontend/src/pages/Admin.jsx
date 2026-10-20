import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  RefreshCw,
  Search,
  ClipboardList,
  Clock3,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import { useResource } from "../hooks/useResource";
import { api, queryString } from "../lib/api";
import { labels, idOf, placeOf, formatTime } from "../lib/reports";
import { Badge } from "../components/ReportCard";
import MapView from "../components/MapView";
import { Loading, ErrorState, Empty, FieldError } from "../components/Feedback";
import Explore from "./Explore";
function ReportTable({ resource }) {
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.reload} />;
  if (!resource.data.data.length)
    return (
      <Empty
        title="No matching reports"
        text="Try different filters. New reports will appear as people submit them."
      />
    );
  return (
    <table className="report-table">
      <caption className="sr-only">Community flood reports</caption>
      <thead>
        <tr>
          <th>Location / reference</th>
          <th>Assessment</th>
          <th>Review</th>
          <th>Response</th>
          <th>Submitted</th>
          <th>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {resource.data.data.map((r) => (
          <tr key={idOf(r)}>
            <td data-label="Location">
              <Link className="report-title" to={`/admin/reports/${idOf(r)}`}>
                {placeOf(r)}
              </Link>
              <small>{idOf(r).slice(-8).toUpperCase()}</small>
            </td>
            <td data-label="Assessment">
              <Badge value={r.severityLevel} />
            </td>
            <td data-label="Review">
              <Badge value={r.verificationStatus} />
            </td>
            <td data-label="Response">{labels[r.responseStatus]}</td>
            <td data-label="Submitted">{formatTime(r.submittedAt)}</td>
            <td>
              <Link className="text-link" to={`/admin/reports/${idOf(r)}`}>
                Review <ArrowUpRight size={15} />
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Overview() {
  const stats = useResource("/admin/dashboard", true);
  const latest = useResource("/admin/reports?limit=6", true);
  const data = stats.data?.data;
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNITY INTELLIGENCE</p>
          <h1>Operations overview</h1>
          <p>Turn incoming observations into an informed response.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            stats.reload();
            latest.reload();
          }}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>
      {stats.loading ? (
        <Loading text="Loading operational counts…" />
      ) : stats.error ? (
        <ErrorState error={stats.error} retry={stats.reload} />
      ) : (
        <div className="metrics">
          {[
            [
              ClipboardList,
              "Reports received",
              data.total,
              "All submissions, including rejected",
            ],
            [
              Clock3,
              "Awaiting review",
              data.verification.pending || 0,
              "Community observations to assess",
            ],
            [
              CircleAlert,
              "High or severe",
              (data.severity.high || 0) + (data.severity.severe || 0),
              "Non-rejected reports at these levels",
            ],
            [
              CheckCircle2,
              "Response resolved",
              data.response.resolved || 0,
              "Non-rejected reports marked resolved",
            ],
          ].map(([Icon, title, value, hint]) => (
            <section key={title}>
              <div>
                <span>{title}</span>
                <Icon size={20} />
              </div>
              <strong>{value}</strong>
              <p>{hint}</p>
            </section>
          ))}
        </div>
      )}
      <section className="operations-map">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SITUATIONAL AWARENESS</p>
            <h2>Latest report locations</h2>
          </div>
          <Link className="text-link" to="/admin/map">
            Open incident map <ArrowUpRight size={16} />
          </Link>
        </div>
        <MapView compact reports={latest.data?.data || []} admin />
        <p className="caption">
          Latest six reports. This map does not indicate safe travel routes.
        </p>
      </section>
      <section>
        <div className="section-heading">
          <h2>Recent submissions</h2>
          <Link className="text-link" to="/admin/reports">
            Manage reports <ArrowUpRight size={16} />
          </Link>
        </div>
        <ReportTable resource={latest} />
      </section>
    </div>
  );
}
function Reports() {
  const [filters, setFilters] = useState({
    verificationStatus: "",
    severity: "",
    responseStatus: "",
    community: "",
    sort: "newest",
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const resource = useResource(
    `/admin/reports?${queryString({ ...filters, page, limit: 20 })}`,
    true,
  );
  function filter(field, value) {
    setFilters({ ...filters, [field]: value });
    setPage(1);
  }
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REPORT MANAGEMENT</p>
          <h1>Community reports</h1>
          <p>Review evidence, verify observations and track the response.</p>
        </div>
        <button className="button secondary" onClick={resource.reload}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          filter("community", search.trim());
        }}
      >
        <label className="sr-only" htmlFor="community-search">
          Community name (exact match)
        </label>
        <Search size={18} />
        <input
          id="community-search"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Community name (exact match)"
        />
        <button className="button secondary small">Search</button>
        {filters.community && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSearch("");
              filter("community", "");
            }}
          >
            Clear search
          </button>
        )}
      </form>
      <div className="filter-bar">
        {[
          [
            "verificationStatus",
            "Review status",
            ["pending", "verified", "rejected"],
          ],
          [
            "severity",
            "Assessment",
            ["unassessed", "low", "moderate", "high", "severe"],
          ],
          [
            "responseStatus",
            "Response status",
            ["unassigned", "assigned", "responding", "resolved"],
          ],
        ].map(([field, name, values]) => (
          <label key={field}>
            {name}
            <select
              value={filters[field]}
              onChange={(e) => filter(field, e.target.value)}
            >
              <option value="">All</option>
              {values.map((v) => (
                <option value={v} key={v}>
                  {labels[v]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Order
          <select
            value={filters.sort}
            onChange={(e) => filter("sort", e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="severity">Highest assessment</option>
          </select>
        </label>
      </div>
      <p className="caption">
        {resource.data
          ? `${resource.data.pagination.total} matching reports`
          : "Loading reports"}
      </p>
      <ReportTable resource={resource} />
      {resource.data && (
        <div className="pagination">
          <button
            className="button secondary small"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, resource.data.pagination.pages)}
          </span>
          <button
            className="button secondary small"
            disabled={page >= resource.data.pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
function EmergencyRow({ record, onSaved }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(record.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  async function submit(e) {
    e.preventDefault();
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/emergencies/${record._id}`, {
        method: "PATCH",
        body: { status, note },
        authenticated: true,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <article className="emergency-row">
      <div className="section-heading">
        <h2>{labels[record.helpType]}</h2>
        <Badge value={record.status} />
      </div>
      <p>{record.message || "No written message provided."}</p>
      <p className="muted">
        {formatTime(record.createdAt)} · Reference{" "}
        {record._id.slice(-8).toUpperCase()}
      </p>
      {record.contact && <p>Private contact: {record.contact}</p>}
      <details className="optional-details">
        <summary>Location & review history</summary>
        <MapView
          compact
          location={{
            latitude: record.location.coordinates[1],
            longitude: record.location.coordinates[0],
          }}
        />
        <ol className="audit-list">
          {record.history.map((h) => (
            <li key={h._id}>
              <strong>{labels[h.status]}</strong>
              <p>{h.note}</p>
              <time>{formatTime(h.at)}</time>
            </li>
          ))}
        </ol>
      </details>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            Review status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["new", "acknowledged", "resolved"].map((v) => (
                <option key={v} value={v}>
                  {labels[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Private review note
            <input
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        <FieldError>{error}</FieldError>
        <button className="button secondary" disabled={busy}>
          {busy ? "Saving…" : "Save review"}
        </button>
      </form>
    </article>
  );
}
function Emergencies() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const resource = useResource(
    `/admin/emergencies?${queryString({ page, status, limit: 10 })}`,
    true,
  );
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRIVATE REQUESTS</p>
          <h1>Help requests</h1>
          <p>Requests submitted for administrator review.</p>
        </div>
        <button className="button secondary" onClick={resource.reload}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>
      <p className="notice warning">
        This queue is not linked to emergency services. Acknowledging a request
        records review only; it does not dispatch help.
      </p>
      <label className="field compact-field">
        Filter by review status
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All requests</option>
          {["new", "acknowledged", "resolved"].map((v) => (
            <option key={v} value={v}>
              {labels[v]}
            </option>
          ))}
        </select>
      </label>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : resource.data.data.length ? (
        resource.data.data.map((r) => (
          <EmergencyRow key={r._id} record={r} onSaved={resource.reload} />
        ))
      ) : (
        <Empty title="No help requests to show" />
      )}
      {resource.data && (
        <div className="pagination">
          <button
            className="button secondary small"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="button secondary small"
            disabled={page >= resource.data.pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
export default function Admin({ section }) {
  if (section === "map") return <Explore admin />;
  if (section === "reports") return <Reports />;
  if (section === "emergencies") return <Emergencies />;
  return <Overview />;
}
