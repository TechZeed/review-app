import multer from 'multer';
import { AppError } from '../../../shared/errors/appError.js';

const VOICE_MAX_SIZE = 5 * 1024 * 1024;   // 5MB
const VIDEO_MAX_SIZE = 25 * 1024 * 1024;   // 25MB

const ALLOWED_AUDIO_MIMES = [
  'audio/webm',
  'audio/ogg',
  'audio/opus',
];

const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
];

const ALLOWED_MIMES = [...ALLOWED_AUDIO_MIMES, ...ALLOWED_VIDEO_MIMES];

function fileFilter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    cb(new AppError(
      `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIMES.join(', ')}`,
      422,
      'INVALID_FILE_TYPE',
    ) as any);
    return;
  }
  cb(null, true);
}

export const multerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: VIDEO_MAX_SIZE, // Use the larger limit; service validates per type
  },
});

export { VOICE_MAX_SIZE, VIDEO_MAX_SIZE, ALLOWED_AUDIO_MIMES, ALLOWED_VIDEO_MIMES };
