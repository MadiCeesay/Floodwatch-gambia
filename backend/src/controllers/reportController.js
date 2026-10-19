import { FloodReport } from '../models/FloodReport.js';
import { calculateSeverity } from '../services/severityService.js';
import { reportSchema, meaningful } from '../validators/reports.js';
import { publicReportDTO } from '../utils/publicReportDTO.js';
import { ApiError } from '../utils/ApiError.js';

export function submitReport(mediaService) {
  return async (req, res) => {
    const input = reportSchema.parse(req.body);
    const files = req.files || {};
    if (!meaningful(input) && !files.photo && !files.voiceRecording) throw new ApiError(400, 'Add a photo, voice message, description or flood observation');
    const uploads = [];
    try {
      const evidence = {};
      for (const field of ['photo', 'voiceRecording']) if (files[field]) {
        const uploaded = await mediaService.upload(files[field][0], field);
        uploads.push({ ...uploaded, resourceType: field === 'photo' ? 'image' : 'video' });
        evidence[field] = uploaded;
      }
      const methods = [evidence.photo && 'photo', evidence.voiceRecording && 'voice', meaningful(input) && 'structured'].filter(Boolean);
      const { latitude, longitude, ...rest } = input;
      const report = await FloodReport.create({ ...rest, ...evidence, location: { type: 'Point', coordinates: [longitude, latitude] },
        reportMethod: methods.length > 1 ? 'mixed' : methods[0], ...calculateSeverity(input) });
      res.status(201).json({ data: publicReportDTO(report) });
    } catch (error) {
      await Promise.allSettled(uploads.map(upload => mediaService.remove(upload)));
      throw error;
    }
  };
}
