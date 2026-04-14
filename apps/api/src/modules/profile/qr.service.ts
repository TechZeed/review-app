import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export class QrService {
  /**
   * Generate a QR code PNG buffer for the given profile slug.
   * The QR encodes the URL: https://{domain}/r/{slug}
   */
  async generateQrCode(slug: string, size: number = 300): Promise<Buffer> {
    const profileUrl = `${env.FRONTEND_URL}/r/${slug}`;

    const qrBuffer = await QRCode.toBuffer(profileUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return qrBuffer;
  }

  /**
   * Generate a QR code SVG string for the given profile slug.
   */
  async generateQrSvg(slug: string): Promise<string> {
    const profileUrl = `${env.FRONTEND_URL}/r/${slug}`;

    const svgString = await QRCode.toString(profileUrl, {
      errorCorrectionLevel: 'H',
      type: 'svg',
      margin: 2,
    });

    return svgString;
  }

  /**
   * Generate QR code PNG, upload to GCS, return the public URL.
   * Falls back to generating on-the-fly if upload fails.
   */
  async generateAndUploadQr(slug: string): Promise<string> {
    try {
      const qrBuffer = await this.generateQrCode(slug, 600);

      // Attempt to upload to GCS
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({ projectId: env.GCP_PROJECT_ID });
      const bucket = storage.bucket(env.GCP_BUCKET_NAME);
      const fileName = `qr-codes/${slug}.png`;
      const file = bucket.file(fileName);

      await file.save(qrBuffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000',
        },
      });

      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${env.GCP_BUCKET_NAME}/${fileName}`;
      logger.info('QR code uploaded to GCS', { slug, url: publicUrl });
      return publicUrl;
    } catch (error) {
      logger.warn('Failed to upload QR to GCS, will generate on-the-fly', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return a placeholder URL; QR will be generated on demand via the /me/qr endpoint
      return `${env.APP_URL}/api/v1/profiles/${slug}/qr`;
    }
  }
}
