import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { FloodReport } from '../models/FloodReport.js';
import { AuditLog } from '../models/AuditLog.js';
import { findReport, listReports } from '../services/reportService.js';
import { calculateSeverity } from '../services/severityService.js';
import { updateSchema } from '../validators/reports.js';
import { ApiError } from '../utils/ApiError.js';

// Transactions keep review changes and their audit record atomic. Use a replica set.
async function mutate(id, actor, action, change) {
  let result;
  await mongoose.connection.transaction(async session => {
    const report = await FloodReport.findById(id).session(session);
    if (!report) throw new ApiError(404, 'Report not found');
    const changes = change(report);
    await report.save({ session });
    await AuditLog.create([{ actor: actor._id, report: report._id, action, changes }], { session });
    result = report;
  });
  return result;
}
export function adminRoutes(env) {
  const router = Router();
  router.use(authenticate(env));
  router.get('/reports', async (req, res) => res.json(await listReports(req.query, true)));
  router.get('/dashboard', async (_req, res) => {
    const [summary] = await FloodReport.aggregate([{ $facet: {
      total: [{ $count: 'count' }],
      verification: [{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }],
      response: [{ $match: { verificationStatus: { $ne: 'rejected' } } }, { $group: { _id: '$responseStatus', count: { $sum: 1 } } }],
      severity: [{ $match: { verificationStatus: { $ne: 'rejected' } } }, { $group: { _id: '$severityLevel', count: { $sum: 1 } } }],
    } }]);
    res.json({ data: { total: summary.total[0]?.count || 0,
      verification: Object.fromEntries(summary.verification.map(x => [x._id, x.count])),
      response: Object.fromEntries(summary.response.map(x => [x._id, x.count])),
      severity: Object.fromEntries(summary.severity.map(x => [x._id, x.count])),
    } });
  });
  router.get('/reports/:id', async (req, res) => res.json({ data: await findReport(req.params.id) }));
  router.get('/reports/:id/audit', async (req, res) => {
    const report = await findReport(req.params.id);
    res.json({ data: await AuditLog.find({ report: report._id }).sort({ createdAt: -1 }).limit(100).lean() });
  });
  router.patch('/reports/:id/verification', async (req, res) => {
    await findReport(req.params.id);
    const input = z.object({ verificationStatus: z.enum(['verified', 'rejected']), rejectionReason: z.string().trim().min(1).max(500).optional() }).strict()
      .refine(v => v.verificationStatus !== 'rejected' || v.rejectionReason, 'A rejection reason is required').parse(req.body);
    const report = await mutate(req.params.id, req.user, 'verification', r => {
      if (r.responseStatus !== 'unassigned' && input.verificationStatus === 'rejected') throw new ApiError(409, 'Reset response to unassigned before rejecting');
      r.verificationStatus = input.verificationStatus;
      r.verifiedAt = undefined; r.verifiedBy = undefined; r.rejectedAt = undefined; r.rejectedBy = undefined; r.rejectionReason = undefined;
      if (input.verificationStatus === 'verified') { r.verifiedAt = new Date(); r.verifiedBy = req.user._id; }
      else { r.rejectedAt = new Date(); r.rejectedBy = req.user._id; r.rejectionReason = input.rejectionReason; }
      return input;
    });
    res.json({ data: report });
  });
  router.patch('/reports/:id/response', async (req, res) => {
    await findReport(req.params.id);
    const input = z.object({ responseStatus: z.enum(['unassigned', 'assigned', 'responding', 'resolved']), responseNotes: z.string().trim().max(2000).optional() }).strict().parse(req.body);
    const report = await mutate(req.params.id, req.user, 'response', r => {
      if (r.verificationStatus !== 'verified') throw new ApiError(409, 'Verify the report before tracking response');
      r.responseStatus = input.responseStatus;
      if (input.responseNotes !== undefined) r.responseNotes = input.responseNotes;
      r.resolvedAt = input.responseStatus === 'resolved' ? new Date() : undefined;
      r.resolvedBy = input.responseStatus === 'resolved' ? req.user._id : undefined;
      return input;
    });
    res.json({ data: report });
  });
  router.patch('/reports/:id', async (req, res) => {
    await findReport(req.params.id);
    const input = updateSchema.parse(req.body);
    const report = await mutate(req.params.id, req.user, 'observations', r => {
      Object.assign(r, input);
      Object.assign(r, calculateSeverity(r));
      return input;
    });
    res.json({ data: report });
  });
  return router;
}
