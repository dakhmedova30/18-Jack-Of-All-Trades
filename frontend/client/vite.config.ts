import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api/* to the Spring Boot backend so the browser only talks to one origin.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
