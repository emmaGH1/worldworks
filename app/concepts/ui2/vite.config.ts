import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Standalone concept entry. Reads the engine wasm from app/src/engine (read-only, unchanged).
const here = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: here,
  server: { port: 5190, host: '127.0.0.1', fs: { allow: [here, fileURLToPath(new URL('../../src/engine', import.meta.url))] } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
