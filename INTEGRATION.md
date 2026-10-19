# Existing frontend/backend integration audit

## Scope and application locations

The active tracked applications are `backend/` and `frontend/frontend/`. The outer `frontend/` directory is a wrapper, not an npm application. A separate nested repository copy exists at `Floodwatch-gambia/`; it was not edited or used. No UI design, styles, backend application routes, schemas, authorization rules or dependency versions were changed. Neither application was rebuilt or replaced for this audit.

## Complete backend endpoint inventory and frontend consumers

The API base is `/api/v1`, except readiness at `/api/health`. All protected endpoints require a Bearer JWT for a current active database user with role `admin`. The frontend verifies restored sessions through `/auth/me`.

| Method | Full endpoint | Access | Existing frontend consumer |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Local startup/readiness verification; no citizen control |
| POST | `/api/v1/auth/login` | Public, admin credentials | Authority sign-in |
| GET | `/api/v1/auth/me` | Admin | Login completion and session restoration |
| POST | `/api/v1/reports` | Public | Three-step citizen reporting; JSON or FormData |
| GET | `/api/v1/reports` | Public | Home, flood map, filtering and pagination |
| GET | `/api/v1/reports/nearby` | Public | Home after device-location permission |
| GET | `/api/v1/reports/:id` | Public, rejected hidden | Report details and device-saved My Reports references |
| GET | `/api/v1/safety` | Public | Stay safe guidance and source attribution |
| POST | `/api/v1/emergencies` | Public | Private request for administrator review; no dispatch |
| GET | `/api/v1/admin/dashboard` | Admin | Authority overview counts |
| GET | `/api/v1/admin/reports` | Admin | Recent submissions, report management, authority map |
| GET | `/api/v1/admin/reports/:id` | Admin | Full report evidence, contacts and private notes |
| GET | `/api/v1/admin/reports/:id/audit` | Admin | Review history |
| PATCH | `/api/v1/admin/reports/:id` | Admin | Observation and private administrator-note editing |
| PATCH | `/api/v1/admin/reports/:id/verification` | Admin | Verification or rejection with reason |
| PATCH | `/api/v1/admin/reports/:id/response` | Admin; report verified | Response progress and private response notes |
| GET | `/api/v1/admin/emergencies` | Admin | Paginated private help queue with status filter |
| PATCH | `/api/v1/admin/emergencies/:id` | Admin | Help-request review status and private history note |

This table accounts for all backend application endpoints and all frontend service requests. CORS also handles browser OPTIONS preflights; these are middleware responses, not additional application resources.

## Contract comparison

- URLs and methods already matched the backend. No renamed endpoints or invented endpoints were necessary.
- Single resources use `{ data }`; lists use `{ data, pagination: { page, limit, total, pages } }`. Errors use `{ error: { message, details? } }`. Public reports expose `id`; private Mongoose reports expose `_id`. The existing `idOf` helper handles both.
- Report submission requires `latitude`, `longitude`, `locationSource` (`gps`/`map`) and meaningful evidence. Optional fields sent by the UI are `description`, `community`, `reporterContact`, `anonymous`, `waterLevel`, `roadCondition`, `homesAffected` and `peopleNeedHelp`. Empty optional text is omitted. The frontend never submits severity, verification, response or timestamp fields for public creation.
- Water values match `shallow/ankle/knee/waist_or_higher/unknown`; roads match `passable/difficult/blocked/not_applicable/unknown`; homes/help match `yes/no/unknown`. Backend-calculated assessment values match `unassessed/low/moderate/high/severe`. Missing observations remain unassessed.
- JSON carries numeric latitude/longitude; multipart string values are parsed by the existing backend validator. MongoDB stores GeoJSON `[longitude, latitude]`, while Leaflet renders `[latitude, longitude]`. Map-selected longitude is now wrapped into the backend's accepted `[-180, 180]` range when panning across repeated world copies.
- Photo uses multipart field `photo`, JPEG/PNG/WebP, at most 5 MiB. Voice uses `voiceRecording`, supported browser audio types, at most 10 MiB. Browser-generated FormData boundaries are preserved; no JSON Content-Type is added to file requests. Persistent upload success depends on actual Cloudinary configuration.
- Filters match the validator: page/limit, severity, verificationStatus, responseStatus, community and sort; map queries add latitude/longitude/radiusKm together. Home calls the nearby endpoint with radius 25 km and limit 5; maps use 20-item pages. Community search matches exactly, as the backend requires.
- Verification sends `verificationStatus: verified/rejected` and, for rejection, `rejectionReason`. Response sends `responseStatus: unassigned/assigned/responding/resolved` and optional `responseNotes`. Observation editing sends known observations and `adminNotes`; the server recalculates severity. Existing 409 workflow rules are respected.
- SOS sends location plus `helpType: general/trapped/evacuation/medical`, optional message/contact. Private reviews send `status: new/acknowledged/resolved` and optional note. Its response notice is shown without claiming emergency dispatch.
- There is no citizen registration/login, citizen-account history, live-alert API or server logout/revocation endpoint. No such frontend requests exist. My Reports fetches real reports by device-saved references; Stay safe fetches real guidance rather than fabricating alerts. Logout removes the browser token and restores the route guard; issued JWTs expire normally server-side.
- Production source contains no mock reports, fake counters, fake alerts or fake successful submissions. Test-only fixtures and injected failure cases are confined to `tests/` and a disposable MongoDB replica set.

## Integration fixes

1. Corrected test imports and startup/documentation paths after the tracked frontend moved one directory deeper. Kept both existing application layouts intact.
2. Changed the local browser-test bootstrap to launch the real `backend/src/server.js`, with an isolated real MongoDB replica set and a temporary test-only administrator. No API substitutes or fake persistence are used.
3. Configured ignored local `frontend/frontend/.env` for the existing Vite proxy. No credentials are stored there.
4. Abort obsolete session checks and ignore their late failures, preventing an obsolete check from clearing the current restored session.
5. Process authenticated HTTP 401 before decoding JSON, so a plain-text proxy/session error still logs the user out. Generic 503 responses no longer incorrectly describe photo storage; multipart upload 503s retain the actionable existing message. Non-JSON server failures produce a service-unavailable message.
6. Surface the backend's validation details, with readable field names, in the existing report error area while retaining the draft.
7. Normalize map-selected longitude without inventing or changing the represented geographic point.
8. Attach observed API methods, paths, statuses and browser diagnostics to each browser-test result. JWTs and request bodies are excluded from these evidence attachments.

## Environment and local execution

From the repository root, configure `backend/.env` as described in `backend/.env.example`. Required startup settings are `MONGODB_URI` (Atlas or replica set) and a 32+ character `JWT_SECRET`. Set `PORT=5000` and set `FRONTEND_URL` to the exact browser origin for direct cross-origin requests, normally `http://127.0.0.1:5173`. Provision an administrator with `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `npm run seed:admin`; no default production account is created by the integration tests.

Frontend public configuration in `frontend/frontend/.env`:

```dotenv
VITE_API_URL=/api/v1
API_PROXY_TARGET=http://127.0.0.1:5000
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

The relative API base uses Vite's same-origin proxy and avoids a localhost-versus-127.0.0.1 CORS mismatch. `API_PROXY_TARGET` is development-only. For a separately hosted backend, set `VITE_API_URL` to its complete HTTPS `/api/v1` URL and configure backend `FRONTEND_URL` to the actual frontend origin. Never put MongoDB, JWT or Cloudinary secrets in a `VITE_*` setting.

Run `npm start` inside `backend/` and `npm run dev` inside `frontend/frontend/`. Existing dependency installation is `npm ci` in each application. Media success needs backend-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. No real Cloudinary credential set or persistent operator database was supplied for this audit.

## Verification

The existing backend suite passed **36 tests across five files**. The complete integration/browser run passed **19 tests** using Microsoft Edge against the actual server entry point and a temporary real MongoDB replica set. A supplemental targeted **authority-map/unauthorized-write test also passed**, checking all four unauthenticated PATCH routes, actual private report data/markers and logout. These were separate executions: 19 full-suite scenarios plus one targeted scenario. `npm run lint` passed; no application build command was run.

The full-run HTML report contains 19 network/console evidence attachments with **105 observed API responses covering all 17 frontend method/path combinations**: 92 HTTP 200, 6 HTTP 201, 1 HTTP 400, 2 HTTP 401, 1 HTTP 502 and 3 HTTP 503. These include deliberately injected network/proxy failure cases as well as real server responses; they are not claimed to be 105 successful server requests. There were **zero uncaught browser script errors**. Readiness `/api/health`, the eighteenth backend endpoint, was checked separately with a real HTTP request returning database connectivity. A machine-readable summary extracted from the report is in ignored `frontend/frontend/.cache/integration-evidence.json`.

Commands executed: `npm test` in `backend/`; `npm run lint` and `npm test` in `frontend/frontend/`; then `npm test -- --grep "authority map retrieves" --reporter=list` for the supplemental scenario. No production mock data, fake routes, application rebuild or UI redesign was introduced.

Browser tests start the actual backend server on port 5011 and Vite on port 4173 with the proxy set to that backend. These ports isolate the test from the default 5000/5173 development pair. Server stderr is forwarded by the test bootstrap; the initial model-order problem was confined to the test bootstrap and fixed there. The remaining startup diagnostics were the known installed MongoDB patch-version difference (8.2.1 versus the test tool's default 8.2.6) and terminal color warnings. Per-test observed network statuses and console/script errors are attached to the Playwright HTML report under ignored `frontend/frontend/playwright-report/`. Expected HTTP 400/401/503 and failed-connection console messages occur in negative tests; all 19 completed without an uncaught browser script error.

The existing browser scenarios cover reporting, minimal evidence, GPS success/denial, JSON and multipart requests, retrieval, saved My Reports references, marker data/filtering, auth restoration, protected routes, verification/rejection, severity editing, response tracking, audit history, logout, SOS review, service failures, layout regressions and accessibility checks. Additional audit scenarios cover readiness, actual browser CORS/preflights, server-generated validation errors, nearby queries, world-wrap coordinates, obsolete-session failure and plain-text 401/general 503 handling.

Unconfigured media requests are expected to fail honestly with 503 after valid file parsing. Successful Cloudinary delivery, persistent production database configuration, real-device GPS/microphones and unsupported account/alert/dispatch capabilities cannot be declared verified by these local tests.

## Files changed

- `frontend/frontend/src/lib/api.js`: authentication/error-response integration fixes.
- `frontend/frontend/src/context/AuthContext.jsx`: cancellation of obsolete session restoration.
- `frontend/frontend/src/components/MapView.jsx`: canonical longitude for map-picked locations.
- `frontend/frontend/src/pages/ReportFlow.jsx`: readable real server-validation details.
- `frontend/frontend/tests/support/api-server.mjs`: corrected paths, safe model initialization and actual server startup against temporary MongoDB.
- `frontend/frontend/tests/support/observed-test.js`: network/console evidence fixture.
- `frontend/frontend/tests/e2e/workflows.spec.js`: use the evidence fixture; existing functional scenarios retained.
- `frontend/frontend/tests/e2e/zz-integration.spec.js`: additional API contract and failure-regression scenarios.
- `frontend/frontend/.env`: ignored local public API/proxy configuration; no secrets.
- `frontend/frontend/README.md`, root `README.md`, `INTEGRATION.md`: corrected startup locations and integration audit.

No backend application file, dependency manifest/lockfile, UI stylesheet or application shell was modified. The unrelated nested repository copy was preserved.
