import { useState } from 'react';
import { copyPublicUrl, shareQrImage } from '../lib/shareQr';

interface ShareQRButtonProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  publicUrl: string;
  slug: string;
}

export default function ShareQRButton({
  svgRef,
  publicUrl,
  slug,
}: ShareQRButtonProps) {
  const [busy, setBusy] = useState<'share' | 'copy' | null>(null);

  async function handleShare() {
    if (!svgRef.current || busy) return;
    setBusy('share');
    try {
      const result = await shareQrImage({
        svg: svgRef.current,
        publicUrl,
        slug,
      });
      if (result === 'downloaded') {
        alert('QR image downloaded.');
      }
    } catch (err) {
      console.error('Failed to share QR', err);
      alert('Could not share QR. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    if (busy) return;
    setBusy('copy');
    try {
      await copyPublicUrl(publicUrl);
      alert('Link copied to clipboard.');
    } catch (err) {
      console.error('Failed to copy link', err);
      alert('Could not copy link.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col sm:flex-row gap-2 w-full">
      <button
        type="button"
        onClick={handleShare}
        disabled={busy !== null}
        data-testid="share-qr-button"
        className="flex-1 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy === 'share' ? 'Sharing…' : '📱 Share my QR'}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={busy !== null}
        data-testid="copy-link-button"
        className="flex-1 px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy === 'copy' ? 'Copying…' : '📋 Copy link'}
      </button>
    </div>
  );
}
