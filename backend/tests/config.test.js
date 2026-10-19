import { it, expect } from 'vitest';
import { loadEnv } from '../src/config/env.js';
it('requires real configuration and production storage credentials', () => {
  expect(() => loadEnv({})).toThrow('Invalid configuration');
  expect(() => loadEnv({ MONGODB_URI: 'mongodb://localhost/test', JWT_SECRET: 'x'.repeat(32), NODE_ENV: 'production' })).toThrow('Production requires');
});
