import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    // The host shares the dev client with other devices on the same LAN.
    // Vite still proxies API and sync requests to the Node process below.
    host: '0.0.0.0',
    proxy: {
      // The host process (server/index.ts) serves the API and the sync
      // websocket. In dev they run as separate processes, so Vite proxies
      // both HTTP and the WS upgrade for /api/* to keep the browser on a
      // single same-origin URL, matching how the host serves both in prod.
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
