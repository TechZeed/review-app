import { Request, Response, NextFunction } from 'express';
import { MediaService } from './media.service.js';
import { MediaRepository } from './media.repo.js';
import { MediaType, MediaResponse } from './media.types.js';

export class MediaController {
  private service: MediaService;

  constructor() {
    // In production, pass actual Sequelize model:
    //   import { ReviewMedia } from './media.model.js';
    //   new MediaRepository(ReviewMedia)
    this.service = new MediaService(new MediaRepository(null as any));
  }

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reviewToken, reviewId, mediaType, textContent } = req.body;
      const file = (req as any).file as Express.Multer.File | undefined;

      let result;

      switch (mediaType) {
        case MediaType.TEXT:
          result = await this.service.uploadText({
            reviewToken,
            reviewId,
            mediaType: MediaType.TEXT,
            textContent,
          });
          break;

        case MediaType.VOICE:
          if (!file) {
            return next(
              new Error('File is required for voice upload'),
            );
          }
          result = await this.service.uploadVoice(
            { reviewToken, reviewId, mediaType: MediaType.VOICE },
            file,
          );
          break;

        case MediaType.VIDEO:
          if (!file) {
            return next(
              new Error('File is required for video upload'),
            );
          }
          result = await this.service.uploadVideo(
            { reviewToken, reviewId, mediaType: MediaType.VIDEO },
            file,
          );
          break;

        default:
          return next(
            new Error(`Invalid media type: ${mediaType}`),
          );
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const media = await this.service.getById(req.params.mediaId as string);
      res.json(this.toResponse(media));
    } catch (error) {
      next(error);
    }
  };

  stream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const urlData = await this.service.getSignedUrl(req.params.mediaId as string);
      if (urlData.signedUrl) {
        res.redirect(302, urlData.signedUrl);
      } else {
        // Text media — return content directly
        res.json({ content: urlData.transcription });
      }
    } catch (error) {
      next(error);
    }
  };

  getSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const urlData = await this.service.getSignedUrl(req.params.mediaId as string);
      res.json(urlData);
    } catch (error) {
      next(error);
    }
  };

  private toResponse(media: any): MediaResponse {
    return {
      id: media.id,
      reviewId: media.reviewId,
      mediaType: media.mediaType,
      contentText: media.contentText,
      mediaUrl: media.mediaUrl,
      transcription: media.transcription,
      durationSecs: media.durationSecs,
      processingStatus: media.processingStatus,
      createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
    };
  }
}
