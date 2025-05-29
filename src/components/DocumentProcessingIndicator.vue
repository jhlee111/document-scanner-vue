<template>
  <div v-if="isVisible" 
    class="document-processing-indicator position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center"
    style="z-index: 2000; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px);">
    <div class="text-center text-white">
      <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <h5 class="mb-3 ds-status-message">{{ status }}</h5>
      <div class="progress mx-auto" style="width: 300px; height: 8px;">
        <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
          role="progressbar" 
          :style="{ width: progress + '%' }"
          :aria-valuenow="progress" 
          aria-valuemin="0" 
          aria-valuemax="100">
        </div>
      </div>
      <small class="text-muted mt-2 d-block ds-text-caption">{{ Math.round(progress) }}% complete</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// --- Props ---
interface Props {
  /** Whether the processing indicator should be visible */
  isVisible: boolean;
  /** Current processing status message */
  status: string;
  /** Progress percentage (0-100) */
  progress: number;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
  status: 'Processing...',
  progress: 0,
});

// --- Computed Properties ---
const progressPercentage = computed(() => {
  return Math.max(0, Math.min(100, props.progress));
});
</script>

<style scoped>
/* Typography System Integration */
.document-processing-indicator {
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
  
  /* Component styling */
  border-radius: 8px;
  animation: fadeIn 0.3s ease-in-out;
}

/* Typography Classes */
.ds-status-message {
  font-size: var(--ds-font-size-lg);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  font-family: var(--ds-font-family);
}

.ds-text-caption {
  font-size: var(--ds-font-size-xs);
  font-weight: var(--ds-font-weight-normal);
  line-height: var(--ds-line-height-normal);
  font-family: var(--ds-font-family);
}

/* Document processing indicator styling */
.document-processing-indicator .spinner-border {
  border-width: 4px;
}

.document-processing-indicator .progress {
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.2);
}

.document-processing-indicator .progress-bar {
  transition: width 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Responsive Typography */
@media (min-width: 768px) {
  .document-processing-indicator {
    --ds-font-size-lg: 1.25rem;   /* Slightly larger on tablet+ */
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .document-processing-indicator {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .document-processing-indicator .progress {
    width: 250px !important;
  }
  
  .document-processing-indicator h5 {
    font-size: 1.1rem;
  }
}
</style> 