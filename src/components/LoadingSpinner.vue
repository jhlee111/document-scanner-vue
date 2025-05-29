<script setup lang="ts">
const props = defineProps({
    message: {
        type: String,
        default: 'Loading...',
    },
});

</script>

<template>
    <div class="loading-spinner d-flex flex-column align-items-center justify-content-center p-4 bg-white rounded shadow-lg">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">{{ props.message }}</span>
        </div>
        <p class="h5 text-secondary mt-3 ds-loading-message">{{ props.message }}</p>
    </div>
</template>

<style scoped>
/* Typography System Integration */
.loading-spinner {
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
  
  /* Component sizing */
  min-width: 200px;
  min-height: 150px;
}

/* Loading Message Typography */
.ds-loading-message {
  font-size: var(--ds-font-size-lg);
  font-weight: var(--ds-font-weight-medium);
  line-height: var(--ds-line-height-tight);
  font-family: var(--ds-font-family);
}

.spinner-border {
    width: 3rem; 
    height: 3rem;
}

/* Responsive Typography */
@media (min-width: 768px) {
  .loading-spinner {
    --ds-font-size-lg: 1.25rem;   /* Slightly larger on tablet+ */
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .loading-spinner {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}
</style>
