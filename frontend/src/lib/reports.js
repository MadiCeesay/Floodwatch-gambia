export const labels = {
  unassessed: "Not yet assessed",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  pending: "Awaiting review",
  verified: "Verified",
  rejected: "Rejected",
  unassigned: "Awaiting response",
  assigned: "Team assigned",
  responding: "Response in progress",
  resolved: "Resolved",
  shallow: "Shallow water",
  ankle: "Ankle deep",
  knee: "Knee deep",
  waist_or_higher: "Waist deep or higher",
  unknown: "Not sure",
  passable: "Vehicles can pass",
  difficult: "Difficult to pass",
  blocked: "Road blocked",
  not_applicable: "No road here",
  yes: "Yes",
  no: "No",
  new: "New request",
  acknowledged: "Acknowledged",
  general: "General help",
  trapped: "Trapped",
  evacuation: "Help leaving",
  medical: "Medical help",
};
export const waterOptions = [
  "shallow",
  "ankle",
  "knee",
  "waist_or_higher",
  "unknown",
];
export const roadOptions = [
  "passable",
  "difficult",
  "blocked",
  "not_applicable",
  "unknown",
];
export const yesNoOptions = ["yes", "no", "unknown"];
export const idOf = (report) => report.id || report._id;
export const placeOf = (report) =>
  report.community ||
  report.district ||
  report.region ||
  (report.locationSource === "gps"
    ? "Device-shared location"
    : "Map-selected location");
export function formatTime(time) {
  return time
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(time))
    : "Time unavailable";
}
const key = "floodwatch-report-references";
export function savedReports() {
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(values)
      ? values.filter((id) => /^[a-f\d]{24}$/i.test(id)).slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function rememberReport(id) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        [id, ...savedReports().filter((old) => old !== id)].slice(0, 50),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearSavedReports() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage blocked. */
  }
}
export function hasEvidence(data, photo, voice) {
  return Boolean(
    photo ||
    voice ||
    data.description?.trim() ||
    (data.waterLevel && data.waterLevel !== "unknown") ||
    (data.roadCondition &&
      !["unknown", "not_applicable"].includes(data.roadCondition)) ||
    (data.homesAffected && data.homesAffected !== "unknown") ||
    (data.peopleNeedHelp && data.peopleNeedHelp !== "unknown"),
  );
}
export function reportBody(data, location, photo, voice) {
  const input = {
    ...Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== ""),
    ),
    ...location,
  };
  if (!photo && !voice) return input;
  const form = new FormData();
  for (const [key, value] of Object.entries(input))
    form.append(key, String(value));
  if (photo) form.append("photo", photo);
  if (voice) form.append("voiceRecording", voice, voice.name || "message.webm");
  return form;
}
