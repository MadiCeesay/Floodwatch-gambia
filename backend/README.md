# FloodWatch Gambia backend

Express 5, JavaScript ES modules, Mongoose/MongoDB, Zod, JWT and bcrypt. Citizens need no account. This is a community reporting and response coordination prototype; the severity score is a deterministic hackathon heuristic, not an official standard or forecast.

## Run locally

Requires Node.js 22.12+ (tested with Node 24) and MongoDB with replica-set support. Atlas works. For local MongoDB, install Docker and run `docker compose up -d --wait` from this directory. The included Compose service binds MongoDB to localhost and initializes a single-node replica set. It has no database authentication and is for local development only.

```powershell
cd backend
npm ci
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the generated value into `JWT_SECRET` in `.env`. Configure `MONGODB_URI` for your database; for Compose use `mongodb://127.0.0.1:27017/floodwatch?replicaSet=rs0&directConnection=true`. Set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD`. Passwords require 12+ characters, uppercase, lowercase, a number and a symbol, with a 72-byte maximum.

The test dependency may download MongoDB during installation. If MongoDB is already installed, set `$env:MONGOMS_DISABLE_POSTINSTALL='1'` before `npm ci` to skip that download; the test configuration can use your installed binary as described below.

```powershell
npm run seed:admin
npm start
Invoke-RestMethod http://localhost:5000/api/health
```

Seeding is idempotent and never resets an existing account. There is no public registration. Remove seed credentials from the runtime environment after provisioning. `npm run dev` enables Node's watch mode.

If seeding fails, the command identifies invalid admin fields or the failing stage (application configuration, database connection, or administrator creation) without printing credentials. Correct the indicated settings in `backend/.env` and rerun `npm run seed:admin`. Quote `.env` passwords containing `#` so dotenv preserves the symbol rather than treating it as a comment. Existing PowerShell `$env:ADMIN_*` values override `.env`; update or remove those overrides if edits appear to have no effect.

All startup configuration is validated. MongoDB and a 32-character minimum JWT secret are required in every environment. Development supports reporting without Cloudinary; production requires all three Cloudinary settings. A failed database connection stops startup. SIGINT/SIGTERM drain HTTP requests and close MongoDB. Readiness returns 503 when disconnected.

## React integration

Set `FRONTEND_URL` to the exact frontend origin (default `http://localhost:5173`). Set the frontend API base URL to `http://localhost:5000/api/v1`. Login returns a Bearer token; send it as `Authorization: Bearer <token>` for admin routes. Prefer keeping tokens in memory. Use HTTPS in deployment. Tokens expire according to `JWT_EXPIRES_IN`; deactivated accounts immediately lose access. There is no refresh-token or logout revocation store.

### Accessible submission

```js
const response = await fetch(`${API}/reports`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latitude: 13.45,
    longitude: -16.57,
    locationSource: 'gps', // or 'map' when selecting the incident location
    description: 'Floodwater is covering the road'
  })
});
const { data, error } = await response.json();
```

Only location, its source, and meaningful incident information are required. The frontend obtains browser location with permission, or offers a map selection. Never invent coordinates. No continuous tracking occurs. Description, district, region, community, identity and structured questions are optional. Location-only and all-unknown reports are rejected. GeoJSON responses use `[longitude, latitude]`; Leaflet markers generally require `[latitude, longitude]`.

Observations: `waterLevel` = shallow/ankle/knee/waist_or_higher/unknown; `roadCondition` = passable/difficult/blocked/not_applicable/unknown; `homesAffected` and `peopleNeedHelp` = yes/no/unknown. `affectedHomesCount` is an optional non-negative integer. Description is at most 500 characters. `anonymous` defaults to true. Identity/contact fields stay private regardless of that flag.

Scoring requires known water, an applicable known road condition and known homes status. Otherwise score is null and level is unassessed. Water scores 5/10/20/30; road 0/10/20; homes no=0, yes=20. Totals below 20/40/60 are low/moderate/high; 60+ is severe. Missing evidence never means low risk. Text-only submissions use `reportMethod: structured`; multiple evidence methods use `mixed`.

### API reference

Successful single resources use `{data: ...}`. Lists use `{data: [...], pagination: {page, limit, total, pages}}`. Errors use `{error: {message, details?}}`. Validation errors are 400; missing/hidden reports 404; authentication failures 401; invalid workflow changes 409; request limits 429. Empty lists return 200.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database readiness (outside `/api/v1`) |
| POST | `/auth/login` | JSON email/password; returns token and safe user |
| GET | `/auth/me` | Current admin |
| POST | `/reports` | Anonymous JSON or multipart report; returns 201 |
| GET | `/reports` | Public pending/verified list |
| GET | `/reports/nearby` | Requires latitude, longitude, radiusKm |
| GET | `/reports/:id` | Public single report |
| GET | `/admin/reports` | Private report list, including rejected |
| GET | `/admin/reports/:id` | Full report, including evidence/contact/notes |
| PATCH | `/admin/reports/:id` | Observations and/or adminNotes; recomputes severity |
| PATCH | `/admin/reports/:id/verification` | verificationStatus verified/rejected; rejectionReason required for rejection |
| PATCH | `/admin/reports/:id/response` | responseStatus and optional responseNotes |
| GET | `/admin/reports/:id/audit` | Most recent 100 audit entries |
| GET | `/admin/dashboard` | Counts by verification, severity and response |
| GET | `/safety` | Short English guidance with source attribution |
| POST | `/emergencies` | Store a private SOS request; returns 201 and an explicit no-dispatch notice |
| GET | `/admin/emergencies` | Private paginated SOS list; optional status filter |
| PATCH | `/admin/emergencies/:id` | status (new/acknowledged/resolved) and optional note; saves bounded history |

All paths in the table except health are relative to `/api/v1`. Admin routes require authentication. Response tracking requires verification. Status options are unassigned/assigned/responding/resolved. Admins may reopen/reset response progress; doing so clears resolution metadata. Reset response to unassigned before rejecting a previously assigned report. Re-verification clears rejection metadata. Transactions ensure audit writes and modifications commit together; standalone MongoDB does not support these mutations.

List filters: `page` (default 1), `limit` (default 20, max 100), `severity`, `verificationStatus`, `responseStatus`, `community`, `region`, `roadCondition`, `from`, `to`, `latitude`, `longitude`, `radiusKm`, `sort`. Dates use ISO 8601 timestamps with timezone. Sort is newest (default), oldest or severity. Community/region match exactly. Provide all three geographic fields together; radius is at most 100 km. Geographic results are sorted using the requested sort, not by distance. Public queries cannot request rejected reports.

Pending reports must be labeled “Community report — not yet verified” in the frontend. Rejected reports are hidden on every public report route. Public serializers exclude identity, contact details, notes, administrator IDs, rejection reasons and storage IDs. Voice recordings remain private to admins because spoken messages may contain personal information. Public photos may contain identifying information; obtain informed consent in the frontend and establish moderation/redaction and retention rules before public rollout.

## Operations and verification

```powershell
npm test
```

Tests use a real temporary MongoDB replica set via mongodb-memory-server, separate from your configured database. The Windows test configuration detects MongoDB 8.2 under Program Files; otherwise it downloads a binary into `.cache/mongodb`. Set `MONGOMS_SYSTEM_BINARY` to use another locally installed executable. Initial binary downloads can be large: preinstall MongoDB or increase `hookTimeout` in the Vitest configuration if necessary. Tests cover submission, persistence, geospatial queries, privacy, validation, authentication, review, response tracking, dashboard counts, audit transactions, media handling and SOS. They also start `src/server.js` as a child process and send real HTTP health and report requests. They never seed your application database. Cloudinary SDK calls/storage are mocked; real credentialed uploads require a separate deployment smoke check.

Requests have bounded bodies, strict schemas, safe filter/sort allowlists and rate limits. Unknown submission fields (including forged severity/status/timestamps) are rejected. Login allows 10 attempts per 15 minutes per IP; reports default to 10 per 15 minutes per IP. There is also a 300/minute API limit. In-memory limits are per-process; use a shared limiter store for multi-instance deployment. Only set `TRUST_PROXY_HOPS` to the exact trusted reverse-proxy hop count. Incorrect proxy configuration can make IP limits ineffective.

Use authenticated MongoDB, HTTPS and secret management in production. Provision indexes before serving traffic, restrict admin access, configure backups and agree retention/deletion procedures for sensitive evidence. Do not log request bodies, credentials or tokens. No forecasting, AI analysis, weather/sensor data, emergency dispatch or third-party emergency integration is claimed.

## Photos and voice messages

Configure all Cloudinary settings in `.env`. The server streams media to Cloudinary and stores only its URL, public ID, upload timestamp and audio duration when returned by storage. Photos support JPEG/PNG/WebP up to 5 MiB; voice supports WebM/Ogg/MP3/MP4/WAV up to 10 MiB. MIME checks and binary signatures are validated. Container signatures alone do not prove the recording contains only audio; codec inspection/transcoding and malware scanning are deferred. Unknown or mismatched types return 415, oversized files return 413, unconfigured storage returns 503, and provider failures return 502.

```js
const form = new FormData();
form.append('latitude', String(position.coords.latitude));
form.append('longitude', String(position.coords.longitude));
form.append('locationSource', 'gps');
form.append('photo', photoFile); // optional; field name is photo
form.append('voiceRecording', audioBlob, 'message.webm'); // optional
// Do not set Content-Type: fetch adds the multipart boundary.
const response = await fetch(`${API}/reports`, { method: 'POST', body: form });
```

Each file field accepts one file. Photo-only and voice-only reports are valid and remain unassessed. All text/numeric/boolean fields can also be supplied in FormData; use strings `true` or `false` for anonymous. Media uploads are attempted sequentially. If a later upload or database insert fails, uploaded objects are deleted on a best-effort basis. Cleanup failures do not mask the original error; orphan reconciliation is a future operations task.

Voice URLs are returned by the private admin report endpoints and can be played using an HTML audio element. Cloudinary delivery URLs are bearer-like public URLs: anyone who obtains a URL can access that object. Before sensitive production use, configure authenticated/private media delivery with expiring access and a retention policy. Photo GPS/EXIF stripping and content moderation are also deferred.

## SOS and safety

`POST /emergencies` accepts latitude, longitude, locationSource, optional message (500 characters), optional contact (150 characters), and helpType (general/trapped/evacuation/medical; default general). No account or typed description is required. It returns only an ID, status, timestamp and a notice. There is no public SOS list or retrieval endpoint. Admins can list and acknowledge/resolve requests; this records review activity only. Requests are limited to five per 15 minutes per IP. Show the returned notice clearly **before and after** submission: this prototype stores requests for review and does not contact emergency services or guarantee a response.

Safety guidance is short English text paraphrased from the [Ready.gov flood information sheet](https://www.ready.gov/sites/default/files/2024-07/ready.gov_flood_info-sheet.pdf). It includes source metadata for the frontend. Locally reviewed translations and verified Gambian emergency contact information remain future work; no phone numbers are invented.

## Verification record

The core 28-test suite passed before secondary features were added. The final suite passed **36 tests across five files**, including the server entry-point smoke test, audio signatures and mocked Cloudinary SDK calls. Dependency installation completed with no reported vulnerabilities. No live Cloudinary upload was performed because credentials were not supplied. A persistent deployment and its secrets/database provisioning are left to the operator using the steps above.
