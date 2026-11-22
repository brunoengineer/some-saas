import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Relative asset paths so the built prototype can be hosted from any folder.
  base: './',
  // Recharts makes the main chunk ~900 kB; fine for an internal tool. pptxgenjs is split out.
  build: { chunkSizeWarningLimit: 1000 },
});
