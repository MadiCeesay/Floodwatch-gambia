# Deploy on Vercel

This repository contains two applications. Create two Vercel projects from the
same repository. The Express backend does not serve the React website.

## Backend project

- Root Directory: `backend`
- Framework Preset: Express
- Entry point: `src/app.js` (exports an Express application); `index.js` re-exports
  the same handler. The reusable application factory lives in `src/createApp.js`.
- Node.js: 24.x, matching local verification
- Leave build/output overrides at the Express defaults.

Set these environment variables in Vercel for the deployment environment:

```text
NODE_ENV=production
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<a random secret of at least 32 characters>
FRONTEND_URL=https://<your frontend domain>
CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your API key>
CLOUDINARY_API_SECRET=<your API secret>
```

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
