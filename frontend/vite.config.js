import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/helpdesk/",
  plugins: [
    react(),
    {
      name: "atd-helpdesk-canonical-route",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const originalUrl = String(request.url || "");
          const [requestPath, query = ""] = originalUrl.split("?");
          if (requestPath === "/helpdesk") {
            response.statusCode = 308;
            response.setHeader("Location", `/helpdesk/${query ? `?${query}` : ""}`);
            response.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // The backend CORS allowlist only has localhost:5173; present that
        // origin even when the dev server is browsed via its LAN IP.
        headers: { origin: 'http://localhost:5173' },
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
