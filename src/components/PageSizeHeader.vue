<template>
  <div v-if="pageSizeSelector?.shouldShow && currentPage" class="page-size-header">
    <PageSizeSelector
      :available-formats="pageSizeSelector.availableFormats.value"
      :current-format="pageSizeSelector.getPageFormat(currentPage)"
      @apply="handleFormatChange"
    />
  </div>
  <div v-else class="header-title">
    <span class="ds-header-text">Document Scanner</span>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import PageSizeSelector from './PageSizeSelector.vue'
import type { PaperFormat } from '../types'

interface Props {
  currentPage?: any
}

interface Emits {
  (e: 'format-change', format: PaperFormat): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Inject the page size selector composable
const pageSizeSelector = inject('pageSizeSelector') as ReturnType<typeof import('../composables/usePageSizeSelector').usePageSizeSelector> | undefined

if (!pageSizeSelector) {
  throw new Error('PageSizeHeader must be used within a component that provides pageSizeSelector')
}

const handleFormatChange = (format: PaperFormat) => {
  emit('format-change', format)
}
</script>

<style scoped>
.page-size-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  pointer-events: none;
}

.ds-header-text {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.025em;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style> 