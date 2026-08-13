import type { Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Failed to load image")));
    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

/** Renders the cropped pixel area to a JPEG File for avatar upload. */
export async function getCroppedAvatarFile(
  imageSrc: string,
  crop: Area,
  fileName = `avatar-${Date.now()}.jpg`,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.max(1, Math.round(Math.min(crop.width, crop.height)));
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not create image"));
      },
      "image/jpeg",
      0.92,
    );
  });

  return new File([blob], fileName, { type: "image/jpeg" });
}
