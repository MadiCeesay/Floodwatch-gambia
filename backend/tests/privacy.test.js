import { it, expect } from 'vitest';
import { publicReportDTO } from '../src/utils/publicReportDTO.js';

it('keeps future fields private and strips nested storage metadata', () => {
  const dto = publicReportDTO({ _id: '123', location: { type: 'Point', coordinates: [-16, 13] },
    reporterName: 'Private name', reporterContact: 'Private phone', adminNotes: 'Private notes',
    responseNotes: 'Private response', rejectionReason: 'Private reason', futureSecret: 'Private future field',
    verifiedBy: 'Private admin', voiceRecording: { url: 'Private recording' },
    photo: { url: 'https://example.test/photo', publicId: 'Private cloud ID', uploadedAt: '2026-01-01' },
  });
  expect(JSON.stringify(dto)).not.toContain('Private');
  expect(dto.photo.url).toBe('https://example.test/photo');
});
