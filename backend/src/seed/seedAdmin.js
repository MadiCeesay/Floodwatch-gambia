import { z } from 'zod';
import { loadEnv } from '../config/env.js';
import { connectDatabase, closeDatabase } from '../config/database.js';

const adminSchema = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(12).refine(v => Buffer.byteLength(v) <= 72 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^a-zA-Z0-9]/.test(v), 'Use 12+ characters with upper/lower case, a number and a symbol; maximum 72 bytes'),
  });

export async function seedAdmin(input) {
  const data = adminSchema.parse(input);
  // Compile the model after the caller connects, so automatic collection/index
  // initialization cannot race a slow remote database connection.
  const { User } = await import('../models/User.js');
  await User.init();
  const existing = await User.findOne({ email: data.email });
  if (existing) return { created: false };
  try { await User.create(data); }
  catch (error) { if (error.code !== 11000) throw error; return { created: false }; }
  return { created: true };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/seedAdmin.js')) {
  let stage = 'configuration';
  try {
    const env = loadEnv();
    stage = 'credentials';
    const input = adminSchema.parse({ name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    stage = 'database connection';
    await connectDatabase(env.MONGODB_URI);
    stage = 'administrator creation';
    const result = await seedAdmin(input);
    console.info(result.created ? 'Administrator created' : 'Administrator already exists; credentials unchanged');
  } catch (error) {
    if (stage === 'credentials' && error instanceof z.ZodError) {
      const guidance = {
        name: 'ADMIN_NAME must contain 1–100 characters',
        email: 'ADMIN_EMAIL must be a valid email address',
        password: 'ADMIN_PASSWORD must contain 12+ characters with uppercase, lowercase, a number and a symbol; maximum 72 bytes',
      };
      const fields = [...new Set(error.issues.map(issue => issue.path[0]))];
      console.error(`Admin seed failed: ${fields.map(field => guidance[field]).join('; ')}. Check backend/.env.`);
    } else {
      const guidance = {
        configuration: 'verify MONGODB_URI, JWT_SECRET and required environment settings (see README)',
        'database connection': 'verify MongoDB is running/reachable and MONGODB_URI credentials and network access are correct',
        'administrator creation': 'verify database write permissions and user indexes',
      };
      console.error(`Admin seed failed during ${stage}: ${guidance[stage] || 'see README'}`);
    }
    process.exitCode = 1;
  }
  finally { await closeDatabase(); }
}
