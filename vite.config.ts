import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { watch: { ignored: ['**/.playwright-mcp/**'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
