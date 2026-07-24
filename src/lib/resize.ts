/**
 * Phone cameras hand back 4000px, 4MB JPEGs. Shrinking in the browser keeps
 * uploads fast on bar wifi and keeps image-token costs sane — Opus 4.8 reads up
 * to 2576px on the long edge, so anything past that is paid for and discarded.
 */
export async function shrink(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  return new File([blob], "capture.jpg", { type: "image/jpeg" });
}
