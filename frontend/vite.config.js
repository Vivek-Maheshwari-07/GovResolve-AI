import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // the contract API (backend/API_CONTRACT.md); in production FastAPI serves this UI from the same origin
    proxy: Object.fromEntries(
      ['/query', '/lineage', '/grs', '/documents', '/health'].map((p) => [p, { target: 'http://localhost:8000', changeOrigin: true }]),
    ),
  },
});

