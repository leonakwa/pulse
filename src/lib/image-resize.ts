// Runs in the browser. Crops to the target shape and shrinks the photo before upload,
// so a 6 MB phone picture becomes a few hundred KB. Output is always JPEG.
export async function resizeImage(file: File, width: number, height: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // respects the photo's rotation

  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Your browser could not process this image.');
  }

  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not process this image.');
  return blob;
}
