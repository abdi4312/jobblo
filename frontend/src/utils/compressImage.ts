/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * Every upload surface in the app used to do the same thing: measure the file the person
 * picked and refuse it if it was too big. `ImageUpload` rejected anything over 2 MB, the
 * evidence picker over 10 MB. But a photo straight off a phone camera is 3–8 MB, so the
 * common case was not "user picks a huge file by mistake" — it was "user picks a normal
 * photo and is told no". People retried with the same file, or gave up.
 *
 * A 4032×3024 phone photo carries far more pixels than any Jobblo surface renders. Scaled
 * to 1920px on the long edge and re-encoded, the same picture is typically 200–400 KB —
 * under every limit in the stack, including the 12 MB JSON body parser and whatever an
 * ingress in front of the API is configured with, with no visible loss at the sizes we
 * display.
 *
 * No new dependency: this is `createImageBitmap` + `<canvas>`.
 */

export interface CompressImageOptions {
  /** Longest edge of the output, in CSS pixels. */
  maxDimension?: number;
  /** Encoder quality, 0–1. */
  quality?: number;
}

const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.82;

/**
 * Formats that must be handed through untouched.
 *
 * PDFs are not images. GIFs are, but a canvas keeps only the first frame, so compressing
 * one silently destroys the animation. SVG is vector — rasterising it makes it bigger and
 * worse.
 */
const PASSTHROUGH_TYPES = new Set(['image/gif', 'image/svg+xml', 'application/pdf']);

interface LoadedSource {
  source: CanvasImageSource & { width: number; height: number };
  release: () => void;
}

/**
 * Decode the file to something drawable.
 *
 * `createImageBitmap` with `imageOrientation: 'from-image'` is the path that matters:
 * phone photos carry an EXIF orientation flag, and drawing them to a canvas without
 * honouring it turns every portrait shot on its side. The `<img>` fallback is for browsers
 * without the bitmap API, which apply EXIF themselves when rendering.
 */
async function loadSource(file: File): Promise<LoadedSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, release: () => bitmap.close() };
    } catch {
      // Safari has shipped `createImageBitmap` without the options argument. Fall through.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
    return { source: img, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Encode the canvas, preferring WebP.
 *
 * `toBlob` does not report that it cannot honour a requested type — it silently falls back
 * to PNG, which for a photograph is *larger* than the JPEG we started with. So the result
 * type is checked rather than trusted, and anything that is not WebP is re-encoded as JPEG.
 */
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === 'image/webp') return resolve(webp);
        canvas.toBlob((jpeg) => resolve(jpeg), 'image/jpeg', quality);
      },
      'image/webp',
      quality
    );
  });
}

const renameFor = (name: string, mimeType: string): string => {
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const base = name.replace(/\.[^./\\]+$/, '') || 'bilde';
  return `${base}.${ext}`;
};

/**
 * Compress one image. Never throws and never returns nothing: on any failure — unreadable
 * file, no canvas, an encoder that produced something bigger — the original file is
 * returned, so a compression problem can never become an upload problem.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  if (typeof document === 'undefined') return file;
  if (!file.type.startsWith('image/') || PASSTHROUGH_TYPES.has(file.type)) return file;

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  let loaded: LoadedSource;
  try {
    loaded = await loadSource(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = loaded.source;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);

    const blob = await encode(canvas, quality);

    // An already-optimised small image can come out bigger than it went in. Keep the
    // smaller of the two rather than assuming the round trip was worth it.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], renameFor(file.name, blob.type), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    loaded.release();
  }
}

/** Compress a batch, preserving order. Same no-throw guarantee as `compressImage`. */
export async function compressImages(
  files: File[],
  options: CompressImageOptions = {}
): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}
