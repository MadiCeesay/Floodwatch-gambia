import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, CheckCircle2 } from "lucide-react";
import MapView from "./MapView";
export default function LocationPicker({ value, onChange }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  function chooseOnMap(point) {
    request.current++;
    setStatus("idle");
    setError("");
    onChange(point);
  }
  function findLocation() {
    const current = ++request.current;
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable on this device. Please choose a place on the map.",
      );
      setShowMap(true);
      return;
    }
    setStatus("finding");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== request.current) return;
        onChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationSource: "gps",
        });
        setStatus("found");
      },
      () => {
        if (current !== request.current) return;
        setStatus("idle");
        setShowMap(true);
        setError(
          "We couldn’t use your location. You can still select the flood location on the map below.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  return (
    <div className="location-picker">
      <p>Share the flood location once. We don’t track your movements.</p>
      <div className="location-actions">
        <button
          className="button primary"
          type="button"
          onClick={findLocation}
          disabled={status === "finding"}
        >
          <LocateFixed size={20} />
          {status === "finding" ? "Finding your location…" : "Use my location"}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => setShowMap((v) => !v)}
        >
          <MapPin size={19} />
          Choose on map
        </button>
      </div>
      {error && (
        <p className="notice warning" role="status">
          {error}
        </p>
      )}
      {value && (
        <p className="location-confirm" role="status">
          <CheckCircle2 size={19} />
          {value.locationSource === "gps"
            ? "Device location found"
            : "Map location selected"}
          <button
            type="button"
            className="text-button"
            onClick={() => setShowMap(true)}
          >
            Check on map
          </button>
        </p>
      )}
      {showMap && <MapView picker location={value} onPick={chooseOnMap} />}
    </div>
  );
}
