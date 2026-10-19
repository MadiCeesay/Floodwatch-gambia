import { useState } from "react";
import { LocateFixed, ListFilter, RefreshCw } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { queryString } from "../lib/api";
import { labels } from "../lib/reports";
import MapView from "../components/MapView";
import ReportCard from "../components/ReportCard";
import { Loading, Empty, ErrorState } from "../components/Feedback";
export default function Explore({ admin = false }) {
  const [filters, setFilters] = useState({
    severity: "",
    verificationStatus: "",
    responseStatus: "",
  });
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState(null);
  const [message, setMessage] = useState("");
  const resource = useResource(
    `${admin ? "/admin" : ""}/reports?${queryString({ ...filters, page, limit: 20, ...(location ? { latitude: location.latitude, longitude: location.longitude, radiusKm: 25 } : {}) })}`,
    admin,
  );
  function locate() {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable. Browse the map or report list.");
      return;
    }
    setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setPage(1);
        setMessage("Showing reports within 25 km.");
      },
      () =>
        setMessage(
          "Location was not shared. All matching reports are still available.",
        ),
      { timeout: 15000 },
    );
  }
  return (
    <div className={admin ? "admin-page" : "page"}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNITY OBSERVATIONS</p>
          <h1>Flood map</h1>
          <p>
            Explore reported conditions. This map is not a safe-route guide.
          </p>
        </div>
        <button className="button secondary" onClick={resource.reload}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>
      <div className="filter-bar">
        <ListFilter size={18} />
        <label>
          Assessment
          <select
            value={filters.severity}
            onChange={(e) => {
              setFilters({ ...filters, severity: e.target.value });
              setPage(1);
            }}
          >
            <option value="">All levels</option>
            {["unassessed", "low", "moderate", "high", "severe"].map((v) => (
              <option key={v} value={v}>
                {labels[v]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review
          <select
            value={filters.verificationStatus}
            onChange={(e) => {
              setFilters({ ...filters, verificationStatus: e.target.value });
              setPage(1);
            }}
          >
            <option value="">All reports</option>
            {(admin
              ? ["pending", "verified", "rejected"]
              : ["pending", "verified"]
            ).map((v) => (
              <option key={v} value={v}>
                {labels[v]}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary small" onClick={locate}>
          <LocateFixed size={17} />
          Near me
        </button>
        {location && (
          <button
            className="text-button"
            onClick={() => {
              setLocation(null);
              setMessage("");
              setPage(1);
            }}
          >
            Show all areas
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      <div className="explore-grid">
        <MapView
          reports={resource.data?.data || []}
          location={location}
          admin={admin}
        />
        <section className="map-report-list" aria-label="Reports shown on map">
          <div className="list-heading">
            <strong>
              {resource.data
                ? `${resource.data.pagination.total} matching reports`
                : "Community reports"}
            </strong>
            <span className="muted">Page {page}</span>
          </div>
          {resource.loading ? (
            <Loading />
          ) : resource.error ? (
            <ErrorState error={resource.error} retry={resource.reload} />
          ) : resource.data.data.length ? (
            resource.data.data.map((r) => (
              <ReportCard key={r.id || r._id} report={r} admin={admin} />
            ))
          ) : (
            <Empty text="Try a different filter or view all areas." />
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
              <span>
                {page} / {Math.max(1, resource.data.pagination.pages)}
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
        </section>
      </div>
      <p className="caption">
        The map shows the current page of reports. Pending reports are community
        observations awaiting review. Missing reports do not establish that a
        place is safe.
      </p>
    </div>
  );
}
