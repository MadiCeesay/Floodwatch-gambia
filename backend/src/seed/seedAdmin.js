import { z } from 'zod';
import { loadEnv } from '../config/env.js';
import { connectDatabase, closeDatabase } from '../config/database.js';
import { User } from '../models/User.js';

export async function seedAdmin(input) {
  const data = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(12).refine(v => Buffer.byteLength(v) <= 72 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^a-zA-Z0-9]/.test(v), 'Use 12+ characters with upper/lower case, a number and a symbol; maximum 72 bytes'),
  }).parse(input);
  await User.init();
  const existing = await User.findOne({ email: data.email });
  if (existing) return { created: false };
  try { await User.create(data); }
  catch (error) { if (error.code !== 11000) throw error; return { created: false }; }
  return { created: true };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/seedAdmin.js')) {
  try {
    const env = loadEnv();
    await connectDatabase(env.MONGODB_URI);
    const result = await seedAdmin({ name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    console.info(result.created ? 'Administrator created' : 'Administrator already exists; credentials unchanged');
  } catch { console.error('Admin seed failed: verify configuration and password policy (see README)'); process.exitCode = 1; }
  finally { await closeDatabase(); }
}
