# Deploy on Vercel

This repository contains two applications. Create two Vercel projects from the
same repository. The Express backend does not serve the React website.

## Backend project

- Root Directory: `backend`
- Framework Preset: **Other** (enforced by `"framework": null` in `backend/vercel.json`)
- Entry point: `api/index.js`, a default-exported async Node request handler.
- `vercel.json` rewrites incoming requests to this function while preserving
  public URLs such as `/api/health` and `/api/v1/reports`.
- `src/app.js` is an internal factory re-export. Local `npm start` / `npm run dev`
  continue using `src/server.js`; all routes stay in `src/createApp.js`.
- Node.js: 24.x, matching local verification
- Clear any previous Express build/output overrides. No custom build is needed.

Set these environment variables in Vercel for the deployment environment:

```text
NODE_ENV=production
NODEJS_HELPERS=0
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<a random secret of at least 32 characters>
FRONTEND_URL=https://<your frontend domain>
CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your API key>
CLOUDINARY_API_SECRET=<your API secret>
```

`NODEJS_HELPERS=0` must be set in the Vercel project's environment variables for
both build and runtime, then redeployed. It disables Vercel's automatic request
body parsing so Express's JSON size limit and Multer's photo/voice parsing can
read the original stream. This is the documented [Node helpers setting](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#disabling-helpers-for-nodejs).

The handler validates configuration and calls the existing connection helper on
every invocation. Healthy database connections and the Express app are reused;
failed connections can be retried. It never opens a listening socket or closes
the database after a request.

`JWT_EXPIRES_IN`, `PUBLIC_REPORT_RATE_LIMIT_WINDOW_MS`,
`PUBLIC_REPORT_RATE_LIMIT_MAX`, and `TRUST_PROXY_HOPS` remain optional with their
existing validated defaults. `PORT` is used only by the local/standalone listener.

Local `.env` files are ignored by Git and are not automatically available in
Vercel. Do not copy admin seed credentials to the deployment: provision the
account separately with `npm run seed:admin`. Ensure Atlas permits connections
from the deployment. Redeploy after changing environment variables.

Check `https://<backend domain>/api/health`; it should return HTTP 200 and
`{"status":"ok","database":"connected"}`. If startup fails, inspect Vercel's
runtime logs, rather than only the build log. Never disable TLS verification.

## Frontend project

- Root Directory: `frontend/frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable: `VITE_API_URL=https://<backend domain>/api/v1`

The included `vercel.json` provides the React route fallback. The local Vite API
proxy does not run in production. Set `VITE_API_URL` before building and redeploy
when changing it. Only public configuration belongs in `VITE_*` variables.

Use the frontend project's URL to open the website. Verify `/login` and `/report`
also work after refreshing the browser, then test login and media submission.
