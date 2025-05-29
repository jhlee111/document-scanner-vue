import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "DocumentScannerVue",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs"],
    },
    cssCodeSplit: false,
    rollupOptions: { 
      external: [
        "vue", 
        "jspdf",
        "@vueuse/core",
        "@jhlee111/vue-opencv-composable"
      ], 
      output: { 
        globals: { 
          vue: "Vue",
          jspdf: "jsPDF",
          "@vueuse/core": "VueUse",
          "@jhlee111/vue-opencv-composable": "VueOpenCVComposable"
        },
        inlineDynamicImports: true,
      },
    },
    sourcemap: true,
    minify: "esbuild",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      vue: "vue/dist/vue.esm-bundler.js",
    },
  },
  optimizeDeps: {
    exclude: ["opencv.js"],
  },
});
