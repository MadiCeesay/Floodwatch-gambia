import { loadEnv } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import { createApp } from './createApp.js';

let server;
async function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
  clearTimeout(timeout);
}
try {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);
  console.info('MongoDB connected');
  const app = createApp(env);
  server = app.listen(env.PORT, () => console.info(`FloodWatch API listening on port ${env.PORT}`));
  server.on('error', async () => { console.error('HTTP server failed to start'); await shutdown(); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { shutdown().catch(() => { process.exitCode = 1; }); });
} catch (error) {
  console.error(error.message.startsWith('Invalid configuration') || error.message.startsWith('Production requires') ? error.message : 'Startup failed: check MongoDB connectivity and configuration');
  await closeDatabase();
  process.exitCode = 1;
}
