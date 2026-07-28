import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser barely changes between releases; splitting it keeps the app
        // chunk small and lets the browser cache the engine separately.
        manualChunks: { phaser: ["phaser"] },
      },
    },
    chunkSizeWarningLimit: 1400,
  },
});
