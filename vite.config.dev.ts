import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, 'playground'),
  server: {
    port: 3000,
    open: true,
    host: true // Allow external connections for mobile testing
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~/': resolve(__dirname, 'playground/')
    }
  },
  optimizeDeps: {
    exclude: ['opencv.js']
  },
  publicDir: resolve(__dirname, 'playground/public')
}) 