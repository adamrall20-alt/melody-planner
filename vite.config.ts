import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    host: process.env.MELODY_LAN === '1' ? '0.0.0.0' : '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4310',
        changeOrigin: false,
        xfwd: true,
      },
      '/media': {
        target: 'http://127.0.0.1:4310',
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
});
