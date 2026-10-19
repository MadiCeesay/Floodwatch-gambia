import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { authRoutes } from './routes/authRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { submitReport } from './controllers/reportController.js';
import { findReport, listReports } from './services/reportService.js';
import { publicReportDTO } from './utils/publicReportDTO.js';
import { uploadMiddleware as defaultUpload } from './middleware/upload.js';
import { createUploadService } from './services/uploadService.js';
import { emergencyRoutes, adminEmergencyRoutes } from './routes/emergencyRoutes.js';
import { safetyGuides } from './data/safetyGuides.js';

// Application factory for the standalone server and integration tests.
export function createApp(env, { uploadMiddleware = defaultUpload, mediaService = createUploadService(env) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet(), cors({ origin: env.FRONTEND_URL }), express.json({ limit: '32kb' }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { message: 'Too many requests. Please try again later.' } }) });
  app.get('/api/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected' });
  });
  app.use('/api/v1', limiter(60000, 300));
  app.use('/api/v1/auth', authRoutes(env, limiter(900000, 10)));
  app.use('/api/v1/admin', adminRoutes(env));
  app.use('/api/v1/admin/emergencies', adminEmergencyRoutes(env));
  app.use('/api/v1/emergencies', emergencyRoutes(env, limiter(900000, 5)));
  app.get('/api/v1/safety', (_req, res) => res.json({ data: safetyGuides }));
  app.post('/api/v1/reports', limiter(env.PUBLIC_REPORT_RATE_LIMIT_WINDOW_MS, env.PUBLIC_REPORT_RATE_LIMIT_MAX), uploadMiddleware, submitReport(mediaService));
  app.get('/api/v1/reports', async (req, res) => res.json(await listReports(req.query)));
  app.get('/api/v1/reports/nearby', async (req, res) => res.json(await listReports(req.query, false, true)));
  app.get('/api/v1/reports/:id', async (req, res) => res.json({ data: publicReportDTO(await findReport(req.params.id, true)) }));
  app.use((_req, res) => res.status(404).json({ error: { message: 'Endpoint not found' } }));
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) return res.status(400).json({ error: { message: 'Validation failed', details: error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } });
    let status = error.status || (error.name === 'ValidationError' ? 400 : error.name === 'VersionError' || error.code === 11000 ? 409 : error.name === 'MulterError' ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : 500);
    if (error.type === 'entity.parse.failed') status = 400;
    res.status(status).json({ error: { message: status === 500 ? 'An internal error occurred' : error.type === 'entity.parse.failed' ? 'Invalid JSON' : error.message } });
  });
  return app;
}
