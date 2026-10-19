import express from 'express';
import { loadEnv } from './src/config/env.js';
import { connectDatabase } from './src/config/database.js';

// Vercel entry point. Keep server.js for the standalone/local HTTP server.
const app = express();
let initializing;

app.use(async (req, res, next) => {
  if (!initializing) {
    initializing = (async () => {
      const env = loadEnv();
      await connectDatabase(env.MONGODB_URI);
      // Load models only after connecting, including on a cold start.
      const { createApp } = await import('./src/app.js');
      return createApp(env);
    })().catch(error => {
      initializing = undefined;
      throw error;
    });
  }
  let api;
  try {
    api = await initializing;
  } catch {
    console.error('API initialization failed: check deployment environment variables and MongoDB access');
    return res.status(503).json({ error: { message: 'The API is temporarily unavailable.' } });
  }
  return api(req, res, next);
});

export default app;
