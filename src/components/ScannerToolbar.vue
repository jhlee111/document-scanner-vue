<script setup lang="ts">
import type { Page } from '@/types'
import { RotateCcw, RotateCw, RefreshCcw, Crop, Edit, Trash2, UndoDot, SquareDashed } from 'lucide-vue-next'

interface Props {
  currentDisplayPage: Page | null
  isInEditMode: boolean
  isInPreviewMode: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'rotate-left'): void
  (e: 'rotate-right'): void
  (e: 'reset-corners'): void
  (e: 'crop'): void
  (e: 'switch-to-edit'): void
  (e: 'delete-page'): void
}>()

const handleRotateLeft = () => emit('rotate-left')
const handleRotateRight = () => emit('rotate-right')
const handleResetCorners = () => emit('reset-corners')
const handleCrop = () => emit('crop')
const handleSwitchToEdit = () => emit('switch-to-edit')
const handleDeletePage = () => emit('delete-page')
</script>

<template>
  <!-- Controls toolbar - improved design with better spacing and visual hierarchy -->
  <div class="controls-toolbar d-flex justify-content-center align-items-center gap-3 px-4 py-3 bg-dark"
      style="z-index: 1000; min-height: 70px; flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.15);">

      <!-- Edit Mode Controls -->
      <template v-if="isInEditMode">
          <!-- Rotation Controls Group -->
          <div class="btn-group-custom d-flex gap-3">
              <button @click="handleRotateLeft" class="btn btn-outline-light btn-toolbar"
                  title="Rotate left 90°" aria-label="Rotate left 90 degrees">
                  <UndoDot class="me-1" color="white" :size="18" />
                  <span class="btn-label ds-button-text d-sm-inline">90°</span>
              </button>
              <button @click="handleRotateRight" class="btn btn-outline-light btn-toolbar"
                  title="Rotate right 90°" aria-label="Rotate right 90 degrees">
                  <UndoDot style="transform: scaleX(-1);" class="me-1" color="white" :size="18" />
                  <span class="btn-label ds-button-text d-sm-inline">90°</span>
              </button>
          </div>

          <!-- Divider -->
          <div class="toolbar-divider"></div>

          <!-- Adjustment Controls Group -->
          <div class="btn-group-custom d-flex gap-3">
              <button @click="handleResetCorners" class="btn btn-outline-light btn-toolbar"
                  title="Reset corner adjustments" aria-label="Reset corner adjustments">
                  <SquareDashed class="me-1" color="white" :size="18" />
                  <span class="btn-label ds-button-text d-sm-inline">Reset</span>
              </button>
              <button @click="handleCrop" class="btn btn-success btn-toolbar btn-primary-action"
                  title="Apply crop and process document" aria-label="Apply crop and process document">
                  <Crop class="me-1" color="white" :size="18" />
                  <span class="btn-label ds-button-text">Crop</span>
              </button>
          </div>
      </template>

      <!-- Preview Mode Controls -->
      <template v-else-if="isInPreviewMode">
          <div class="btn-group-custom btn-group-preview d-flex gap-5">
              <button @click="handleSwitchToEdit" class="btn btn-outline-light btn-toolbar"
                  title="Edit this page" aria-label="Edit this page">
                  <Edit class="me-1" color="white" :size="18" />
                  <span class="btn-label ds-button-text">Edit</span>
              </button>
              <button @click="handleDeletePage" class="btn btn-outline-danger btn-toolbar btn-destructive"
                  title="Delete this page" aria-label="Delete this page">
                  <Trash2 class="me-1" color="white" :size="18" />
                  <span class="btn-label ds-button-text">Delete</span>
              </button>
          </div>
      </template>
  </div>
</template>

<style scoped>
/* Typography System Integration */
.controls-toolbar {
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

/* Controls toolbar styling */
.controls-toolbar {
    backdrop-filter: blur(10px);
    background-color: rgba(0, 0, 0, 0.95) !important;
    border-radius: 0;
    box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.3);
}

/* Button Group Styling */
.btn-group-custom {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Toolbar Divider */
.toolbar-divider {
    width: 1px;
    height: 32px;
    background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.3), transparent);
    margin: 0 8px;
}

/* Enhanced Button Styling */
.btn-toolbar {
    min-height: 48px;
    min-width: 48px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    border-width: 1.5px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    font-family: var(--ds-font-family);
}

/* Adjustment Controls Button Width Consistency */
.btn-group-custom .btn-toolbar {
    width: min(40vw, 7rem);
    max-width: 7rem;
    min-width: 5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

/* Preview Mode Buttons - 75% Larger */
.btn-group-preview .btn-toolbar {
    width: min(50vw, 12.25rem);
    max-width: 12.25rem;
    min-width: 8.75rem;
    min-height: 56px;
    padding: 12px 16px;
    font-size: 1rem;
}

/* Primary Action Button (Crop) */
.btn-primary-action {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    border-color: #28a745;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
    font-weight: 700;
}

.btn-primary-action:hover {
    background: linear-gradient(135deg, #218838 0%, #1ea085 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(40, 167, 69, 0.4);
}

/* Destructive Action Button (Delete) */
.btn-destructive {
    border-color: #dc3545;
    background-color: rgba(220, 53, 69, 0.1);
}

.btn-destructive:hover {
    background-color: rgba(220, 53, 69, 0.2);
    border-color: #c82333;
    transform: translateY(-1px);
}

/* Enhanced Hover Effects */
.btn-toolbar:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-outline-light.btn-toolbar:hover {
    background-color: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.8);
}

/* Active/Focus States */
.btn-toolbar:active {
    transform: translateY(0);
    transition: transform 0.1s;
}

.btn-toolbar:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
    z-index: 1;
}

/* Ripple Effect */
.btn-toolbar::before {
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

.btn-toolbar:active::before {
    width: 100px;
    height: 100px;
}

/* Mobile Optimizations */
@media (max-width: 576px) {
    .controls-toolbar {
        gap: 2px !important;
        padding: 12px 8px !important;
        min-height: 64px !important;
    }
    
    .btn-group-custom {
        padding: 2px;
        gap: 1px !important;
    }
    
    .btn-toolbar {
        min-height: 44px;
        min-width: 44px;
        padding: 6px 8px;
        font-size: 0.8rem;
    }
    
    /* Adjust button width for mobile */
    .btn-group-custom .btn-toolbar {
        width: min(32vw, 4.5rem);
        max-width: 4.5rem;
        min-width: 3.5rem;
    }
    
    .toolbar-divider {
        height: 28px;
        margin: 0 4px;
    }
    
    /* Larger preview buttons for mobile */
    .btn-group-preview .btn-toolbar {
        width: min(42vw, 7rem);
        max-width: 7rem;
        min-width: 5.5rem;
        min-height: 52px;
        padding: 10px 14px;
        font-size: 0.9rem;
    }
    
    /* Override gap for preview mode buttons on mobile */
    .btn-group-preview {
        gap: 1rem !important;
    }
}

/* Tablet Optimizations */
@media (min-width: 577px) and (max-width: 768px) {
    .controls-toolbar {
        gap: 4px !important;
        padding: 16px 12px !important;
    }
    
    .btn-toolbar {
        min-height: 50px;
        min-width: 50px;
        padding: 10px 14px;
    }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
    .controls-toolbar {
        background-color: #000 !important;
        border-top: 2px solid #fff;
    }
    
    .btn-group-custom {
        background-color: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.3);
    }
    
    .btn-toolbar {
        border-width: 2px;
        font-weight: 700;
    }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
    .btn-toolbar,
    .btn-toolbar::before {
        transition: none;
    }
    
    .btn-toolbar:hover {
        transform: none;
    }
}
</style> 