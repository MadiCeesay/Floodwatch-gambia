import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({ loadEnv: vi.fn(), connectDatabase: vi.fn(), createApp: vi.fn() }));
vi.mock('../src/config/env.js', () => ({ loadEnv: mocks.loadEnv }));
vi.mock('../src/config/database.js', () => ({ connectDatabase: mocks.connectDatabase }));
vi.mock('../src/createApp.js', () => ({ createApp: mocks.createApp }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.loadEnv.mockReturnValue({ MONGODB_URI: 'mongodb://test-only' });
  mocks.connectDatabase.mockResolvedValue(undefined);
  mocks.createApp.mockReturnValue((req, res) => res.json({ path: req.url }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('shares cold-start initialization across concurrent requests and preserves API paths', async () => {
  // Exercise the exact module selected by Vercel in production.
  const { default: app } = await import('../src/app.js');
  expect(typeof app).toBe('function');
  expect((await import('../index.js')).default).toBe(app);
  const responses = await Promise.all([
    request(app).get('/api/health'), request(app).get('/api/v1/safety'),
  ]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect(responses[1].body.path).toBe('/api/v1/safety');
  expect(mocks.connectDatabase).toHaveBeenCalledTimes(1);
  expect(mocks.createApp).toHaveBeenCalledTimes(1);
});

it('returns a safe response for missing configuration and retries after correction', async () => {
  mocks.loadEnv.mockImplementationOnce(() => { throw new Error('private configuration value'); });
  const { default: app } = await import('../index.js');
  const first = await request(app).get('/api/health');
  expect(first.status).toBe(503);
  expect(JSON.stringify(first.body)).not.toContain('private configuration value');
  expect(mocks.connectDatabase).not.toHaveBeenCalled();
  expect((await request(app).get('/api/health')).status).toBe(200);
});

it('retries a failed database connection on the next request', async () => {
  mocks.connectDatabase.mockRejectedValueOnce(new Error('connection failed'));
  const { default: app } = await import('../index.js');
  expect((await request(app).get('/api/health')).status).toBe(503);
  expect((await request(app).get('/api/health')).status).toBe(200);
  expect(mocks.connectDatabase).toHaveBeenCalledTimes(2);
});
