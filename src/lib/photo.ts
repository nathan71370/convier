export const PHOTO_SIZE = 256;

/**
 * Centre-crops any source to a square thumbnail. `mirror` flips it
 * horizontally, which the front camera needs: people frame themselves against
 * a mirrored preview, and an unflipped result reads as someone else's face.
 */
function squareDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  mirror = false,
): string {
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de traiter l'image.");

  context.imageSmoothingQuality = "high";
  if (mirror) {
    context.translate(PHOTO_SIZE, 0);
    context.scale(-1, 1);
  }
  context.drawImage(source, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);

  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * Reduces any picture the phone hands us to a square thumbnail, in the
 * browser, before it ever touches the network. A 256px JPEG lands around
 * 20 Ko — small enough to live in the database as a data URL.
 */
export async function toSquareDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ce fichier n'est pas une image.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    return squareDataUrl(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Grabs the frame currently showing in a live camera preview. */
export function frameToSquareDataUrl(
  video: HTMLVideoElement,
  mirror: boolean,
): string {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("La caméra n'est pas encore prête.");
  }
  return squareDataUrl(video, video.videoWidth, video.videoHeight, mirror);
}

/** Deterministic ink colour from a name, so an avatar keeps its identity. */
export function inkFor(name: string): string {
  const hues = [12, 28, 46, 96, 152, 188, 214, 268, 320];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${hues[hash % hues.length]} 42% 42%)`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  // Guests mostly enter a first name alone; one letter reads better than two.
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
