<script setup lang="ts">
import { ref, provide, watch } from 'vue'
import type { Corners, PaperFormat } from '../types'
import { usePageSizeSelector } from '../composables/usePageSizeSelector'
import ImagePreview from './ImagePreview.vue'
import DocumentProcessingIndicator from './DocumentProcessingIndicator.vue'
import ScannerHeader from './ScannerHeader.vue'
import PageSizeHeader from './PageSizeHeader.vue'
import ScannerToolbar from './ScannerToolbar.vue'
import ThumbnailStrip from './ThumbnailStrip.vue'
import { Image } from 'lucide-vue-next'

// --- Props ---
interface Props {
  currentDisplayPage: any
  imageSrcForPreviewComponent: string | null
  isInEditMode: boolean
  isInPreviewMode: boolean
  processingStatus: string
  processingProgress: number
  pages: readonly any[]
  activePageId: string | null
  pageCountDisplay: string
  pageManager?: ReturnType<typeof import('../composables/usePageManager').usePageManager>
}

const props = defineProps<Props>()

// --- Emits ---
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'corners-update', corners: Corners | null): void
  (e: 'rotate-left'): void
  (e: 'rotate-right'): void
  (e: 'reset-corners'): void
  (e: 'crop'): void
  (e: 'switch-to-edit'): void
  (e: 'delete-page'): void
  (e: 'page-click', pageId: string): void
  (e: 'add-pages'): void
  (e: 'import-pages'): void
  (e: 'create-pdf'): void
  (e: 'format-change', format: PaperFormat): void
  (e: 'reorder-pages', fromIndex: number, toIndex: number): void
}>()

// --- Composables ---
const pageSizeSelector = usePageSizeSelector()

// Provide the composable for child components
provide('pageSizeSelector', pageSizeSelector)

// --- Refs ---
const imagePreviewRef = ref<InstanceType<typeof ImagePreview> | null>(null)

// --- Watchers ---
// Show page size selector in preview mode and ensure format is applied
watch(
  () => [props.isInPreviewMode, props.currentDisplayPage],
  ([isPreview, currentPage]) => {
    if (isPreview) {
      pageSizeSelector.show()

      // Only trigger processing if the page doesn't have a processed image yet
      // This prevents re-processing auto-processed images
      if (currentPage && currentPage.corners && !currentPage.processedImageDataURL) {
        const currentFormat = pageSizeSelector.getPageFormat(currentPage);
        console.log('[FullscreenScanner] Processing page with format:', currentFormat);
        handleFormatChange(currentFormat);
      }
    } else {
      pageSizeSelector.hide()
    }
  },
  { immediate: true }
)

// --- Methods ---
const handleCornersUpdate = (newCorners: Corners | null) => {
  emit('corners-update', newCorners)
}

const handleDoneClick = async () => {
  if (imagePreviewRef.value && typeof imagePreviewRef.value.processCorners === 'function') {
    imagePreviewRef.value.processCorners()
  }
  emit('crop')
}

const handleFormatChange = (format: PaperFormat) => {
  emit('format-change', format)
}

const handleReorderPages = (fromIndex: number, toIndex: number) => {
  emit('reorder-pages', fromIndex, toIndex)
}

// Expose the imagePreviewRef for parent component access
defineExpose({
  imagePreviewRef
})
</script>

<template>
  <Teleport to="body">
    <div class="fullscreen-overlay d-flex flex-column position-fixed bg-black" data-testid="fullscreen-scanner"
      style="top: 0; left: 0; right: 0; bottom: 0;">
      <!-- Minimal top header - only close button -->
      <ScannerHeader @close="emit('close')" @import="emit('import-pages')">

      </ScannerHeader>

      <div class="fullscreen-image-container w-100 d-flex flex-column" style="flex: 1; min-height: 0;">
        <!-- Document Processing Indicator -->
        <DocumentProcessingIndicator :is-visible="!!processingStatus" :status="processingStatus"
          :progress="processingProgress" />

        <!-- Show ImagePreview for both edit and preview modes -->
        <ImagePreview v-if="currentDisplayPage && imageSrcForPreviewComponent"
          :imageDataURL="imageSrcForPreviewComponent"
          :initialCorners="currentDisplayPage.mode === 'edit' ? (currentDisplayPage.corners ? [...currentDisplayPage.corners] : null) : null"
          :isEditMode="currentDisplayPage.mode === 'edit'" :isProcessedPreview="currentDisplayPage.mode === 'preview'"
          :pageManager="pageManager"
          @corners-adjusted="handleCornersUpdate" class="w-100" style="flex: 1; min-height: 0;" ref="imagePreviewRef" />

        <!-- Enhanced Empty State: No image available -->
        <div v-else class="w-100 h-100 d-flex align-items-center justify-content-center bg-dark text-white empty-state">
          <div class="text-center px-4">
            <div class="empty-state-icon mb-4">
              <Image :size="64" color="rgba(255,255,255,0.6)" class="mb-2" />
              <div class="empty-state-pulse"></div>
            </div>
            <h3 class="ds-text-primary mb-3">Ready to Scan</h3>
            <p class="ds-text-secondary mb-4 max-width-300">
              Import an image from your gallery or take a photo to get started with document scanning.
            </p>
            <div class="d-flex flex-column gap-3 align-items-center">
              <button @click="emit('import-pages')" class="btn btn-primary btn-cta d-flex align-items-center gap-2">
                <Image :size="20" />
                <span>Import from Gallery</span>
              </button>
              <button @click="emit('add-pages')" class="btn btn-outline-light btn-cta d-flex align-items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Take Photo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls toolbar - compact design -->
      <ScannerToolbar :current-display-page="currentDisplayPage" :is-in-edit-mode="isInEditMode"
        :is-in-preview-mode="isInPreviewMode" @rotate-left="emit('rotate-left')" @rotate-right="emit('rotate-right')"
        @reset-corners="emit('reset-corners')" @crop="handleDoneClick" @switch-to-edit="emit('switch-to-edit')"
        @delete-page="emit('delete-page')" />

      <!-- Thumbnail Strip -->
      <ThumbnailStrip :pages="pages" :active-page-id="activePageId" :page-count-display="pageCountDisplay"
        @page-click="emit('page-click', $event)" @add-pages="emit('add-pages')" @create-pdf="emit('create-pdf')"
        @reorder-pages="handleReorderPages" />
    </div>
  </Teleport>
</template>

<style scoped>
/* Typography System Integration */
.fullscreen-overlay {
  /* Font Family Stack - Optimized for UI readability */
  --ds-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;

  /* Font Weights */
  --ds-font-weight-normal: 400;
  --ds-font-weight-medium: 500;
  --ds-font-weight-semibold: 600;
  --ds-font-weight-bold: 700;

  /* Font Sizes - Mobile First */
  --ds-font-size-xs: 0.75rem;
  /* 12px */
  --ds-font-size-sm: 0.875rem;
  /* 14px */
  --ds-font-size-base: 1rem;
  /* 16px */
  --ds-font-size-lg: 1.125rem;
  /* 18px */

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

/* Typography Classes */
.ds-text-secondary {
  font-size: var(--ds-font-size-base);
  font-weight: var(--ds-font-weight-normal);
  line-height: var(--ds-line-height-normal);
  font-family: var(--ds-font-family);
  opacity: 0.8;
}

/* Full-screen overlay styles */
.fullscreen-overlay {
  background-color: #000 !important;
  z-index: 9999;
  animation: fadeIn 0.3s ease-in-out;
  overflow: hidden;
  /* Prevent scrolling */
}

/* Responsive Typography */
@media (min-width: 768px) {
  .fullscreen-overlay {
    --ds-font-size-base: 1.125rem;
    /* Slightly larger on tablet+ */
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .fullscreen-overlay {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* Enhanced Empty State Styling */
.empty-state {
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.02) 0%, transparent 70%);
}

.empty-state-icon {
  position: relative;
  display: inline-block;
}

.empty-state-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: pulse 2s infinite;
}

.empty-state-pulse::before {
  content: '';
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  animation: pulse 2s infinite 0.5s;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }

  100% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0;
  }
}

.max-width-300 {
  max-width: 300px;
  margin: 0 auto;
}

.btn-cta {
  min-width: 180px;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

/* Mobile optimizations for empty state */
@media (max-width: 576px) {
  .empty-state h3 {
    font-size: 1.25rem;
  }

  .empty-state p {
    font-size: 0.9rem;
  }

  .btn-cta {
    min-width: 180px;
    padding: 10px 20px;
  }
}

/* Page Size Container Styling */
.page-size-container {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

/* Responsive adjustments for page size selector */
@media (max-width: 576px) {
  .page-size-container {
    padding: 8px 12px !important;
  }
}
</style>