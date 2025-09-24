type ClusterizeImageOptions = {
  horizontalStep: number;
  verticalStep: number;
  clusterQuantity: number;
  initializationMethod: "kmeans++" | "random";
  maxIterations: number;
  tolerance: number;
};

async function applyHueShift(file: File, degrees = 90): Promise<File> {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);

  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d")!;
  ctx.filter = `hue-rotate(${degrees}deg)`; // CSS-style filter
  ctx.drawImage(img, 0, 0);

  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Canvas export failed");
      resolve(new File([blob], file.name, { type: file.type }));
    }, file.type);
  });
}

export const clusterizeImage = async (
  file: File,
  options?: Partial<ClusterizeImageOptions>,
): Promise<File> => {
  const allOptions: ClusterizeImageOptions = {
    horizontalStep: 1,
    verticalStep: 1,
    clusterQuantity: 2,
    initializationMethod: "kmeans++",
    maxIterations: 100,
    tolerance: 0.01,
    ...options,
  };

  await new Promise((r) => setTimeout(r, 1000));

  return applyHueShift(file, 120);
};
