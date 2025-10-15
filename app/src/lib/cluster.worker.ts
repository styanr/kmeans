import { clusterizeImage } from "./api";

self.onmessage = async (event: MessageEvent) => {
  const { imageData, options } = event.data;

  try {
    const processedImageData = clusterizeImage(imageData, options);

    self.postMessage(
      { status: "success", data: processedImageData },
      { transfer: [processedImageData.data.buffer] },
    );
  } catch (error) {
    self.postMessage({ status: "error", error: (error as Error).message });
  }
};
