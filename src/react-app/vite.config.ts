import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  define: {
    global: {}
  },
  server: {
    host: 'localhost',
    port: 8443
  },
  build: {
    outDir: '../../dist'
  }
})
