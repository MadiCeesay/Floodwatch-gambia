import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Link } from "react-router-dom";
import { labels, idOf, placeOf } from "../lib/reports";
const colors = {
  unassessed: "#617687",
  low: "#187a64",
  moderate: "#9e6418",
  high: "#c35224",
  severe: "#ba303b",
};
function MapController({ location, reports, picker, onPick }) {
  const map = useMap();
  useEffect(() => {
    if (location)
      map.setView([location.latitude, location.longitude], 14, {
        animate: false,
      });
    else if (reports.length)
      map.fitBounds(
        reports.map((r) => [
          r.location.coordinates[1],
          r.location.coordinates[0],
        ]),
        { padding: [35, 35], maxZoom: 13, animate: false },
      );
  }, [location, reports, map]);
  useMapEvents({
    click: (e) => {
      if (picker) {
        const point = map.wrapLatLng(e.latlng);
        onPick({
          latitude: point.lat,
          longitude: point.lng,
          locationSource: "map",
        });
      }
    },
  });
  return null;
}
const noReports = [];
export default function MapView({
  reports = noReports,
  location,
  picker = false,
  onPick,
  admin = false,
  compact = false,
}) {
  const mapRef = useRef(null);
  function chooseCenter() {
    const center = mapRef.current?.getCenter().wrap();
    if (center)
      onPick({
        latitude: center.lat,
        longitude: center.lng,
        locationSource: "map",
      });
  }
  const [tileError, setTileError] = useState(false);
  return (
    <div className={`map-frame ${compact ? "compact" : ""}`}>
      <div
        role="region"
        aria-label={
          picker
            ? "Choose flood location on map"
            : "Community flood reports map"
        }
        className="map-canvas"
      >
        <MapContainer
          ref={mapRef}
          center={
            location ? [location.latitude, location.longitude] : [13.45, -15.4]
          }
          zoom={location ? 14 : 8}
          scrollWheelZoom={!compact}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url={
              import.meta.env.VITE_MAP_TILE_URL ||
              "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <MapController
            location={location}
            reports={reports}
            picker={picker}
            onPick={onPick}
          />
          {reports
            .filter((r) => r.location?.coordinates?.length === 2)
            // Draw higher assessments last so they stay visible at shared locations.
            .sort((a, b) => (a.severityScore ?? -1) - (b.severityScore ?? -1))
            .map((r) => (
              <CircleMarker
                key={idOf(r)}
                center={[r.location.coordinates[1], r.location.coordinates[0]]}
                radius={9}
                pathOptions={{
                  color: "#fff",
                  weight: 2,
                  fillColor: colors[r.severityLevel],
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>{placeOf(r)}</strong>
                  <p>
                    {labels[r.severityLevel]} · {labels[r.verificationStatus]}
                  </p>
                  <Link to={`${admin ? "/admin" : ""}/reports/${idOf(r)}`}>
                    View report
                  </Link>
                </Popup>
              </CircleMarker>
            ))}
          {location && (
            <CircleMarker
              center={[location.latitude, location.longitude]}
              radius={10}
              pathOptions={{
                color: "#fff",
                weight: 3,
                fillColor: "#1468b1",
                fillOpacity: 1,
              }}
            >
              <Popup>
                {picker ? "Selected incident location" : "Selected location"}
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      {picker && (
        <div className="map-picker-actions">
          <p>
            Tap the incident location, or move the map and choose its centre.
          </p>
          <button
            type="button"
            className="button secondary small"
            onClick={chooseCenter}
          >
            Use map centre
          </button>
        </div>
      )}
      {tileError && (
        <p className="map-warning" role="status">
          {picker
            ? "The map could not load. Check your connection or use device location before selecting a place."
            : "Map tiles could not load. Check your connection; report information is available in the list."}
        </p>
      )}
      {!picker && (
        <div className="map-legend">
          {["unassessed", "low", "moderate", "high", "severe"].map((value) => (
            <span key={value}>
              <i style={{ background: colors[value] }} />
              {value === "unassessed" ? "Unassessed" : labels[value]}
            </span>
          ))}
          <span>Tap a marker for details</span>
        </div>
      )}
    </div>
  );
}
