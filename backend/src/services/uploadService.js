import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../utils/ApiError.js';

export async function validateMedia(file, field) {
  if (field === 'photo' && file.size > 5 * 1024 * 1024) throw new ApiError(413, 'Photo exceeds 5 MB');
  if (file.size > 10 * 1024 * 1024) throw new ApiError(413, 'Voice recording exceeds 10 MB');
  let detected;
  try { detected = await fileTypeFromBuffer(file.buffer); } catch { /* Invalid signature below */ }
  const allowed = field === 'photo' ? ['image/jpeg', 'image/png', 'image/webp'] : ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'video/mp4', 'video/webm', 'audio/webm'];
  if (!detected || !allowed.includes(detected.mime)) throw new ApiError(415, 'Media contents do not match a supported format');
  const normalize = mime => ({ 'audio/x-wav': 'audio/wav', 'video/webm': 'audio/webm', 'video/mp4': 'audio/mp4' })[mime] || mime;
  if (normalize(file.mimetype) !== normalize(detected.mime)) throw new ApiError(415, 'Media MIME type does not match contents');
}
export function createUploadService(env) {
  const configured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  const options = { cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET };
  return {
    async upload(file, field) {
      await validateMedia(file, field);
      if (!configured) throw new ApiError(503, 'Media storage is not configured. Submit text or observations, or try again later.');
      const resourceType = field === 'photo' ? 'image' : 'video';
      let result;
      try {
        result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ ...options, resource_type: resourceType, folder: 'floodwatch', timeout: 30000 },
            (error, value) => error ? reject(error) : resolve(value));
          stream.end(file.buffer);
        });
      } catch { throw new ApiError(502, 'Media storage is unavailable. Please try again.'); }
      return { url: result.secure_url, publicId: result.public_id, uploadedAt: new Date(),
        ...(field === 'voiceRecording' && Number.isFinite(result.duration) ? { durationSeconds: result.duration } : {}),
      };
    },
    async remove(media) {
      await cloudinary.uploader.destroy(media.publicId, { ...options, resource_type: media.resourceType, invalidate: true });
    },
  };
}
