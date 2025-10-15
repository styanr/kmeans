type ClusterizeImageOptions = {
  xStep: number;
  yStep: number;
  clusterQuantity: number;
  maxIterations: number;
  tolerance: number;
};

type Pixel = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

const toPixelArray = (
  data: Uint8ClampedArray,
  height: number,
  width: number,
  xStep: number = 1,
  yStep: number = 1,
) => {
  if (height * width !== data.length / 4) {
    throw new Error("Invalid image dimensions");
  }

  const cellsX = Math.ceil(width / xStep);
  const cellsY = Math.ceil(height / yStep);
  const pixels: Pixel[] = new Array(cellsX * cellsY);
  let index = 0;

  for (let y = 0; y < height; y += yStep) {
    for (let x = 0; x < width; x += xStep) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;

      for (let yy = 0; yy < yStep && y + yy < height; yy++) {
        for (let xx = 0; xx < xStep && x + xx < width; xx++) {
          const idx = ((y + yy) * width + (x + xx)) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }
      }

      pixels[index++] = {
        red: r / count,
        green: g / count,
        blue: b / count,
        alpha: a / count,
      };
    }
  }
  return pixels;
};

const fromPixelArray = (
  pixels: Pixel[],
  height: number,
  width: number,
  xStep: number = 1,
  yStep: number = 1,
): Uint8ClampedArray => {
  const cellsX = Math.ceil(width / xStep);
  const cellsY = Math.ceil(height / yStep);

  if (pixels.length !== cellsX * cellsY) {
    throw new Error("Pixel array length does not match expected grid size");
  }

  const output = new Uint8ClampedArray(width * height * 4);
  let index = 0;

  for (let y = 0; y < height; y += yStep) {
    for (let x = 0; x < width; x += xStep) {
      const { red, green, blue, alpha } = pixels[index++];
      for (let yy = 0; yy < yStep && y + yy < height; yy++) {
        for (let xx = 0; xx < xStep && x + xx < width; xx++) {
          const idx = ((y + yy) * width + (x + xx)) * 4;
          output[idx] = red;
          output[idx + 1] = green;
          output[idx + 2] = blue;
          output[idx + 3] = alpha;
        }
      }
    }
  }
  return output;
};

const unique = <T>(
  arr: T[],
  encoder = JSON.stringify,
  decoder = JSON.parse,
): T[] => {
  return [...new Set(arr.map((item) => encoder(item)))].map((item) =>
    decoder(item),
  );
};

const distance = (a: Pixel, b: Pixel) => {
  return Math.sqrt(
    Math.pow(a.alpha - b.alpha, 2) +
      Math.pow(a.red - b.red, 2) +
      Math.pow(a.green - b.green, 2) +
      Math.pow(a.blue - b.blue, 2),
  );
};

export const clusterizeImage = (
  imageData: ImageData,
  options?: Partial<ClusterizeImageOptions>,
): ImageData => {
  const allOptions: ClusterizeImageOptions = {
    xStep: 1,
    yStep: 1,
    clusterQuantity: 2,
    maxIterations: 100,
    tolerance: 0.1,
    ...options,
  };

  const pixels = toPixelArray(
    imageData.data,
    imageData.height,
    imageData.width,
    allOptions.xStep,
    allOptions.yStep,
  );

  const uniqueColors = unique(pixels);
  const centroids = new Array<Pixel>(allOptions.clusterQuantity);
  const clusters: Map<number, number> = new Map<number, number>();
  const picked = new Array<number>(allOptions.clusterQuantity);

  for (let i = 0; i < allOptions.clusterQuantity; i++) {
    let index = 0;
    do {
      index = Math.floor(Math.random() * uniqueColors.length);
    } while (picked.includes(index));
    picked[i] = index;
    centroids[i] = { ...uniqueColors[index] };
  }

  let previousCentroids: Pixel[] = [];
  for (let iteration = 0; iteration < allOptions.maxIterations; iteration++) {
    previousCentroids = centroids.map((c) => ({ ...c }));

    for (let pixel = 0; pixel < pixels.length; pixel++) {
      let closestCentroid = 0;
      let minDistanceSquared = Infinity;
      const p = pixels[pixel];
      for (let ci = 0; ci < centroids.length; ci++) {
        const c = centroids[ci];
        const distSquared =
          (p.alpha - c.alpha) ** 2 +
          (p.red - c.red) ** 2 +
          (p.green - c.green) ** 2 +
          (p.blue - c.blue) ** 2;
        if (distSquared < minDistanceSquared) {
          minDistanceSquared = distSquared;
          closestCentroid = ci;
        }
      }
      clusters.set(pixel, closestCentroid);
    }

    const clusterSums = new Array(centroids.length).fill(null).map(() => ({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
      count: 0,
    }));

    for (let pixel = 0; pixel < pixels.length; pixel++) {
      const clusterIndex = clusters.get(pixel)!;
      const p = pixels[pixel];
      const sum = clusterSums[clusterIndex];
      sum.red += p.red;
      sum.green += p.green;
      sum.blue += p.blue;
      sum.alpha += p.alpha;
      sum.count++;
    }

    for (let ci = 0; ci < centroids.length; ci++) {
      const sum = clusterSums[ci];
      if (sum.count > 0) {
        centroids[ci] = {
          red: sum.red / sum.count,
          green: sum.green / sum.count,
          blue: sum.blue / sum.count,
          alpha: sum.alpha / sum.count,
        };
      }
    }

    const hasConverged = centroids.every(
      (centroid, i) =>
        distance(centroid, previousCentroids[i]) < allOptions.tolerance,
    );

    if (hasConverged) {
      break;
    }
  }

  for (let i = 0; i < pixels.length; i++) {
    const clusterIndex = clusters.get(i)!;
    const centroid = centroids[clusterIndex];
    const pixel = pixels[i];
    pixel.alpha = Math.round(centroid.alpha);
    pixel.blue = Math.round(centroid.blue);
    pixel.green = Math.round(centroid.green);
    pixel.red = Math.round(centroid.red);
  }

  const newData = fromPixelArray(
    pixels,
    imageData.height,
    imageData.width,
    allOptions.xStep,
    allOptions.yStep,
  );

  return new ImageData(newData, imageData.width, imageData.height);
};
