/**
 * Phone cameras hand back 4000px, 4MB JPEGs. Shrinking in the browser keeps
 * uploads fast on bar wifi and keeps image-token costs sane — Opus 4.8 reads up
 * to 2576px on the long edge, so anything past that is paid for and discarded.
 */

/** What the judge reads, and what the album keeps. */
const FULL_EDGE = 1600;
const FULL_QUALITY = 0.85;

/**
 * What the feed paints. A phone shows these about 400px wide, so 640 covers
 * retina and lands around 40KB — against ~300KB for the full copy, times the
 * sixty rows the wire holds.
 */
const THUMB_EDGE = 640;
const THUMB_QUALITY = 0.72;

type Rendered = { file: File; width: number; height: number };

/** One decode, however many sizes we want out of it. */
function render(
  bitmap: ImageBitmap,
  name: string,
  maxEdge: number,
  quality: number,
): Promise<Rendered | null> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);

  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) =>
        resolve(
          blob
            ? { file: new File([blob], name, { type: "image/jpeg" }), width, height }
            : null,
        ),
      "image/jpeg",
      quality,
    ),
  );
}

/** A single downscaled copy. What enrolment references need. */
export async function shrink(
  file: File,
  maxEdge = FULL_EDGE,
  quality = FULL_QUALITY,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const out = await render(bitmap, "capture.jpg", maxEdge, quality);
    return out?.file ?? file;
  } finally {
    bitmap.close();
  }
}

export type Capture = {
  full: File;
  /** Null if the browser wouldn't hand over a canvas — the feed then falls
   *  back to the full copy, same as every photo taken before thumbnails. */
  thumb: File | null;
  width: number;
  height: number;
};

/**
 * The two copies a capture needs, off one decode: the full one the judge scores
 * and the small one the feed shows, plus the dimensions so the feed can hold a
 * row's height before the image lands.
 */
export async function prepareCapture(file: File): Promise<Capture> {
  const bitmap = await createImageBitmap(file);

  try {
    const [full, thumb] = await Promise.all([
      render(bitmap, "capture.jpg", FULL_EDGE, FULL_QUALITY),
      render(bitmap, "thumb.jpg", THUMB_EDGE, THUMB_QUALITY),
    ]);

    if (!full) {
      return { full: file, thumb: null, width: bitmap.width, height: bitmap.height };
    }

    return {
      full: full.file,
      thumb: thumb?.file ?? null,
      width: full.width,
      height: full.height,
    };
  } finally {
    bitmap.close();
  }
}
