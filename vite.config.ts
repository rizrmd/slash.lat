import { defineConfig } from 'vite';

export default defineConfig({
  base: '/slash.lat/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  }
});
