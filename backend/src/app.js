import express from 'express';
import { loadEnv } from './config/env.js';
import { connectDatabase } from './config/database.js';

// Vercel entry point. Keep server.js for the standalone/local HTTP server.
const app = express();
app.disable('x-powered-by');
let env;
let application;

app.use(async (req, res, next) => {
  let api;
  try {
    env ??= loadEnv();
    // Reuse a healthy connection, share an in-flight connection, or reconnect
    // after an idle serverless instance has lost its database connection.
    await connectDatabase(env.MONGODB_URI);
    if (!application) {
      // Load models only after connecting, including on a cold start.
      application = import('./createApp.js')
        .then(({ createApp }) => createApp(env))
        .catch(error => {
          application = undefined;
          throw error;
        });
    }
    api = await application;
  } catch {
    console.error('API initialization failed: check deployment environment variables and MongoDB access');
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ error: { message: 'The API is temporarily unavailable.' } });
  }
  return api(req, res, next);
});

export default app;
