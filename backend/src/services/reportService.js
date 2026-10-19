import { FloodReport } from '../models/FloodReport.js';
import { ApiError } from '../utils/ApiError.js';
import { querySchema } from '../validators/reports.js';
import { publicReportDTO } from '../utils/publicReportDTO.js';

export async function findReport(id, publicOnly = false) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new ApiError(400, 'Invalid report ID');
  const r = await FloodReport.findOne({ _id: id, ...(publicOnly ? { verificationStatus: { $ne: 'rejected' } } : {}) });
  if (!r) throw new ApiError(404, 'Report not found');
  return r;
}
export async function listReports(query, admin = false, nearby = false) {
  const q = querySchema.parse(query);
  if (nearby && q.latitude === undefined) throw new ApiError(400, 'latitude, longitude and radiusKm are required');
  const filter = {};
  if (!admin) {
    if (q.verificationStatus === 'rejected') throw new ApiError(400, 'Rejected reports are private');
    filter.verificationStatus = { $in: ['pending', 'verified'] };
  }
  for (const key of ['verificationStatus', 'responseStatus', 'community', 'region', 'roadCondition']) if (q[key] !== undefined) filter[key] = q[key];
  if (q.severity) filter.severityLevel = q.severity;
  if (q.from || q.to) filter.submittedAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.latitude !== undefined) filter.location = { $geoWithin: { $centerSphere: [[q.longitude, q.latitude], q.radiusKm / 6371.0088] } };
  const sort = q.sort === 'severity' ? { severityScore: -1, _id: -1 } : { submittedAt: q.sort === 'oldest' ? 1 : -1, _id: -1 };
  const [reports, total] = await Promise.all([
    FloodReport.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(), FloodReport.countDocuments(filter),
  ]);
  return { data: admin ? reports : reports.map(publicReportDTO), pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
}
