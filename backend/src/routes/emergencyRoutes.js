import { Router } from 'express';
import { z } from 'zod';
import { reportSchema } from '../validators/reports.js';
import { EmergencyRequest } from '../models/EmergencyRequest.js';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
const input = reportSchema.pick({ latitude: true, longitude: true, locationSource: true }).extend({
  message: z.string().trim().max(500).optional(), contact: z.string().trim().max(150).optional(),
  helpType: z.enum(['general', 'trapped', 'evacuation', 'medical']).default('general'),
}).strict();
export const emergencyNotice = 'This request is stored for FloodWatch administrator review. It does not contact or dispatch emergency services. Do not rely on FloodWatch for urgent assistance.';
export function emergencyRoutes(env, limiter) {
  const router = Router();
  router.post('/', limiter, async (req, res) => {
    const { latitude, longitude, ...rest } = input.parse(req.body);
    const record = await EmergencyRequest.create({ ...rest, location: { type: 'Point', coordinates: [longitude, latitude] } });
    res.status(201).json({ data: { id: record.id, status: record.status, createdAt: record.createdAt }, notice: emergencyNotice });
  });
  return router;
}
export function adminEmergencyRoutes(env) {
  const router = Router();
  router.use(authenticate(env));
  router.get('/', async (req, res) => {
    const q = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(['new', 'acknowledged', 'resolved']).optional() }).strict().parse(req.query);
    const filter = q.status ? { status: q.status } : {};
    const [data, total] = await Promise.all([EmergencyRequest.find(filter).sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), EmergencyRequest.countDocuments(filter)]);
    res.json({ data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
  });
  router.patch('/:id', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new ApiError(400, 'Invalid emergency request ID');
    const change = z.object({ status: z.enum(['new', 'acknowledged', 'resolved']), note: z.string().trim().max(1000).optional() }).strict().parse(req.body);
    const record = await EmergencyRequest.findById(req.params.id);
    if (!record) throw new ApiError(404, 'Emergency request not found');
    // Bound the embedded history; edits remain atomic with their history entry.
    if (record.history.length >= 200) throw new ApiError(409, 'History limit reached');
    record.status = change.status;
    record.history.push({ ...change, actor: req.user._id });
    await record.save();
    res.json({ data: record });
  });
  return router;
}
