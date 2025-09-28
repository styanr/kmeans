import { GregorianCalendar } from "@internationalized/date";
import type { PiEvents } from "lucide-svelte/icons/pi";

type ClusterizeImageOptions = {
  horizontalStep: number;
  verticalStep: number;
  clusterQuantity: number;
  initializationMethod: "kmeans++" | "random";
  maxIterations: number;
  tolerance: number;
};

type Pixel = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

const toPixelArray = (data: Uint8ClampedArray) => {
  if (data.length % 4 !== 0) {
    throw new Error("Invalid image array length");
  }
  const pixels: Pixel[] = new Array<Pixel>(data.length / 4);
  for (let i = 0; i < data.length; i += 4) {
    pixels[i / 4] = {
      red: data[i],
      green: data[i + 1],
      blue: data[i + 2],
      alpha: data[i + 3],
    };
  }

  return pixels;
};

const unique = <T>(
  arr: T[],
  encoder = JSON.stringify,
  decoder = JSON.parse,
): T[] =>
  [...new Set(arr.map((item) => encoder(item)))].map((item) => decoder(item));

const createCanvas = async (file: File) => {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);

  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
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
  const allOptions: ClusterizeImageOptions = {
    horizontalStep: 1,
    verticalStep: 1,
    clusterQuantity: 2,
    initializationMethod: "kmeans++",
    maxIterations: 100,
    tolerance: 0.01,
    ...options,
  };

  const canvas = await createCanvas(file);
  const context = canvas.getContext("2d")!;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  const pixels = toPixelArray(imageData.data);
  const uniqueColors = unique(pixels);

  console.log("Unique Colors", uniqueColors);
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

  console.log("Centroids (first iteration)", centroids);
  let previousCentroids: Pixel[] = [];

  for (let iteration = 0; iteration < allOptions.maxIterations; iteration++) {
    previousCentroids = centroids.map((c) => ({ ...c }));

    for (let pixel = 0; pixel < pixels.length; pixel++) {
      const distances = new Array<number>(centroids.length);

      for (let ci = 0; ci < centroids.length; ci++) {
        distances[ci] = distance(pixels[pixel], centroids[ci]);
      }

      clusters.set(pixel, distances.indexOf(Math.min(...distances)));
    }

    console.log(clusters);
    for (let ci = 0; ci < centroids.length; ci++) {
      const cluster = [...clusters.entries()]
        .filter((c) => c[1] === ci)
        .map((c) => pixels[c[0]]);

      centroids[ci] = {
        red:
          cluster.map((c) => c.red).reduce((sum, val) => (sum += val), 0) /
          cluster.length,
        green:
          cluster.map((c) => c.green).reduce((sum, val) => (sum += val), 0) /
          cluster.length,
        blue:
          cluster.map((c) => c.blue).reduce((sum, val) => (sum += val), 0) /
          cluster.length,
        alpha:
          cluster.map((c) => c.alpha).reduce((sum, val) => (sum += val), 0) /
          cluster.length,
      };
    }

    const hasConverged = centroids.every((centroid, i) => {
      console.log(
        `Centroid ${i} distance`,
        distance(centroid, previousCentroids[i]),
      );
      return distance(centroid, previousCentroids[i]) < allOptions.tolerance;
    });

    if (hasConverged) {
      console.log(`Converged after ${iteration + 1} iterations`);
      break;
    }
  }

  for (let i = 0; i < pixels.length; i++) {
    const clusterIndex = clusters.get(i)!;
    const centroid = centroids[clusterIndex];

    const dataIndex = i * 4;
    imageData.data[dataIndex] = Math.round(centroid.red);
    imageData.data[dataIndex + 1] = Math.round(centroid.green);
    imageData.data[dataIndex + 2] = Math.round(centroid.blue);
    imageData.data[dataIndex + 3] = Math.round(centroid.alpha);
  }

  context.putImageData(imageData, 0, 0);

  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Canvas export failed");
      resolve(new File([blob], file.name, { type: file.type }));
    }, file.type);
  });
};
