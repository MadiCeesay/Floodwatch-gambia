import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('1d'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  PUBLIC_REPORT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  PUBLIC_REPORT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
});

export function loadEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(`Invalid configuration: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const env = result.data;
  if (env.NODE_ENV === 'production' && (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)) {
    throw new Error('Production requires all Cloudinary credentials');
  }
  return env;
}
