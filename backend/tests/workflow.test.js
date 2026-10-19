import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/createApp.js';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { FloodReport } from '../src/models/FloodReport.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { User } from '../src/models/User.js';
import { seedAdmin } from '../src/seed/seedAdmin.js';
import { loadEnv } from '../src/config/env.js';
import { EmergencyRequest } from '../src/models/EmergencyRequest.js';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

let mongo, app, token;
const password = 'Test-only-Passphrase42!';
const base = { latitude: 13.45, longitude: -16.57, locationSource: 'gps', description: 'Floodwater across the road' };
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(mongo.getUri());
  await Promise.all([FloodReport.init(), AuditLog.init(), User.init()]);
  const env = loadEnv({ MONGODB_URI: mongo.getUri(), JWT_SECRET: 'test-secret-for-integration-tests-only-12345', NODE_ENV: 'test', PUBLIC_REPORT_RATE_LIMIT_MAX: 100 });
  app = createApp(env);
  await seedAdmin({ name: 'Test Admin', email: 'admin@example.test', password });
  token = (await request(app).post('/api/v1/auth/login').send({ email: 'admin@example.test', password })).body.data.token;
});
beforeEach(async () => { await FloodReport.deleteMany({}); await AuditLog.deleteMany({}); await EmergencyRequest.deleteMany({}); });
afterAll(async () => { await closeDatabase(); await mongo?.stop(); });
const admin = req => req.set('Authorization', `Bearer ${token}`);
describe('core MongoDB workflow', () => {
  it('starts the production entry point and serves live health and report requests', async () => {
    const probe = createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const child = spawn(process.execPath, ['src/server.js'], { cwd: process.cwd(), windowsHide: true,
      env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_SECRET: 'smoke-test-only-secret-longer-than-32-characters', PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    try {
      await vi.waitFor(async () => {
        if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
        const health = await fetch(`http://127.0.0.1:${port}/api/health`);
        expect(health.status).toBe(200);
      }, { timeout: 15000, interval: 100 });
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
      expect(response.status).toBe(201);
      expect(output).toContain('MongoDB connected');
    } finally {
      if (child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await ended; }
    }
  });
  it('reports database readiness', async () => { expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok', database: 'connected' }); });
  it('submits, persists, retrieves, verifies, responds, resolves and counts', async () => {
    const submitted = await request(app).post('/api/v1/reports').send({ ...base, reporterContact: 'private', reporterName: 'private name' });
    expect(submitted.status).toBe(201);
    const r = submitted.body.data;
    expect(r.severityLevel).toBe('unassessed'); expect(r.location.coordinates).toEqual([-16.57, 13.45]);
    expect(JSON.stringify(r)).not.toContain('private');
    expect((await FloodReport.findById(r.id)).reporterContact).toBe('private');
    expect((await request(app).get(`/api/v1/reports/${r.id}`)).status).toBe(200);
    expect((await admin(request(app).patch(`/api/v1/admin/reports/${r.id}/response`)).send({ responseStatus: 'assigned' })).status).toBe(409);
    expect((await admin(request(app).patch(`/api/v1/admin/reports/${r.id}/verification`)).send({ verificationStatus: 'verified' })).status).toBe(200);
    const assessed = await admin(request(app).patch(`/api/v1/admin/reports/${r.id}`)).send({ waterLevel: 'waist_or_higher', roadCondition: 'blocked', homesAffected: 'yes', adminNotes: 'private notes' });
    expect(assessed.body.data.severityScore).toBe(70);
    for (const responseStatus of ['assigned', 'responding', 'resolved']) {
      const response = await admin(request(app).patch(`/api/v1/admin/reports/${r.id}/response`)).send({ responseStatus, responseNotes: 'private response' });
      expect(response.status).toBe(200);
      if (responseStatus === 'resolved') expect(response.body.data.resolvedAt).toBeTruthy();
    }
    const stats = await admin(request(app).get('/api/v1/admin/dashboard'));
    expect(stats.body.data).toMatchObject({ total: 1, verification: { verified: 1 }, response: { resolved: 1 }, severity: { severe: 1 } });
    expect(await AuditLog.countDocuments({ report: r.id })).toBe(5);
    const publicList = await request(app).get('/api/v1/reports');
    expect(JSON.stringify(publicList.body)).not.toContain('private');
  });
  it.each([
    { latitude: 91 }, { longitude: -181 }, { description: '', waterLevel: 'unknown' },
    { severityLevel: 'severe' }, { photo: { url: 'https://fake' } }, { waterLevel: 'fake' }, { anonymous: 'no' }, { latitude: '' },
  ])('rejects invalid input %j', async patch => { expect((await request(app).post('/api/v1/reports').send({ ...base, ...patch })).status).toBe(400); });
  it('accepts structured observations without writing or district metadata', async () => {
    const { description, ...location } = base;
    const res = await request(app).post('/api/v1/reports').send({ ...location, waterLevel: 'shallow', roadCondition: 'passable', homesAffected: 'no' });
    expect(res.status).toBe(201); expect(res.body.data.severityScore).toBe(5);
  });
  it('keeps rejected reports private on every public route', async () => {
    const r = (await request(app).post('/api/v1/reports').send(base)).body.data;
    expect((await admin(request(app).patch(`/api/v1/admin/reports/${r.id}/verification`)).send({ verificationStatus: 'rejected', rejectionReason: 'private reason' })).status).toBe(200);
    expect((await request(app).get(`/api/v1/reports/${r.id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/reports')).body.pagination.total).toBe(0);
    expect((await request(app).get('/api/v1/reports?verificationStatus=rejected')).status).toBe(400);
  });
  it('uses real geospatial queries and validates filters', async () => {
    await request(app).post('/api/v1/reports').send(base);
    expect((await request(app).get('/api/v1/reports/nearby?latitude=13.45&longitude=-16.57&radiusKm=5')).body.pagination.total).toBe(1);
    expect((await request(app).get('/api/v1/reports/nearby?latitude=0&longitude=0&radiusKm=5')).body.pagination.total).toBe(0);
    for (const path of ['/api/v1/reports/nearby', '/api/v1/reports?limit=101', '/api/v1/reports?sort=password', '/api/v1/reports?latitude=0', '/api/v1/reports/invalid']) expect((await request(app).get(path)).status).toBe(400);
  });
  it('protects admins and does not reset seeded credentials', async () => {
    expect((await request(app).get('/api/v1/admin/reports')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/reports').set('Authorization', 'Bearer invalid')).status).toBe(401);
    await expect(seedAdmin({ name: 'Weak', email: 'weak@example.test', password: 'weak' })).rejects.toThrow();
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'admin@example.test', password: 'wrong' })).status).toBe(401);
    expect(await seedAdmin({ name: 'Changed', email: 'admin@example.test', password: 'Another-Password42!' })).toEqual({ created: false });
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'ADMIN@example.test', password });
    expect(login.status).toBe(200); expect(JSON.stringify(login.body)).not.toContain('password');
    const user = await User.findOne({ email: 'admin@example.test' });
    user.isActive = false; await user.save();
    expect((await admin(request(app).get('/api/v1/admin/reports'))).status).toBe(401);
    user.isActive = true; await user.save();
  });
  it('limits repeated submissions', async () => {
    const limited = createApp(loadEnv({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_SECRET: 'test-secret-for-integration-tests-only-12345', PUBLIC_REPORT_RATE_LIMIT_MAX: 1 }));
    expect((await request(limited).post('/api/v1/reports').send(base)).status).toBe(201);
    expect((await request(limited).post('/api/v1/reports').send(base)).status).toBe(429);
  });
  it('handles real multipart parsing with mocked external media storage and cleans up failed saves', async () => {
    const env = loadEnv({ NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), JWT_SECRET: 'test-secret-for-integration-tests-only-12345' });
    const storage = { upload: vi.fn(async (_file, field) => ({ url: `https://storage.example.test/${field}`, publicId: field, uploadedAt: new Date() })), remove: vi.fn(async () => {}) };
    const mediaApp = createApp(env, { mediaService: storage });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=', 'base64');
    for (const field of ['photo', 'voiceRecording']) {
      const response = await request(mediaApp).post('/api/v1/reports').field('latitude', '13.45').field('longitude', '-16.57').field('locationSource', 'gps')
        .attach(field, field === 'photo' ? png : Buffer.from('mock storage audio fixture'), { filename: field === 'photo' ? 'flood.png' : 'message.webm', contentType: field === 'photo' ? 'image/png' : 'audio/webm' });
      expect(response.status).toBe(201); expect(response.body.data.severityLevel).toBe('unassessed');
      expect(response.body.data.reportMethod).toBe(field === 'photo' ? 'photo' : 'voice');
      if (field === 'voiceRecording') expect(response.body.data.voiceRecording).toBeUndefined();
    }
    const fail = vi.spyOn(FloodReport, 'create').mockRejectedValueOnce(new Error('Simulated database failure'));
    try {
      const response = await request(mediaApp).post('/api/v1/reports').field('latitude', '13.45').field('longitude', '-16.57').field('locationSource', 'gps').attach('photo', png, { filename: 'flood.png', contentType: 'image/png' });
      expect(response.status).toBe(500);
      expect(storage.remove).toHaveBeenCalledWith(expect.objectContaining({ publicId: 'photo', resourceType: 'image' }));
    } finally { fail.mockRestore(); }
    const missing = await request(app).post('/api/v1/reports').field('latitude', '13.45').field('longitude', '-16.57').field('locationSource', 'gps').attach('photo', png, { filename: 'flood.png', contentType: 'image/png' });
    expect(missing.status).toBe(503);
    const spoof = await request(app).post('/api/v1/reports').field('latitude', '13.45').field('longitude', '-16.57').field('locationSource', 'gps').attach('photo', Buffer.from('fake'), { filename: 'flood.png', contentType: 'image/png' });
    expect(spoof.status).toBe(415);
  });
  it('records SOS without dispatch claims and keeps contacts private', async () => {
    const response = await request(app).post('/api/v1/emergencies').send({ latitude: 13.45, longitude: -16.57, locationSource: 'map', helpType: 'trapped', contact: 'private contact' });
    expect(response.status).toBe(201); expect(response.body.notice).toContain('does not contact or dispatch');
    expect(JSON.stringify(response.body)).not.toContain('private contact');
    expect((await request(app).get('/api/v1/emergencies')).status).toBe(404);
    expect((await request(app).get('/api/v1/admin/emergencies')).status).toBe(401);
    const list = await admin(request(app).get('/api/v1/admin/emergencies'));
    expect(list.body.data[0].contact).toBe('private contact');
    const update = await admin(request(app).patch(`/api/v1/admin/emergencies/${response.body.data.id}`)).send({ status: 'acknowledged', note: 'Reviewed' });
    expect(update.status).toBe(200); expect(update.body.data.history).toHaveLength(1);
    expect((await request(app).post('/api/v1/emergencies').send({ latitude: 999 })).status).toBe(400);
  });
  it('serves sourced plain-language safety guides', async () => {
    const response = await request(app).get('/api/v1/safety');
    expect(response.status).toBe(200); expect(response.body.data.source.url).toContain('ready.gov');
    expect(response.body.data.guidance.length).toBeGreaterThan(0);
  });
});
