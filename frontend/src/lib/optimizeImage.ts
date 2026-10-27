const MAX_IMAGE_DIMENSION = 1920;

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The optimized image could not be read."));
    };
    reader.onerror = () => reject(new Error("The optimized image could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function optimizeImageForUpload(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The selected image could not be opened. Please choose another image.");
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image optimization is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const optimized = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("The selected image could not be optimized.")),
        "image/webp",
        0.82,
      );
    });
    if (optimized.size > 6 * 1024 * 1024) {
      throw new Error("The optimized image is still too large. Choose a smaller image.");
    }
    return readAsDataUrl(optimized);
  } finally {
    bitmap.close();
  }
}
