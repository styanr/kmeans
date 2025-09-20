<script lang="ts">
  import { DownloadIcon, LoaderCircleIcon, XIcon } from "lucide-svelte";
  import Button from "./lib/components/ui/button/button.svelte";
  import FileDropZone from "./lib/components/ui/file-drop-zone/file-drop-zone.svelte";
  import Input from "./lib/components/ui/input/input.svelte";
  import Label from "./lib/components/ui/label/label.svelte";
  import { clusterizeImage } from "./lib/api";
  import Slider from "./lib/components/ui/slider/slider.svelte";

  let imageFile = $state<File | null>();
  let processedImageFile = $state<File | null>();

  let horizontalStep = $state<number>(1);
  let verticalStep = $state<number>(1);
  let clustersQuantity = $state<number>(2);
  let processedImageOpacity = $state(100);
  let isLoading = $state(false);

  const imageUrl = $derived(
    imageFile ? window.URL.createObjectURL(imageFile) : "",
  );
  const processedImageUrl = $derived(
    processedImageFile ? window.URL.createObjectURL(processedImageFile) : "",
  );

  const onUpload = (files: File[]) => {
    imageFile = files[0];
  };

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!imageFile) {
      return;
    }

    isLoading = true;

    try {
      const processed = await clusterizeImage(imageFile);
      processedImageFile = processed;
    } finally {
      isLoading = false;
    }
  };

  const reset = () => {
    imageFile = null;
    processedImageFile = null;
    horizontalStep = 1;
    verticalStep = 1;
    clustersQuantity = 2;
    processedImageOpacity = 100;
  };

  const download = () => {
    if (!processedImageFile || !processedImageUrl) return;

    var link = document.createElement("a");
    link.download = "clusters." + processedImageFile.name;
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
  <h1 class="text-3xl mb-10">K-Means Clustering</h1>

  <div class="flex flex-row w-6xl h-[35rem] gap-5 justify-center">
    {#if imageUrl !== ""}
      <form
        class="flex-1 flex flex-col h-full justify-between"
        onsubmit={onSubmit}
      >
        <div class="flex flex-col gap-5">
          <div class="items-center grid grid-cols-[30%_70%]">
            <Label>Horizontal Step</Label>
            <Input type="number" bind:value={horizontalStep} min="1" />
          </div>
          <div class="items-center grid grid-cols-[30%_70%]">
            <Label>Vertical Step</Label>
            <Input type="number" bind:value={verticalStep} min="1" />
          </div>
          <div class="items-center grid grid-cols-[30%_70%]">
            <Label>Clusters Number</Label>
            <Input type="number" bind:value={clustersQuantity} min="1" />
          </div>
        </div>
        <Button disabled={isLoading} type="submit">Clusterize</Button>
      </form>
      <div
        class={"relative border-border flex h-full flex-1 place-items-center justify-center rounded-lg border-2 border-dashed transition-all hover:cursor-pointer aria-disabled:opacity-50 aria-disabled:hover:cursor-not-allowed"}
      >
        <img
          class="w-full h-full object-contain"
          alt="placeholder"
          src={imageUrl}
        />
        {#if processedImageUrl}
          <div class="absolute h-full">
            <img
              style={`opacity: ${processedImageOpacity}%`}
              class="w-full h-full object-contain"
              alt="placeholder"
              src={processedImageUrl}
            />
            <!-- TODO: wrong starting value -->
            <Slider
              type="single"
              min={0}
              max={100}
              step={1}
              bind:value={processedImageOpacity}
            />
            {processedImageOpacity}
          </div>
        {/if}
        <div class="absolute right-0 bottom-0 -translate-5 flex flex-row gap-5">
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
</main>
