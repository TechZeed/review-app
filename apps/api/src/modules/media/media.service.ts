import { MediaRepository } from './media.repo.js';
import { MediaType, ProcessingStatus, UploadMediaInput, UploadResponse } from './media.types.js';
import { AppError } from '../../shared/errors/appError.js';
import { env } from '../../config/env.js';

// GCS storage client — import when storage config module is implemented
// import { uploadToGcs, generateSignedUrl } from '../../shared/storage/gcs.js';

const UPLOAD_WINDOW_MINUTES = 10;
const VOICE_MAX_SIZE_BYTES = 5 * 1024 * 1024;   // 5MB
const VIDEO_MAX_SIZE_BYTES = 25 * 1024 * 1024;   // 25MB

export class MediaService {
  constructor(private repo: MediaRepository) {}

  async uploadText(data: UploadMediaInput): Promise<UploadResponse> {
    await this.validateUploadWindow(data.reviewId);
    await this.checkExistingMedia(data.reviewId);

    if (!data.textContent || data.textContent.length === 0) {
      throw new AppError('Text content is required for text media', 422, 'MISSING_TEXT_CONTENT');
    }

    if (data.textContent.length > 280) {
      throw new AppError('Text content must be 280 characters or less', 422, 'TEXT_TOO_LONG');
    }

    const media = await this.repo.create({
      reviewId: data.reviewId,
      mediaType: MediaType.TEXT,
      contentText: data.textContent,
      processingStatus: ProcessingStatus.COMPLETED,
    });

    return {
      mediaId: media.id,
      textContent: media.contentText,
      processingStatus: ProcessingStatus.COMPLETED,
    };
  }

  async uploadVoice(
    data: UploadMediaInput,
    file: Express.Multer.File,
  ): Promise<UploadResponse> {
    await this.validateUploadWindow(data.reviewId);
    await this.checkExistingMedia(data.reviewId);

    if (file.size > VOICE_MAX_SIZE_BYTES) {
      throw new AppError('Voice file exceeds 5MB limit', 413, 'FILE_TOO_LARGE');
    }

    // Upload to GCS
    const gcsPath = `media/voice/${data.reviewId}/recording.webm`;

    // In production, stream the buffer to GCS:
    // await uploadToGcs(env.GCP_BUCKET_NAME, gcsPath, file.buffer, file.mimetype);

    const media = await this.repo.create({
      reviewId: data.reviewId,
      mediaType: MediaType.VOICE,
      mediaUrl: gcsPath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      processingStatus: ProcessingStatus.PROCESSING,
    });

    // Trigger async transcription
    // In production, enqueue a Cloud Tasks job:
    // await enqueueTranscriptionJob(media.id, gcsPath);
    console.log(`[MediaService] Async transcription enqueued for media ${media.id}`);

    return {
      mediaId: media.id,
      processingStatus: ProcessingStatus.PROCESSING,
      estimatedProcessingSeconds: 30,
    };
  }

  async uploadVideo(
    data: UploadMediaInput,
    file: Express.Multer.File,
  ): Promise<UploadResponse> {
    await this.validateUploadWindow(data.reviewId);
    await this.checkExistingMedia(data.reviewId);

    if (file.size > VIDEO_MAX_SIZE_BYTES) {
      throw new AppError('Video file exceeds 25MB limit', 413, 'FILE_TOO_LARGE');
    }

    // Upload to GCS
    const ext = file.mimetype === 'video/webm' ? 'webm' : 'mp4';
    const gcsPath = `media/video/${data.reviewId}/original.${ext}`;

    // In production, stream the buffer to GCS:
    // await uploadToGcs(env.GCP_BUCKET_NAME, gcsPath, file.buffer, file.mimetype);

    const media = await this.repo.create({
      reviewId: data.reviewId,
      mediaType: MediaType.VIDEO,
      mediaUrl: gcsPath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      processingStatus: ProcessingStatus.PROCESSING,
    });

    // Trigger async transcoding + transcription
    // In production, enqueue Cloud Tasks jobs:
    // await enqueueTranscodeJob(media.id, gcsPath);
    // await enqueueTranscriptionJob(media.id, gcsPath);
    console.log(`[MediaService] Async transcoding + transcription enqueued for media ${media.id}`);

    return {
      mediaId: media.id,
      processingStatus: ProcessingStatus.PROCESSING,
      estimatedProcessingSeconds: 60,
    };
  }

  async getById(mediaId: string) {
    const media = await this.repo.findById(mediaId);
    if (!media) {
      throw new AppError('Media not found', 404, 'MEDIA_NOT_FOUND');
    }
    return media;
  }

  async getSignedUrl(mediaId: string) {
    const media = await this.getById(mediaId);

    if (media.mediaType === MediaType.TEXT) {
      return {
        signedUrl: null,
        mediaType: media.mediaType,
        transcription: media.contentText,
      };
    }

    if (!media.mediaUrl) {
      throw new AppError('Media file not available', 404, 'MEDIA_FILE_NOT_FOUND');
    }

    // In production, generate a signed URL from GCS:
    // const signedUrl = await generateSignedUrl(env.GCP_BUCKET_NAME, media.mediaUrl, 60);
    const signedUrl = `https://storage.googleapis.com/${env.GCP_BUCKET_NAME}/${media.mediaUrl}?signed=placeholder`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      signedUrl,
      expiresAt,
      mediaType: media.mediaType,
      duration: media.durationSeconds ?? undefined,
      transcription: media.transcription,
    };
  }

  async validateUploadWindow(reviewId: string): Promise<void> {
    // In production, look up the review's submittedAt timestamp:
    // const review = await reviewRepo.findById(reviewId);
    // if (!review) throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
    // const submittedAt = new Date(review.submittedAt);
    // const windowClose = new Date(submittedAt.getTime() + UPLOAD_WINDOW_MINUTES * 60 * 1000);
    // if (new Date() > windowClose) {
    //   throw new AppError('Upload window expired', 410, 'UPLOAD_WINDOW_EXPIRED');
    // }

    // Placeholder — will validate against review.submittedAt in production
    return;
  }

  private async checkExistingMedia(reviewId: string): Promise<void> {
    const existing = await this.repo.findByReviewId(reviewId);
    if (existing) {
      throw new AppError('Media already attached to this review', 409, 'MEDIA_ALREADY_ATTACHED');
    }
  }
}
