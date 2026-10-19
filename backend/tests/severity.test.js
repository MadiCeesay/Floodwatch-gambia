import { describe, it, expect } from 'vitest';
import { calculateSeverity, classifySeverity } from '../src/services/severityService.js';
describe('severity heuristic', () => {
  it.each([[0, 'low'], [19, 'low'], [20, 'moderate'], [39, 'moderate'], [40, 'high'], [59, 'high'], [60, 'severe'], [70, 'severe']])('classifies %s', (n, level) => expect(classifySeverity(n)).toBe(level));
  it('requires all three known applicable observations', () => {
    for (const input of [{}, { waterLevel: 'knee' }, { waterLevel: 'shallow', roadCondition: 'not_applicable', homesAffected: 'no' }, { waterLevel: 'unknown', roadCondition: 'passable', homesAffected: 'no' }]) {
      expect(calculateSeverity(input)).toEqual({ severityScore: null, severityLevel: 'unassessed' });
    }
  });
  it('scores the severe example', () => expect(calculateSeverity({ waterLevel: 'waist_or_higher', roadCondition: 'blocked', homesAffected: 'yes' })).toEqual({ severityScore: 70, severityLevel: 'severe' }));
  it('rejects invalid observations', () => expect(() => calculateSeverity({ waterLevel: 'fake' })).toThrow());
});
