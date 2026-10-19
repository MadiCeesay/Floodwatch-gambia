import { spawnSync } from 'node:child_process';
import { it, expect } from 'vitest';

it('reports invalid seed credentials before connecting without disclosing secrets', () => {
  const password = 'private123';
  const result = spawnSync(process.execPath, ['src/seed/seedAdmin.js'], {
    cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 5000,
    env: {
      ...process.env, NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:1/unreachable',
      JWT_SECRET: 'seed-test-secret-with-at-least-32-characters',
      ADMIN_NAME: '', ADMIN_EMAIL: 'invalid-private-email', ADMIN_PASSWORD: password,
    },
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('ADMIN_NAME');
  expect(result.stderr).toContain('ADMIN_EMAIL');
  expect(result.stderr).toContain('ADMIN_PASSWORD must contain 12+ characters');
  expect(result.stderr).not.toContain(password);
  expect(result.stderr).not.toContain('invalid-private-email');
  expect(result.stderr).not.toContain('database connection');
});
