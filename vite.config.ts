import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: '/claw-machine-3d/',
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  build: {
    target: 'esnext'
  },
  server: {
    port: 3000
  }
});
