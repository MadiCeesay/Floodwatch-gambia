import { useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  ArrowRight,
  Plus,
  ShieldCheck,
  LocateFixed,
  Waves,
} from "lucide-react";
import { useResource } from "../hooks/useResource";
import { queryString } from "../lib/api";
import MapView from "../components/MapView";
import ReportCard from "../components/ReportCard";
import { Loading, ErrorState, Empty } from "../components/Feedback";
export default function Home() {
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const path = location
    ? `/reports/nearby?${queryString({ ...location, radiusKm: 25, limit: 5 })}`
    : "/reports?limit=5";
  const resource = useResource(path);
  const reports = resource.data?.data || [];
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location is unavailable. Explore reports on the map.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocating(false);
        setLocationMessage("Showing reports within 25 km of you.");
      },
      () => {
        setLocationMessage(
          "Location was not shared. You can still explore all reports.",
        );
        setLocating(false);
      },
      { timeout: 15000 },
    );
  }
  return (
    <div className="page home">
      <div className="location-strip">
        <span>
          <MapPin size={17} />
          {location
            ? "Your area · within 25 km"
            : "Community watch · The Gambia"}
        </span>
        <button className="text-button" onClick={locate} disabled={locating}>
          <LocateFixed size={16} />
          {locating ? "Finding you…" : "Use my location"}
        </button>
      </div>
      {locationMessage && (
        <p className="muted" role="status">
          {locationMessage}
        </p>
      )}
      <div className="home-heading">
        <div>
          <p className="eyebrow">LOCAL KNOWLEDGE. SHARED SAFETY.</p>
          <h1>
            A clearer picture, <br />a safer community.
          </h1>
          <p>See what people are reporting. Share what’s happening near you.</p>
        </div>
        <div className="report-callout">
          <span className="callout-icon">
            <Waves size={27} />
          </span>
          <h2>Seeing flooding?</h2>
          <p>
            A photo, a voice message or a quick observation can make a
            difference.
          </p>
          <Link className="button primary" to="/report">
            <Plus size={19} />
            Report flooding <ArrowRight size={18} />
          </Link>
          <span className="microcopy">
            No account needed · Share only what you know
          </span>
        </div>
      </div>
      <section className="home-map-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE COMMUNITY PICTURE</p>
            <h2>Flooding, on the map</h2>
          </div>
          <Link className="text-link" to="/map">
            Explore full map <ArrowRight size={17} />
          </Link>
        </div>
        <MapView compact reports={reports} location={location} />
        <p className="caption">
          {location
            ? "Up to five latest nearby observations."
            : "Up to five latest community observations across The Gambia."}{" "}
          Reports may be unverified. A clear map does not mean an area is safe.
        </p>
      </section>
      <div className="home-lower">
        <section>
          <div className="section-heading">
            <h2>{location ? "Near you" : "Latest reports"}</h2>
            <Link className="text-link" to="/map">
              View reports <ArrowRight size={16} />
            </Link>
          </div>
          {resource.loading ? (
            <Loading />
          ) : resource.error ? (
            <ErrorState error={resource.error} retry={resource.reload} />
          ) : reports.length ? (
            reports.map((r) => <ReportCard key={r.id} report={r} />)
          ) : (
            <Empty
              title="No reports here yet"
              text="You can help build the picture by sharing an observation."
            />
          )}
        </section>
        <aside className="safety-aside">
          <ShieldCheck size={27} />
          <p className="eyebrow">BEFORE YOU REPORT</p>
          <h2>Your safety comes first.</h2>
          <p>
            Only report from a safe place. You don’t need to approach floodwater
            to help.
          </p>
          <Link className="text-link" to="/safety">
            Read flood safety guidance <ArrowRight size={17} />
          </Link>
          <div className="aside-rule" />
          <h3>Need to ask for help?</h3>
          <p>
            FloodWatch can store a request for review. It does not contact
            emergency services.
          </p>
          <Link className="text-link" to="/help">
            About help requests <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
