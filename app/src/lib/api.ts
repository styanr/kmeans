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
  const startTime = performance.now();

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

  const endTime = performance.now();
  console.log(
    `🔄 toPixelArray: ${(endTime - startTime).toFixed(2)}ms (${pixels.length} pixels)`,
  );
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
  const startTime = performance.now();

  const result = [...new Set(arr.map((item) => encoder(item)))].map((item) =>
    decoder(item),
  );

  const endTime = performance.now();
  console.log(
    `🎨 unique colors: ${(endTime - startTime).toFixed(2)}ms (${arr.length} → ${result.length} unique)`,
  );
  return result;
};

const createCanvas = async (file: File) => {
  const startTime = performance.now();

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);

  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const endTime = performance.now();
  console.log(
    `🖼️  createCanvas: ${(endTime - startTime).toFixed(2)}ms (${img.width}x${img.height})`,
  );
  return canvas;
};

// Euclidian distance
const distance = (a: Pixel, b: Pixel) => {
  return Math.sqrt(
    Math.pow(a.alpha - b.alpha, 2) +
      Math.pow(a.red - b.red, 2) +
      Math.pow(a.green - b.green, 2) +
      Math.pow(a.blue - b.blue, 2),
  );
};

export const clusterizeImage = async (
  file: File,
  options?: Partial<ClusterizeImageOptions>,
): Promise<File> => {
  const totalStartTime = performance.now();
  console.log(`🚀 Starting clusterizeImage for ${file.name}`);

  const allOptions: ClusterizeImageOptions = {
    xStep: 1,
    yStep: 1,
    clusterQuantity: 2,
    maxIterations: 100,
    tolerance: 0.1,
    ...options,
  };

  const canvas = await createCanvas(file);
  const context = canvas.getContext("2d")!;

  const imageDataStart = performance.now();
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const imageDataEnd = performance.now();
  console.log(
    `📊 getImageData: ${(imageDataEnd - imageDataStart).toFixed(2)}ms`,
  );

  const pixels = toPixelArray(
    imageData.data,
    imageData.height,
    imageData.width,
    allOptions.xStep,
    allOptions.yStep,
  );

  const uniqueColors = unique(pixels);

  const initStart = performance.now();
  const centroids = new Array<Pixel>(allOptions.clusterQuantity);
  const clusters: Map<number, number> = new Map<number, number>();
  const picked = new Array<number>(allOptions.clusterQuantity);

  for (let i = 0; i < allOptions.clusterQuantity; i++) {
    let index = 0;
    do {
      index = Math.floor(Math.random() * uniqueColors.length);
    } while (picked.includes(index));

    picked[i] = index;
    const color = uniqueColors[index];

    centroids[i] = {
      ...color,
    };
  }
  const initEnd = performance.now();
  console.log(
    `🎯 Centroid initialization: ${(initEnd - initStart).toFixed(2)}ms`,
  );
  console.log("Centroids (first iteration)", centroids);

  let previousCentroids: Pixel[] = [];

  const iterationsStart = performance.now();
  let iterationCount = 0;

  for (let iteration = 0; iteration < allOptions.maxIterations; iteration++) {
    const iterStart = performance.now();
    iterationCount = iteration + 1;

    previousCentroids = centroids.map((c) => ({ ...c }));

    const assignStart = performance.now();

    for (let pixel = 0; pixel < pixels.length; pixel++) {
      let closestCentroid = 0;
      let minDistanceSquared = Infinity;

      const p = pixels[pixel];

      for (let ci = 0; ci < centroids.length; ci++) {
        const c = centroids[ci];

        const distSquared =
          (p.alpha - c.alpha) * (p.alpha - c.alpha) +
          (p.red - c.red) * (p.red - c.red) +
          (p.green - c.green) * (p.green - c.green) +
          (p.blue - c.blue) * (p.blue - c.blue);

        if (distSquared < minDistanceSquared) {
          minDistanceSquared = distSquared;
          closestCentroid = ci;
        }
      }

      clusters.set(pixel, closestCentroid);
    }
    const assignEnd = performance.now();

    const updateStart = performance.now();

    const clusterSums = new Array(centroids.length).fill(null).map(() => ({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
      count: 0,
    }));

    const clusterBuildStart = performance.now();

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

    const clusterBuildEnd = performance.now();

    const centroidCalcStart = performance.now();
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
    const centroidCalcEnd = performance.now();
    const updateEnd = performance.now();

    console.log(
      `    ├── Cluster building: ${(clusterBuildEnd - clusterBuildStart).toFixed(2)}ms`,
    );
    console.log(
      `    └── Centroid calc: ${(centroidCalcEnd - centroidCalcStart).toFixed(2)}ms`,
    );

    const convStart = performance.now();
    const hasConverged = centroids.every((centroid, i) => {
      const dist = distance(centroid, previousCentroids[i]);
      console.log(`Centroid ${i} distance`, dist);
      return dist < allOptions.tolerance;
    });
    const convEnd = performance.now();

    const iterEnd = performance.now();
    console.log(
      `📈 Iteration ${iteration + 1}: ${(iterEnd - iterStart).toFixed(2)}ms total`,
    );
    console.log(`  ├── Assignment: ${(assignEnd - assignStart).toFixed(2)}ms`);
    console.log(`  ├── Update: ${(updateEnd - updateStart).toFixed(2)}ms`);
    console.log(`  └── Convergence: ${(convEnd - convStart).toFixed(2)}ms`);

    if (hasConverged) {
      console.log(`✅ Converged after ${iteration + 1} iterations`);
      break;
    }
  }

  const iterationsEnd = performance.now();
  const avgIterationTime = (iterationsEnd - iterationsStart) / iterationCount;
  console.log(
    `🔄 K-means iterations: ${(iterationsEnd - iterationsStart).toFixed(2)}ms total (${iterationCount} iterations, ${avgIterationTime.toFixed(2)}ms avg)`,
  );

  const reconstructStart = performance.now();
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

  imageData.data.set(newData);

  context.putImageData(imageData, 0, 0);
  const reconstructEnd = performance.now();
  console.log(
    `🏗️  Image reconstruction: ${(reconstructEnd - reconstructStart).toFixed(2)}ms`,
  );

  const exportStart = performance.now();
  const result = await new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Canvas export failed");
      resolve(new File([blob], file.name, { type: file.type }));
    }, file.type);
  });
  const exportEnd = performance.now();
  console.log(`💾 Canvas export: ${(exportEnd - exportStart).toFixed(2)}ms`);

  const totalEndTime = performance.now();
  const totalTime = totalEndTime - totalStartTime;
  console.log(`🏁 Total clusterizeImage time: ${totalTime.toFixed(2)}ms`);

  console.log(`\n📊 PERFORMANCE SUMMARY:`);
  console.log(
    `├── Canvas creation: ${(performance.now() - totalStartTime - totalTime + (performance.now() - totalStartTime)).toFixed(1)}%`,
  );
  console.log(
    `├── K-means iterations: ${(((iterationsEnd - iterationsStart) / totalTime) * 100).toFixed(1)}%`,
  );
  console.log(
    `├── Image reconstruction: ${(((reconstructEnd - reconstructStart) / totalTime) * 100).toFixed(1)}%`,
  );
  console.log(
    `└── Other operations: ${(100 - ((iterationsEnd - iterationsStart) / totalTime) * 100 - ((reconstructEnd - reconstructStart) / totalTime) * 100).toFixed(1)}%`,
  );

  return result;
};
