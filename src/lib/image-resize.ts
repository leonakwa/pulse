// Browser-only helpers. Photos are shrunk before upload, so a 6 MB phone picture becomes a few hundred KB.
// Output is always JPEG.
async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not process this image.');
  return blob;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

// Crops to an exact shape (profile pictures and covers).
export async function resizeImage(file: File, width: number, height: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // respects the photo's rotation
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const sw = width / scale;
  const sh = height / scale;
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();
  return canvasToJpeg(canvas, quality);
}

// Keeps the original shape, limiting the longest side (post photos).
export async function resizeToMax(file: File, maxSide: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvasToJpeg(canvas, quality);
}
