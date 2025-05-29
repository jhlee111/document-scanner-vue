<template>
  <div 
    class="fullscreen-header d-flex justify-content-between align-items-center px-4 py-2 position-relative"
    style="z-index: 1000; min-height: 56px; flex-shrink: 0;"
  >
    <!-- Close button (left side) -->
    <button 
      @click="handleClose" 
      class="btn btn-header-action" 
      title="Close Scanner"
      aria-label="Close Scanner"
    >
      <X color="white" :size="24" />
    </button>

    <!-- Center content slot -->
    <div class="header-center">
      <slot name="center">
        <div class="header-title">
          <span class="ds-header-text">Document Scanner</span>
        </div>
      </slot>
    </div>

    <!-- Import button (right side) -->
    <button 
      @click="handleImport" 
      class="btn btn-header-action btn-import d-flex align-items-center gap-2" 
      title="Import images from gallery"
      aria-label="Import images from gallery"
    >
      <Images color="white" :size="24" />
      <span class="ds-button-text">Import</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { X, Images } from 'lucide-vue-next'

// Emits
const emit = defineEmits<{
  close: []
  import: []
}>()

// Methods
const handleClose = () => {
  emit('close')
}

const handleImport = () => {
  emit('import')
}
</script>

<style scoped>
/* Typography System Integration */
.fullscreen-header {
  /* Font Family Stack - Optimized for UI readability */
  --ds-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  
  /* Font Weights */
  --ds-font-weight-normal: 400;
  --ds-font-weight-medium: 500;
  --ds-font-weight-semibold: 600;
  --ds-font-weight-bold: 700;
  
  /* Font Sizes - Mobile First */
  --ds-font-size-xs: 0.75rem;    /* 12px */
  --ds-font-size-sm: 0.875rem;   /* 14px */
  --ds-font-size-base: 1rem;     /* 16px */
  --ds-font-size-lg: 1.125rem;   /* 18px */
  
  /* Line Heights */
  --ds-line-height-tight: 1.25;
  --ds-line-height-normal: 1.5;
  
  /* Letter Spacing */
  --ds-letter-spacing-tight: -0.025em;
  --ds-letter-spacing-normal: 0;
  --ds-letter-spacing-wide: 0.025em;
  
  /* Apply base typography */
  font-family: var(--ds-font-family);
  
  /* Improve text rendering */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Button Typography */
.ds-button-text {
  font-size: var(--ds-font-size-sm);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  letter-spacing: var(--ds-letter-spacing-wide);
  font-family: var(--ds-font-family);
}

/* Header Typography */
.ds-header-text {
  font-size: var(--ds-font-size-lg);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  letter-spacing: var(--ds-letter-spacing-tight);
  font-family: var(--ds-font-family);
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.fullscreen-header {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.6) 100%);
  backdrop-filter: blur(15px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
}

/* Header Action Buttons */
.btn-header-action {
  min-height: 48px;
  min-width: 48px;
  padding: 8px 12px;
  border: 1.5px solid transparent;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  font-family: var(--ds-font-family);
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.btn-header-action:hover {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: white;
}

.btn-header-action:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
  color: white;
}

.btn-header-action:active {
  transform: translateY(0);
  transition: transform 0.1s;
}

/* Import Button Special Styling */
.btn-import {
  background: linear-gradient(135deg, rgba(13, 110, 253, 0.8) 0%, rgba(102, 16, 242, 0.8) 100%);
  border-color: rgba(13, 110, 253, 0.5);
  box-shadow: 0 2px 8px rgba(13, 110, 253, 0.3);
}

.btn-import:hover {
  background: linear-gradient(135deg, rgba(13, 110, 253, 0.9) 0%, rgba(102, 16, 242, 0.9) 100%);
  border-color: rgba(13, 110, 253, 0.8);
  box-shadow: 0 4px 16px rgba(13, 110, 253, 0.4);
}

/* Header Title */
.header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  pointer-events: none;
}

/* Ripple Effect for Header Buttons */
.btn-header-action::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.3s, height 0.3s;
}

.btn-header-action:active::before {
  width: 80px;
  height: 80px;
}

/* Mobile Optimizations */
@media (max-width: 576px) {
  .fullscreen-header {
    padding: 8px 16px !important;
    min-height: 52px !important;
  }
  
  .btn-header-action {
    min-height: 44px;
    min-width: 44px;
    padding: 6px 10px;
    border-radius: 10px;
  }
  
  .ds-button-text {
    font-size: 0.8rem;
  }
  
  .ds-header-text {
    font-size: var(--ds-font-size-base);
  }
}

/* Tablet Optimizations */
@media (min-width: 577px) and (max-width: 768px) {
  .btn-header-action {
    min-height: 50px;
    min-width: 50px;
    padding: 10px 14px;
  }
}

/* Responsive Typography */
@media (min-width: 768px) {
  .fullscreen-header {
    --ds-font-size-sm: 0.9rem;   /* Slightly larger on tablet+ */
    --ds-font-size-base: 1.125rem;
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .fullscreen-header {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}

/* Ensure consistent styling for buttons */
.btn-link {
  text-decoration: none;
}

/* Fix for d-flex not working on buttons due to CSS specificity */
.fullscreen-header .btn.d-flex {
  display: flex;
}

.btn-link:hover {
  text-decoration: none;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.btn-link:focus {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  border-radius: 8px;
}

/* Import button specific styling */
.btn-link i {
  transition: transform 0.2s ease;
}

.btn-link:hover i {
  transform: scale(1.1);
}
</style> 