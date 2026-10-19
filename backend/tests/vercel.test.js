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
  expect(mocks.connectDatabase).toHaveBeenCalledTimes(2);
  expect(mocks.createApp).toHaveBeenCalledTimes(1);
});

it('waits for the database before creating or invoking routes', async () => {
  let connected;
  mocks.connectDatabase.mockReturnValueOnce(new Promise(resolve => { connected = resolve; }));
  const { default: app } = await import('../src/app.js');
  const response = request(app).get('/api/health').then(value => value);
  try {
    await vi.waitFor(() => expect(mocks.connectDatabase).toHaveBeenCalledTimes(1));
    expect(mocks.createApp).not.toHaveBeenCalled();
  } finally {
    connected();
  }
  expect((await response).status).toBe(200);
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

it('checks MongoDB on warm requests and recovers without rebuilding routes', async () => {
  const route = vi.fn((req, res) => res.json({ path: req.url }));
  mocks.createApp.mockReturnValue(route);
  const { default: app } = await import('../src/app.js');
  expect((await request(app).get('/api/health')).status).toBe(200);

  mocks.connectDatabase.mockRejectedValueOnce(new Error('private connection details'));
  const unavailable = await request(app).get('/api/v1/reports');
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers['cache-control']).toBe('no-store');
  expect(unavailable.headers['x-powered-by']).toBeUndefined();
  expect(JSON.stringify(unavailable.body)).not.toContain('private connection details');
  expect(route).toHaveBeenCalledTimes(1);

  expect((await request(app).get('/api/v1/reports')).status).toBe(200);
  expect(mocks.connectDatabase).toHaveBeenCalledTimes(3);
  expect(mocks.createApp).toHaveBeenCalledTimes(1);
  expect(route).toHaveBeenCalledTimes(2);
});
