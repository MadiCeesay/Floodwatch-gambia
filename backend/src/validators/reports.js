import { z } from 'zod';
import { waterLevels, roadConditions, yesNoUnknown } from '../models/FloodReport.js';
const number = z.preprocess(v => typeof v === 'string' && v.trim() !== '' ? Number(v) : v, z.number());
const text = max => z.string().trim().max(max).optional();
export const conditions = {
  waterLevel: z.enum(waterLevels).optional(), roadCondition: z.enum(roadConditions).optional(),
  homesAffected: z.enum(yesNoUnknown).optional(), peopleNeedHelp: z.enum(yesNoUnknown).optional(),
  affectedHomesCount: number.pipe(z.number().int().min(0).max(1000000)).optional(),
};
export const reportSchema = z.object({
  latitude: number.pipe(z.number().min(-90).max(90)),
  longitude: number.pipe(z.number().min(-180).max(180)),
  locationSource: z.enum(['gps', 'map']),
  description: text(500), community: text(100), district: text(100), region: text(100),
  reporterName: text(100), reporterContact: text(150),
  anonymous: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).default(true),
  ...conditions,
}).strict();
export function meaningful(r) {
  return Boolean(r.description || (r.waterLevel && r.waterLevel !== 'unknown') ||
    (r.roadCondition && !['unknown', 'not_applicable'].includes(r.roadCondition)) ||
    (r.homesAffected && r.homesAffected !== 'unknown') || (r.peopleNeedHelp && r.peopleNeedHelp !== 'unknown'));
}
export const updateSchema = z.object({ ...conditions, adminNotes: text(2000) }).strict()
  .refine(v => Object.keys(v).length > 0, 'Provide at least one change');
const date = z.iso.datetime({ offset: true }).transform(v => new Date(v));
export const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: z.enum(['unassessed', 'low', 'moderate', 'high', 'severe']).optional(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  responseStatus: z.enum(['unassigned', 'assigned', 'responding', 'resolved']).optional(),
  community: text(100), region: text(100), roadCondition: z.enum(roadConditions).optional(),
  from: date.optional(), to: date.optional(),
  latitude: number.pipe(z.number().min(-90).max(90)).optional(),
  longitude: number.pipe(z.number().min(-180).max(180)).optional(),
  radiusKm: number.pipe(z.number().positive().max(100)).optional(),
  sort: z.enum(['newest', 'oldest', 'severity']).default('newest'),
}).strict().superRefine((v, ctx) => {
  const geo = [v.latitude, v.longitude, v.radiusKm];
  if (geo.some(x => x !== undefined) && !geo.every(x => x !== undefined)) ctx.addIssue({ code: 'custom', message: 'Provide latitude, longitude and radiusKm together' });
  if (v.from && v.to && v.from > v.to) ctx.addIssue({ code: 'custom', message: 'from must precede to' });
});
