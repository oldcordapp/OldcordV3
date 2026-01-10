import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgrPlugin from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    svgrPlugin(),
  ],

  build: {
    outDir: '../../www_static/assets/selector',

    emptyOutDir: true,

    assetsDir: '',
  },

  base: '/assets/selector/',

  server: {
    proxy: {
      '^/assets/(?!selector(/|$)).*': {
        target: 'http://localhost:1337', // Assuming that dev express server port is 1337
        changeOrigin: true,
      },
      '/instance': {
        target: 'http://localhost:1337', // Assuming that dev express server port is 1337
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:1337', // Assuming that dev express server port is 1337
        changeOrigin: true,
      },
    },
  },
});
