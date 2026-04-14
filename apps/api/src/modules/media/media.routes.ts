import { Router } from 'express';
import { MediaController } from './media.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { uploadMediaSchema, mediaIdParamSchema } from './media.validation.js';
import { multerUpload } from './upload/multer.config.js';

export const mediaRouter = Router();
const controller = new MediaController();

// POST /upload — Upload media (text direct, voice/video via multer)
// Public endpoint — requires valid review token from submission
mediaRouter.post(
  '/upload',
  multerUpload.single('file'),
  validateBody(uploadMediaSchema),
  controller.upload,
);

// GET /:mediaId — Stream / redirect to media content
mediaRouter.get(
  '/:mediaId',
  validateParams(mediaIdParamSchema),
  controller.stream,
);

// GET /:mediaId/signed-url — Get signed URL for direct media access
mediaRouter.get(
  '/:mediaId/signed-url',
  validateParams(mediaIdParamSchema),
  controller.getSignedUrl,
);
