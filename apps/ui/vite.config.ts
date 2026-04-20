import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadAppConfig, buildDefines } from './config/load';

const appConfig = loadAppConfig(__dirname);

export default defineConfig({
  plugins: [react()],
  define: buildDefines(appConfig),
  server: {
    port: 6513,
    proxy: {
      '/api': {
        target: appConfig.apiUrl,
        changeOrigin: true,
      },
    },
  },
});
