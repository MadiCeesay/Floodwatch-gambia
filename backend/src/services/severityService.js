import { z } from 'zod';
import { waterLevels, roadConditions, yesNoUnknown } from '../models/FloodReport.js';
const observations = z.object({
  waterLevel: z.enum(waterLevels).optional(), roadCondition: z.enum(roadConditions).optional(),
  homesAffected: z.enum(yesNoUnknown).optional(),
});
export function classifySeverity(score) {
  if (!Number.isFinite(score) || score < 0) throw new RangeError('Score must be non-negative');
  return score < 20 ? 'low' : score < 40 ? 'moderate' : score < 60 ? 'high' : 'severe';
}
export function calculateSeverity(input) {
  const { waterLevel, roadCondition, homesAffected } = observations.parse(input);
  const water = { shallow: 5, ankle: 10, knee: 20, waist_or_higher: 30 };
  const road = { passable: 0, difficult: 10, blocked: 20 };
  const homes = { no: 0, yes: 20 };
  if (water[waterLevel] === undefined || road[roadCondition] === undefined || homes[homesAffected] === undefined) {
    return { severityScore: null, severityLevel: 'unassessed' };
  }
  const severityScore = water[waterLevel] + road[roadCondition] + homes[homesAffected];
  return { severityScore, severityLevel: classifySeverity(severityScore) };
}
