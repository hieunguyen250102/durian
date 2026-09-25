import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev the socket connects to the Vite origin and is proxied to the game server.
    proxy: {
      '/socket.io': { target: 'http://localhost:3210', ws: true },
      '/auth': 'http://localhost:3210',
    },
  },
});
