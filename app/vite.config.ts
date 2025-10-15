import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
});
