/**
 * Helpers to rasterise a QR SVG to PNG and share / download it.
 * Keeps ProfileCard free of canvas/blob plumbing.
 */

/**
 * Rasterise an SVG element to a PNG blob at the given square size.
 * Draws on a 2D canvas via an Image(data URL).
 */
export function svgElementToPngBlob(svg: SVGElement, size = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    // Ensure xmlns is present so the Image can parse it standalone.
    const cloned = svg.cloneNode(true) as SVGElement;
    if (!cloned.getAttribute('xmlns')) {
      cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    const svgString = serializer.serializeToString(cloned);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get 2D canvas context'));
        return;
      }
      // White background so QR stays scannable.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob returned null'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into image'));
    };
    img.src = url;
  });
}

export type ShareResult = 'shared' | 'downloaded' | 'copied';

/**
 * Try native share-with-file first; fall back to downloading the PNG.
 * Treats user cancellation (AbortError) as a successful share.
 */
export async function shareQrImage(params: {
  svg: SVGElement;
  publicUrl: string;
  slug: string;
}): Promise<ShareResult> {
  const { svg, publicUrl, slug } = params;
  const blob = await svgElementToPngBlob(svg, 512);
  const file = new File([blob], `${slug}-review-qr.png`, { type: 'image/png' });

  // Web Share Level 2 — attach file.
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Review me',
        text: `Scan to leave a quick review -> ${publicUrl}`,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'shared';
      }
      // Fall through to download on any other share error.
    }
  }

  // Fallback: trigger a download of the PNG.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-review-qr.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export async function copyPublicUrl(publicUrl: string): Promise<void> {
  await navigator.clipboard.writeText(publicUrl);
}
