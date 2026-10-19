import { it, expect, vi } from 'vitest';
import { validateMedia, createUploadService } from '../src/services/uploadService.js';
import { v2 as cloudinary } from 'cloudinary';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=', 'base64');
it('validates real photo signatures, size and declared MIME', async () => {
  await expect(validateMedia({ buffer: png, size: png.length, mimetype: 'image/png' }, 'photo')).resolves.toBeUndefined();
  await expect(validateMedia({ buffer: Buffer.from('fake image'), size: 10, mimetype: 'image/png' }, 'photo')).rejects.toMatchObject({ status: 415 });
  await expect(validateMedia({ buffer: png, size: 6 * 1024 * 1024, mimetype: 'image/png' }, 'photo')).rejects.toMatchObject({ status: 413 });
  await expect(validateMedia({ buffer: png, size: png.length, mimetype: 'image/jpeg' }, 'photo')).rejects.toMatchObject({ status: 415 });
});
it('fails clearly when persistent storage is not configured', async () => {
  await expect(createUploadService({}).upload({ buffer: png, size: png.length, mimetype: 'image/png' }, 'photo')).rejects.toMatchObject({ status: 503 });
});
it('uses Cloudinary streaming and deletes persistent objects through the SDK', async () => {
  const upload = vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => ({
    end(buffer) { expect(buffer).toEqual(png); expect(options.resource_type).toBe('image'); callback(null, { secure_url: 'https://storage.example.test/photo', public_id: 'floodwatch/photo' }); },
  }));
  const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  try {
    const service = createUploadService({ CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' });
    const result = await service.upload({ buffer: png, size: png.length, mimetype: 'image/png' }, 'photo');
    expect(result).toMatchObject({ url: 'https://storage.example.test/photo', publicId: 'floodwatch/photo' });
    await service.remove({ ...result, resourceType: 'image' });
    expect(destroy).toHaveBeenCalledWith('floodwatch/photo', expect.objectContaining({ resource_type: 'image' }));
  } finally { upload.mockRestore(); destroy.mockRestore(); }
});
it('accepts browser audio WAV signatures and rejects arbitrary data', async () => {
  const wav = Buffer.alloc(44);
  wav.write('RIFF'); wav.writeUInt32LE(36, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
  await expect(validateMedia({ buffer: wav, size: wav.length, mimetype: 'audio/wav' }, 'voiceRecording')).resolves.toBeUndefined();
  await expect(validateMedia({ buffer: Buffer.from('unrecognized'), size: 12, mimetype: 'audio/webm' }, 'voiceRecording')).rejects.toMatchObject({ status: 415 });
});
