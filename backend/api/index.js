import { loadEnv } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';

let application;

export default async function handler(req, res) {
  let app;
  try {
    const env = loadEnv();
    await connectDatabase(env.MONGODB_URI);
    if (!application) {
      // Load models after connecting and share one app across invocations.
      application = import('../src/createApp.js')
        .then(({ createApp }) => createApp(env))
        .catch(error => {
          application = undefined;
          throw error;
        });
    }
    app = await application;
  } catch {
    console.error('API initialization failed: check deployment environment variables and MongoDB access');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: { message: 'The API is temporarily unavailable.' } }));
    return;
  }
  return app(req, res);
}
