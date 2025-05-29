<template>
  <div 
    class="document-scanner-initial-trigger d-flex align-items-center justify-content-center p-3"
    style="min-height: 100px;"
  >
    <button 
      @click="handleClick" 
      class="btn btn-primary ds-button-text" 
      :class="[`btn-${buttonSize}`, { 'disabled': isLoading }]"
      :disabled="isLoading"
      title="Scan documents with camera"
    >
      <div v-if="isLoading" class="d-flex align-items-center">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span class="ds-status-message">{{ processingStatus || 'Processing...' }}</span>
      </div>
      <div v-else class="d-flex align-items-center">
        <Camera :size="36" class="me-2" />
        <span class="ds-button-text">{{ label }}</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Camera } from 'lucide-vue-next'

// Props
interface Props {
  buttonSize?: 'sm' | 'md' | 'lg'
  label?: string
  isLoading?: boolean
  processingStatus?: string
}

const props = withDefaults(defineProps<Props>(), {
  buttonSize: 'md',
  label: 'Scan Documents',
  isLoading: false,
  processingStatus: ''
})

// Emits
const emit = defineEmits<{
  click: []
}>()

// Methods
const handleClick = () => {
  if (!props.isLoading) {
    emit('click')
  }
}
</script>

<style scoped>
/* Typography System Integration */
.document-scanner-initial-trigger {
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
  --ds-font-size-xl: 1.25rem;    /* 20px */
  
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
  font-size: var(--ds-font-size-base);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  letter-spacing: var(--ds-letter-spacing-wide);
  font-family: var(--ds-font-family);
}

/* Status Message Typography */
.ds-status-message {
  font-size: var(--ds-font-size-base);
  font-weight: var(--ds-font-weight-medium);
  line-height: var(--ds-line-height-normal);
  font-family: var(--ds-font-family);
}

/* Responsive Typography */
@media (min-width: 768px) {
  .document-scanner-initial-trigger {
    --ds-font-size-base: 1.125rem;   /* 18px on tablet+ */
    --ds-font-size-lg: 1.25rem;      /* 20px on tablet+ */
  }
}

@media (min-width: 1024px) {
  .document-scanner-initial-trigger {
    --ds-font-size-base: 1.125rem;   /* 18px on desktop */
    --ds-font-size-lg: 1.375rem;     /* 22px on desktop */
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .document-scanner-initial-trigger {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}

/* Enhanced Button Styling */
.document-scanner-initial-trigger .btn {
  font-family: var(--ds-font-family);
  transition: all 0.2s ease-in-out;
}


.document-scanner-initial-trigger .btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(13, 110, 253, 0.3);
}

.document-scanner-initial-trigger .btn:active {
  transform: translateY(0);
}
</style> 