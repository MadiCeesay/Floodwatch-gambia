# FloodWatch Gambia frontend

React 19 + Vite, React Router, Leaflet/React Leaflet and Lucide icons. The interface connects to the existing Express backend; there are no production mock responses, reports, counts, alerts or locations.

## Earlier frontend implementation verification

The following records the original frontend implementation. See [the integration audit](../INTEGRATION.md) for the current endpoint inventory, fixes, 36 backend tests, 19 browser scenarios and the supplemental authority-map check.

The final run passed **13 Playwright browser tests** against the real Express API and an isolated MongoDB replica set. `npm run lint` and `npm run build` passed. Normal-flow browser inspection of Home, Map and Safety recorded no console errors and successful API responses. Responsive checks covered 320, 375, 390, 430, 768, 1024 and 1440 px without horizontal page overflow; evidence-step and authority layouts received additional checks. Desktop/mobile screenshots were visually inspected. Axe found no serious or critical violations on the checked citizen screens, excluding Leaflet's generated map. Microphone recording was verified using a synthetic browser microphone; physical-device and screen-reader checks remain necessary. Live Cloudinary success was not tested without credentials.

## Run both applications

Use Node.js 22.12+ (verified with Node 24). The frontend is in `frontend/`. Configure and start the backend first, following [its setup instructions](../backend/README.md). It needs MongoDB Atlas or a replica set, a strong JWT secret and a seeded administrator. Do not put backend secrets in this frontend. See the current [integration audit](../INTEGRATION.md) for endpoint mappings and verification evidence.

```powershell
# Terminal 1, after configuring backend/.env
cd backend
npm ci
npm run seed:admin
npm start

# Terminal 2
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). The development proxy forwards `/api` to the backend on port 5000. `API_PROXY_TARGET` changes that development target. Use `npm run dev -- --host 0.0.0.0` only when intentionally exposing local development to your network.

## Environment

| Variable            | Default                                              | Purpose                                                       |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `VITE_API_URL`      | `/api/v1`                                            | API base path, or an absolute HTTPS backend URL in production |
| `API_PROXY_TARGET`  | `http://127.0.0.1:5000`                              | Vite development proxy target; not included in browser code   |
| `VITE_MAP_TILE_URL` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Public map tile template                                      |

All `VITE_*` values are public and embedded at build time. Restart Vite after changing environment values. Keep `.env` ignored; `.env.example` contains no secrets.

## User flows

The citizen navigation contains Home, Flood map, Report, Stay safe and My reports. Mobile uses a five-item bottom navigation; desktop uses a header. The authority workspace has its own responsive sidebar/navigation and shares the same typography, controls, status labels and palette.

Reporting uses three steps: location, evidence/observations, and review. GPS requires a deliberate user action. Denial or unavailable location opens a map selection fallback. A user can tap a point or move the keyboard-accessible map and explicitly select its centre. The map's initial view is a regional overview, never a claimed user location. Valid reports need real incident location and either a photo, voice recording, meaningful description or known observation. Fields map directly to the backend enums; blank optional values are omitted. Unknown observations never imply low severity.

Photos can be captured/selected, previewed, removed or replaced. JPEG/PNG/WebP files larger than 5 MiB (up to 25 MiB input) are downscaled locally to fit the backend's 5 MiB limit. Small photos retain their original file. Voice can be recorded for up to 60 seconds on supported browsers or uploaded as a supported audio file (maximum 10 MiB). Microphone access is requested only when recording starts; streams, timers and temporary preview URLs are cleaned up. Multipart requests use native FormData with the browser-generated boundary. If storage fails, the user can go back, remove media and send observations without losing the rest of the draft. The submit handler locks immediately to prevent duplicate clicks.

Draft content is held in memory during the three steps, never persisted to device storage. It is discarded when leaving the reporting page or refreshing. On success, only the public report reference is saved in localStorage (up to 50 entries). My reports retrieves each saved reference from the real public endpoint. This is device/browser history, not a citizen account or proof of ownership. Missing/rejected reports show as unavailable; network failures offer retry. Storage denial does not stop submission.

Map markers come only from the fetched page of reports. Lists and maps share filters, pagination and selected-location queries; nearby radius is 25 km. The accessible list supplies the same report information independently of the map. Public views clearly label pending observations and explain that absent reports or an unassessed incident do not establish safety. Home shows the latest five reports, not a nationwide incident total. Map results show the current page (20 reports). Refresh is manual; there is no claim of a real-time feed or safe-route planning.

Stay safe fetches the backend's sourced guidance. There is no alert creation/feed capability in this backend, so the UI does not invent one. Help requests save to the private SOS queue with a clear notice and acknowledgment before submission: this does not contact or dispatch emergency services or guarantee a response.

## Authority workspace

Sign in at `/login` using an account created by `npm run seed:admin`. Public administrator registration and password reset are not supported by the backend and are not shown.

The JWT is held in memory and sessionStorage for tab-scoped session restoration. Every restored session is checked through `/auth/me`; the UI does not trust decoded client claims. A 401 clears the session and redirects protected routes to sign-in. Signing out clears this browser's token; it does not revoke an already issued JWT server-side. In production, enforce HTTPS and a restrictive CSP and consider a backend cookie-based session design if requirements change; sessionStorage remains readable to same-origin JavaScript. Backend authentication/authorization remains the security boundary.

Authority screens include aggregate counts, recent reports, a paginated/filterable report table, incident map, full report evidence, private contact details, observation editing, verification/rejection, response status/notes, audit history and private help-request reviews. Rejecting requires a reason and confirmation. Response tracking requires verification. Rejected reports with an assigned response must first be reset to awaiting response. The server calculates severity after observation changes. Review updates use the existing transactional backend endpoints.

## API mappings

All paths below are relative to `VITE_API_URL`. Public report fields are displayed from the backend's public DTO; admin responses are used only in authenticated routes.

| Flow                               | Request                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Home / map / list                  | `GET /reports`, `GET /reports/nearby` with validated filters                                             |
| Submit / detail / saved references | `POST /reports`, `GET /reports/:id`                                                                      |
| Safety                             | `GET /safety`                                                                                            |
| Request help                       | `POST /emergencies`                                                                                      |
| Login / restore                    | `POST /auth/login`, `GET /auth/me`                                                                       |
| Authority overview                 | `GET /admin/dashboard`, `GET /admin/reports`                                                             |
| Authority detail                   | `GET /admin/reports/:id`, `GET /admin/reports/:id/audit`                                                 |
| Edit / review / response           | `PATCH /admin/reports/:id`, `PATCH /admin/reports/:id/verification`, `PATCH /admin/reports/:id/response` |
| Help queue                         | `GET /admin/emergencies`, `PATCH /admin/emergencies/:id`                                                 |

The service layer handles JSON/FormData, Bearer authorization, aborts, server validation, expired sessions, 429s and connection failures. User content is rendered as React text, never injected as HTML. Backend private fields are never requested for citizen screens.

## Architecture and design

- `src/pages/`: citizen routes and the authority workspace; secondary routes are lazy loaded.
- `src/components/`: shells/navigation, feedback, maps, location selection, observations, evidence and admin review.
- `src/context/`, `src/hooks/`: verified session state and cancellable data loading.
- `src/lib/`: API transport, enum labels, payload mapping and reference-only local storage.
- `src/styles.css`: coherent navy/teal/off-white tokens, restrained borders, responsive layouts, readable status labels, minimum touch targets, focus states and reduced-motion handling.
- `tests/e2e/`: real-browser workflows, responsive checks and axe accessibility checks.
- `tests/support/api-server.mjs`: isolated test API backed by a temporary MongoDB replica set; it does not use the configured application database.

No backend application code was changed for frontend integration. The only supplied design material was the textual brief, not the three screenshot files; the implementation follows its described hierarchy and interaction principles.

## Test, build and deploy

```powershell
npm run lint
npm run build
npm test
```

The browser suite starts Vite on 4173 and an isolated API on 5011, uses installed Microsoft Edge on Windows when available, and otherwise uses Playwright Chromium. Install Chromium with `npx playwright install chromium` if needed, or set `E2E_BROWSER_CHANNEL=chrome`/`msedge` to use an installed browser. The test API uses the backend's installed development dependencies, so install both directories before testing. It automatically detects MongoDB 8.2 under Program Files on Windows; elsewhere set `MONGOMS_SYSTEM_BINARY` or allow mongodb-memory-server to download a binary. The disposable browser-test administrator exists only in that temporary database. No operator database is seeded or modified.

Tests cover location permission success/denial, map fallback, minimum validation, JSON and multipart submission, duplicate click prevention, draft recovery, saved reports, real retrieval/markers/filtering, login and session restoration, protected routes, verification/rejection/resolution, public privacy, safety, SOS, failures/retry and responsive widths. Browser diagnostics and screenshots are saved under ignored `test-results/`; the HTML report is under `playwright-report/`. Axe scans exclude the Leaflet-rendered map; report/location alternatives and keyboard map controls supplement it. Automated scans do not replace assistive-technology testing.

Build output is `dist/`. Configure production hosting to serve `index.html` for application routes such as `/reports/:id` and `/admin`. Either reverse-proxy `/api` to Express or set `VITE_API_URL` to the backend's HTTPS URL before building. Set backend `FRONTEND_URL` to the exact deployed origin for direct cross-origin access. Vite's dev proxy is not a production server. Do not publicly expose the development MongoDB or test API.

OpenStreetMap's public tile service requires visible attribution and adherence to its [usage policy](https://operations.osmfoundation.org/policies/tiles/); use a suitable provider for production traffic and update attribution if changing providers. Tiles require network access, disclose tile requests to the provider and are not available offline. GPS and microphone access require HTTPS (localhost is a development exception). Some browsers do not support recording; file upload and observation choices remain available. Test on the intended physical devices.

Cloudinary success still needs credentials and a live storage smoke test. The browser suite verifies a valid file reaching the real backend and the honest 503 response without configured storage; it does not claim successful live uploads. The backend currently uses public media delivery URLs. Voice is only listed to admins, but obtained URLs are accessible to their holders. Establish private delivery, retention, photo metadata stripping and moderation before sensitive public use. Local translations, live alerts, citizen accounts, real emergency dispatch and offline queueing are not available.
