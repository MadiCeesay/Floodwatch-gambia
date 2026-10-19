import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const photos = ['image/jpeg', 'image/png', 'image/webp'];
const audio = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'];
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 20, fieldSize: 2048, parts: 22 },
  fileFilter(_req, file, cb) {
    const allowed = file.fieldname === 'photo' ? photos : file.fieldname === 'voiceRecording' ? audio : [];
    cb(allowed.includes(file.mimetype) ? null : new ApiError(415, 'Unsupported media type'), allowed.includes(file.mimetype));
  },
}).fields([{ name: 'photo', maxCount: 1 }, { name: 'voiceRecording', maxCount: 1 }]);
