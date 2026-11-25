/**
 * Crops an image to a centred square and scales it to `size` px, returned as a JPEG. Keeps
 * profile pictures small (a few KB) no matter how big the photo the user picked was.
 * Transparent areas (PNGs) become white. Rejects if the file can't be read as an image.
 */
export async function resizeToSquareJpeg(file: File, size = 256): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Your browser can't process images");

  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image"))),
      'image/jpeg',
      0.85,
    );
  });
}

/**
 * Scales an image down to fit inside `maxWidth` x `maxHeight` (never up), keeping its shape and any
 * transparency. Returned as WebP, or PNG on browsers that can't encode WebP. For logos.
 */
export async function resizeToFit(file: File, maxWidth = 600, maxHeight = 300): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image");
  }

  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Your browser can't process images");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image"))),
      'image/webp',
      0.9,
    );
  });
}
