import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: parseInt(process.env.PORT ?? '3000'),
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
