import { loadEnv } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './createApp.js';

export { createApp };

const env = loadEnv();

await connectDatabase(env.MONGODB_URI);

const app = createApp(env);

export default app;
