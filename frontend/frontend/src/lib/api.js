const base = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
let accessToken = null;
export function setAccessToken(value) {
  accessToken = value;
}
export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export async function api(
  path,
  { method = "GET", body, signal, authenticated = false } = {},
) {
  const headers = { Accept: "application/json" };
  if (authenticated && accessToken)
    headers.Authorization = `Bearer ${accessToken}`;
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "We could not connect. Check your connection and try again.",
      0,
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      "The service returned an unexpected response. Please try again.",
      response.status,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && authenticated)
      window.dispatchEvent(new Event("auth-expired"));
    const message =
      response.status === 429
        ? "Too many attempts. Please wait before trying again."
        : response.status >= 500
          ? response.status === 503
            ? "Photo or voice storage is unavailable. Your report is still here. Remove the file and add an observation, or try later."
            : "The service is unavailable right now. Your changes have been kept. Please try again."
          : result.error?.message || "Something went wrong. Please try again.";
    throw new ApiError(message, response.status, result.error?.details);
  }
  return result;
}
export function queryString(values) {
  return new URLSearchParams(
    Object.entries(values).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  ).toString();
}
