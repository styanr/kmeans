<script lang="ts">
  import { DownloadIcon, LoaderCircleIcon, XIcon } from "lucide-svelte";
  import Button from "./lib/components/ui/button/button.svelte";
  import FileDropZone from "./lib/components/ui/file-drop-zone/file-drop-zone.svelte";
  import Input from "./lib/components/ui/input/input.svelte";
  import Label from "./lib/components/ui/label/label.svelte";
  import Slider from "./lib/components/ui/slider/slider.svelte";
  import { onMount, onDestroy } from "svelte";

  let imageFile = $state<File | null>();
  let processedImageFile = $state<File | null>();
  let xStep = $state<number>(1);
  let yStep = $state<number>(1);
  let clusterQuantity = $state<number>(2);
  let maxIterations = $state<number>(100);
  let tolerance = $state<number>(0.1);
  let processedImageOpacity = $state(100);
  let isLoading = $state(false);
  let imageWidth = $state<number>(0);
  let imageHeight = $state<number>(0);
  let worker: Worker | null = null;

  const imageUrl = $derived(
    imageFile ? window.URL.createObjectURL(imageFile) : "",
  );
  const processedImageUrl = $derived(
    processedImageFile ? window.URL.createObjectURL(processedImageFile) : "",
  );
  const gridWidth = $derived(
    imageWidth > 0 ? Math.ceil(imageWidth / xStep) : 0,
  );
  const gridHeight = $derived(
    imageHeight > 0 ? Math.ceil(imageHeight / yStep) : 0,
  );
  const totalSamples = $derived(gridWidth * gridHeight);

  onMount(() => {
    worker = new Worker(new URL("./lib/cluster.worker.ts", import.meta.url), {
      type: "module",
    });
  });

  onDestroy(() => {
    worker?.terminate();
  });

  const getImageData = (file: File): Promise<ImageData> => {
    return new Promise<ImageData>((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Cannot get canvas context"));
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
    });
  };

  const imageDataToFile = (
    imageData: ImageData,
    originalFile: File,
  ): Promise<File> => {
    return new Promise<File>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Cannot get canvas context"));
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas to Blob conversion failed"));
        const newFile = new File([blob], originalFile.name, {
          type: originalFile.type,
        });
        resolve(newFile);
      }, originalFile.type);
    });
  };

  const runClusteringInWorker = (
    imageData: ImageData,
    options: any,
  ): Promise<ImageData> => {
    return new Promise<ImageData>((resolve, reject) => {
      if (!worker) return reject(new Error("Worker not initialized"));

      const messageHandler = (event: MessageEvent) => {
        worker?.removeEventListener("message", messageHandler);
        worker?.removeEventListener("error", errorHandler);
        if (event.data.status === "success") {
          resolve(event.data.data);
        } else {
          reject(new Error(event.data.error));
        }
      };

      const errorHandler = (error: ErrorEvent) => {
        worker?.removeEventListener("message", messageHandler);
        worker?.removeEventListener("error", errorHandler);
        reject(error);
      };

      worker.addEventListener("message", messageHandler);
      worker.addEventListener("error", errorHandler);

      worker.postMessage(
        { imageData: imageData, options: options },
        { transfer: [imageData.data.buffer] },
      );
    });
  };

  const onUpload = (files: File[]) => {
    imageFile = files[0];
    const img = new Image();
    img.onload = () => {
      imageWidth = img.naturalWidth;
      imageHeight = img.naturalHeight;
    };
    img.src = window.URL.createObjectURL(files[0]);
    return Promise.resolve();
  };

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    isLoading = true;
    try {
      const originalImageData = await getImageData(imageFile);
      const options = {
        xStep,
        yStep,
        clusterQuantity,
        maxIterations,
        tolerance,
      };
      const processedImageData = await runClusteringInWorker(
        originalImageData,
        options,
      );
      const newImageFile = await imageDataToFile(processedImageData, imageFile);
      processedImageFile = newImageFile;
    } catch (error) {
      console.error("Clustering process failed:", error);
    } finally {
      isLoading = false;
    }
  };

  const reset = () => {
    imageFile = null;
    processedImageFile = null;
    xStep = 1;
    yStep = 1;
    clusterQuantity = 2;
    maxIterations = 100;
    tolerance = 0.1;
    processedImageOpacity = 100;
    imageWidth = 0;
    imageHeight = 0;
  };

  const download = () => {
    if (!processedImageFile || !processedImageUrl) return;
    const link = document.createElement("a");
    link.download =
      "clusters." + (processedImageFile.name.split(".").pop() || "png");
    link.href = processedImageUrl;
    link.click();
  };
</script>

<main class="h-full flex flex-col justify-center items-center">
  {#if isLoading}
    <div
      class="absolute h-full w-full flex justify-center items-center bg-white/10 backdrop-blur-md z-50"
    >
      <LoaderCircleIcon size={40} class="animate-spin" />
    </div>
  {/if}
  <div class="">
    <h1 class="text-3xl mb-10 text-center">K-Means Clustering</h1>

    <div class="flex flex-row w-6xl h-[35rem] gap-5 justify-center">
      {#if imageUrl !== ""}
        <form
          class="flex-1 flex flex-col h-full justify-between gap-5"
          onsubmit={onSubmit}
        >
          <div class="flex flex-col gap-5">
            <div
              class="bg-muted/50 rounded-lg p-4 space-y-2 border border-border"
            >
              <h3
                class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
              >
                Image Information
              </h3>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span class="text-muted-foreground">Resolution:</span>
                  <span class="font-medium ml-2"
                    >{imageWidth} × {imageHeight}</span
                  >
                </div>
                <div>
                  <span class="text-muted-foreground">Grid:</span>
                  <span class="font-medium ml-2"
                    >{gridWidth} × {gridHeight}</span
                  >
                </div>
                <div class="col-span-2">
                  <span class="text-muted-foreground">Sample Points:</span>
                  <span class="font-medium ml-2"
                    >{totalSamples.toLocaleString()}</span
                  >
                </div>
              </div>
            </div>

            <div class="items-center grid grid-cols-[30%_70%]">
              <Label for="xStep">Horizontal Step</Label>
              <Input id="xStep" type="number" bind:value={xStep} min="1" />
            </div>
            <div class="items-center grid grid-cols-[30%_70%]">
              <Label for="yStep">Vertical Step</Label>
              <Input id="yStep" type="number" bind:value={yStep} min="1" />
            </div>
            <div class="items-center grid grid-cols-[30%_70%]">
              <Label for="clusters">Clusters Number</Label>
              <Input
                id="clusters"
                type="number"
                bind:value={clusterQuantity}
                min="1"
              />
            </div>
            <div class="items-center grid grid-cols-[30%_70%]">
              <Label for="maxIter">Max Iterations</Label>
              <Input
                id="maxIter"
                type="number"
                bind:value={maxIterations}
                min="1"
              />
            </div>
            <div class="items-center grid grid-cols-[30%_70%]">
              <Label for="tolerance">Tolerance</Label>
              <Input
                id="tolerance"
                type="number"
                step="0.0001"
                bind:value={tolerance}
                min="0"
              />
            </div>
          </div>
          <Button disabled={isLoading} type="submit">Clusterize</Button>
        </form>
        <div
          class={"relative border-border flex h-full flex-1 place-items-center justify-center rounded-lg border-2 border-dashed transition-all hover:cursor-pointer aria-disabled:opacity-50 aria-disabled:hover:cursor-not-allowed"}
        >
          <img
            class="w-full h-full object-contain"
            alt="Original uploaded image"
            src={imageUrl}
          />
          {#if processedImageUrl}
            <div class="absolute h-full w-full flex flex-col">
              <img
                style={`opacity: ${processedImageOpacity}%`}
                class="w-full h-full object-contain"
                alt="Clustered image result"
                src={processedImageUrl}
              />
              <div
                class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent"
              >
                <div class="flex items-center gap-3">
                  <Label
                    for="opacity"
                    class="text-white text-sm font-medium whitespace-nowrap"
                  >
                    Opacity: {processedImageOpacity}%
                  </Label>
                  <Slider
                    id="opacity"
                    type="single"
                    min={0}
                    max={100}
                    step={1}
                    bind:value={processedImageOpacity}
                    class="flex-1"
                  />
                </div>
              </div>
            </div>
          {/if}
          <div
            class="absolute right-0 bottom-0 -translate-15 flex flex-row gap-5"
          >
            {#if processedImageUrl}
              <Button
                class="rounded-full h-10 !px-5"
                disabled={isLoading}
                onclick={download}
              >
                <DownloadIcon />
                Download
              </Button>
            {/if}
            <Button
              class="rounded-full h-10 w-10"
              variant="destructive"
              disabled={isLoading}
              onclick={reset}
            >
              <XIcon size={12} />
            </Button>
          </div>
        </div>
      {:else}
        <FileDropZone
          {onUpload}
          accept="image/png, image/jpeg"
          class="flex-1 h-full"
        />
      {/if}
    </div>
  </div>
</main>
