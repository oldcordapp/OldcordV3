import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgrPlugin from 'vite-plugin-svgr';

function redirectPlugin() {
  return {
    name: 'redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/admin' || req.url === '/admin/') {
          // 301 is a permanent redirect
          res.statusCode = 301;
          res.setHeader('Location', '/assets/admin/');
          res.end();
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    svgrPlugin(),
    redirectPlugin(),
  ],

  build: {
    outDir: '../../www_static/assets/admin',

    emptyOutDir: true,

    assetsDir: '',
  },

  base: '/assets/admin/',

  server: {
    proxy: {
      '^/assets/(?!admin(/|$)).*': {
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
      '/login': {
        target: 'http://localhost:1337', // Assuming that dev express server port is 1337
        changeOrigin: true,
      },
    },
  },
});
