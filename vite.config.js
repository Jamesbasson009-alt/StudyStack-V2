import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    // Empty config prevents Vite from searching up parent directories for PostCSS config
    postcss: {},
  },
});
