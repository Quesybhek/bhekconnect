/** Square-crop helpers used by the avatar picker. */

export const CROP_BOX = 260;
export const CROP_OUTPUT = 512;

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

/** Cover-fit scale for an image inside the square crop box. */
export function baseScale(img: { width: number; height: number }) {
  return Math.max(CROP_BOX / img.width, CROP_BOX / img.height);
}

/**
 * Render the visible part of the crop box to a square JPEG blob.
 * `offset` is in crop-box pixels, `zoom` multiplies the cover-fit scale.
 */
export async function cropToBlob(
  img: HTMLImageElement,
  zoom: number,
  offset: { x: number; y: number },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT;
  canvas.height = CROP_OUTPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const ratio = CROP_OUTPUT / CROP_BOX;
  const scale = baseScale(img) * zoom * ratio;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (CROP_OUTPUT - dw) / 2 + offset.x * ratio;
  const dy = (CROP_OUTPUT - dh) / 2 + offset.y * ratio;

  ctx.fillStyle = "#0b0f0d";
  ctx.fillRect(0, 0, CROP_OUTPUT, CROP_OUTPUT);
  ctx.drawImage(img, dx, dy, dw, dh);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not crop that image"))),
      "image/jpeg",
      0.92,
    );
  });
}
