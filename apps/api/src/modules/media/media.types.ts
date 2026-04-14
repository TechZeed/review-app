export enum MediaType {
  TEXT = 'text',
  VOICE = 'voice',
  VIDEO = 'video',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface UploadMediaInput {
  reviewToken: string;
  reviewId: string;
  mediaType: MediaType;
  textContent?: string;
}

export interface MediaResponse {
  id: string;
  reviewId: string;
  mediaType: MediaType;
  contentText?: string;
  mediaUrl?: string;
  transcription?: string;
  durationSecs?: number;
  processingStatus: ProcessingStatus;
  createdAt: string;
}

export interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
  mediaType: MediaType;
  duration?: number;
  transcription?: string;
}

export interface UploadResponse {
  mediaId: string;
  presignedUploadUrl?: string;
  textContent?: string;
  processingStatus: ProcessingStatus;
  expiresAt?: string;
  estimatedProcessingSeconds?: number;
}
