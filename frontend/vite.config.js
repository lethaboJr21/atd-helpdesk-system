import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/helpdesk/",
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    // Bundle files go to "static/" (not "assets/") so the /assets SPA route
    // doesn't collide with a real directory — Apache's SPA fallback skips
    // paths that exist on disk.
    assetsDir: 'static',
  }
})
