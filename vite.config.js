import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Enable SPA fallback for React Router in development
    historyApiFallback: true
  },
  build: {
    // Ensure proper SPA handling in production
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Optimize for Railway deployment
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'react-markdown', 'react-syntax-highlighter']
        }
      }
    }
  },
  // Ensure preview mode works with React Router (used by Railway)
  preview: {
    host: true,
    port: 4173
  }
})