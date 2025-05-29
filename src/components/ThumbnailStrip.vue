<template>
  
  <div class="thumbnail-strip px-3 py-2 bg-dark" style="z-index: 1000; min-height: 100px; flex-shrink: 0;">

    <div 
      ref="containerRef"
      class="thumbnail-container d-flex align-items-center"
      @mouseleave="handleContainerMouseLeave"
    >
      <!-- Pages with real-time reordering -->
      <div
        v-for="(page, index) in reorderedPages" 
        :key="page.id" 
        class="page-container"
      >
        <div
          class="thumbnail-wrapper"
          :style="getPageStyle(index, page.id)"
        >
          <div 
        class="position-relative d-flex flex-column align-items-center cursor-pointer thumbnail-item"
            :class="{ 
              'dragging': dragState.isDragging && originalDraggedId === page.id,
              'drag-ghost': dragState.isDragging && originalDraggedId === page.id 
            }"
        data-testid="page-thumbnail"
            draggable="true"
            @click="handleClick(page.id, index)"
            @mousedown="handleMouseDown($event, index, page.id)"
            @touchstart="handleTouchStart($event, index, page.id)"
            @dragstart.prevent
            :title="`Page ${getOriginalIndex(page.id) + 1}${page.processedImageDataURL ? ' (Processed)' : ' (Original)'} - Drag to reorder`"
      >
        <img 
              v-if="page.processedImageDataURL || page.originalImageDataURL"
          :src="page.processedImageDataURL || page.originalImageDataURL"
          :class="[
            'thumbnail-img border rounded', 
            page.id === activePageId ? 'border-primary' : 'border-secondary', 
            page.processedImageDataURL ? 'processed' : 'original'
          ]" 
              :alt="`Page ${getOriginalIndex(page.id) + 1}`"
              @error="handleImageError($event, getOriginalIndex(page.id))"
            />
            <div v-else class="thumbnail-placeholder d-flex align-items-center justify-content-center">
              <span class="text-white-50">{{ getOriginalIndex(page.id) + 1 }}</span>
            </div>
            <small class="text-white-50 mt-1 ds-text-caption">{{ getOriginalIndex(page.id) + 1 }}</small>
          </div>
        </div>
      </div>

      <!-- Add Page Button -->
      <button 
        @click="handleAddPages"
        class="btn btn-outline-light d-flex align-items-center justify-content-center rounded thumbnail-item ml-3"
        style="width: 70px; height: 80px; min-width: 70px; flex-shrink: 0;" 
        title="Take photo with camera"
      >
        <CameraPlus :size="38" color="white" />
      </button>

      <!-- Save as PDF Button -->
      <button 
        v-if="showPdfButton"
        @click="handleCreatePdf"
        class="btn btn-success d-flex flex-column align-items-center justify-content-around rounded px-1 thumbnail-item ml-2"
        style="height: 80px; min-width: 75px; flex-shrink: 0;"
        title="Save all processed pages as PDF"
      >
        <FileText :size="32" color="white" class="mb-1" />
        <div class="ds-button-text">Save</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted, type DeepReadonly, watchEffect } from 'vue'
import type { Page } from '../types'
import { FileText } from 'lucide-vue-next'
import CameraPlus from './icons/camera_plus.vue'

// Props
interface Props {
  pages: DeepReadonly<Page[]>
  activePageId: string | null
  pageCountDisplay: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  pageClick: [pageId: string]
  addPages: []
  createPdf: []
  reorderPages: [fromIndex: number, toIndex: number]
}>()

// Refs
const containerRef = ref<HTMLElement>()

// Drag state
interface DragState {
  isDragging: boolean
  draggedIndex: number | null
  draggedId: string | null
  hoverIndex: number | null
  hoverSide: 'left' | 'right' | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  isTouch: boolean
}

const dragState = reactive<DragState>({
  isDragging: false,
  draggedIndex: null,
  draggedId: null,
  hoverIndex: null,
  hoverSide: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  isTouch: false
})

// Auto-scroll state
let autoScrollRAF: number | null = null
let longPressTimer: number | null = null

// Track original dragged page ID for visual feedback
const originalDraggedId = ref<string | null>(null)

// Create a reactive copy of pages for real-time reordering
const reorderedPages = ref<DeepReadonly<Page>[]>([])

// Watch for page changes and update reordered pages
watchEffect(() => {
  if (!dragState.isDragging) {
    // When not dragging, keep in sync with props
    reorderedPages.value = [...props.pages] as DeepReadonly<Page>[]
  }
})

// Get original index of a page by ID
const getOriginalIndex = (pageId: string): number => {
  return props.pages.findIndex(p => p.id === pageId)
}

// Computed
const showPdfButton = computed(() => {
  return props.pages.length > 0 && props.pages.some(p => p.processedImageDataURL)
})

// Calculate where to insert based on hover position
const insertPosition = computed(() => {
  if (!dragState.isDragging || dragState.hoverIndex === null || dragState.draggedId === null) {
    return null
  }
  
  let position = dragState.hoverIndex
  
  if (dragState.hoverSide === 'right') {
    position++
  }
  
  // Get current index of dragged page in reordered array
  const currentDraggedIndex = reorderedPages.value.findIndex(p => p.id === dragState.draggedId)
  
  // Don't show insert position if it's the same as current position
  if (position === currentDraggedIndex || position === currentDraggedIndex + 1) {
    return null
  }
  
  return position
})

// Page styling with dynamic transforms
const getPageStyle = (index: number, pageId: string) => {
  const styles: any = {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
  
  // Make the dragged item semi-transparent
  if (dragState.isDragging && originalDraggedId.value === pageId) {
    styles.opacity = '0.7'
    styles.transform = 'scale(1.05)'
    styles.zIndex = 1000
  }
  
  return styles
}

// Mouse/Touch unified handlers
const handleClick = (pageId: string, index: number) => {
  // Only handle click if we didn't drag
  if (!dragState.isDragging) {
  emit('pageClick', pageId)
}
}

const handleMouseDown = (event: MouseEvent, index: number, pageId: string) => {
  if (event.button !== 0) return // Only left click
  
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.draggedIndex = index
  dragState.draggedId = pageId
  dragState.isTouch = false
  originalDraggedId.value = pageId // Track original for visual feedback
  
  // Add global mouse handlers
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
  
  event.preventDefault()
}

const handleTouchStart = (event: TouchEvent, index: number, pageId: string) => {
  const touch = event.touches[0]
  dragState.startX = touch.clientX
  dragState.startY = touch.clientY
  dragState.draggedIndex = index
  dragState.draggedId = pageId
  dragState.isTouch = true
  originalDraggedId.value = pageId // Track original for visual feedback
  
  // Store the target element for later use
  const targetElement = event.currentTarget as HTMLElement
  
  // Prevent context menu on this element
  const preventContextMenu = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    return false
  }
  
  // Add context menu prevention
  targetElement.addEventListener('contextmenu', preventContextMenu)
  
  // Add immediate visual feedback
  targetElement.classList.add('touch-active')
  
  // Flag to track if we've moved too much
  let hasMoved = false
  
  // Long press for mobile
  longPressTimer = window.setTimeout(() => {
    if (!hasMoved) {
      dragState.isDragging = true
      startAutoScroll()
      
      // Remove touch-active and add dragging
      targetElement.classList.remove('touch-active')
      targetElement.classList.add('dragging')
      
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      
      // Now prevent scrolling since we're in drag mode
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      
      // Prevent any further scrolling on the container
      if (containerRef.value) {
        containerRef.value.style.overflow = 'hidden'
      }
    }
  }, 400) // Reduced from 500ms for better responsiveness
  
  // Track movement to cancel long press if needed
  const checkMovement = (e: TouchEvent) => {
    if (!longPressTimer) return
    
    const moveTouch = e.touches[0]
    const deltaX = Math.abs(moveTouch.clientX - dragState.startX)
    const deltaY = Math.abs(moveTouch.clientY - dragState.startY)
    
    if (deltaX > 10 || deltaY > 10) {
      hasMoved = true
      targetElement.classList.remove('touch-active')
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
      document.removeEventListener('touchmove', checkMovement)
    }
  }
  
  // Add temporary move listener to detect early movement
  document.addEventListener('touchmove', checkMovement, { passive: true })
  
  // Add global touch handlers
  document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
  document.addEventListener('touchend', handleGlobalTouchEnd)
  
  // Clean up on end
  const cleanupTouch = () => {
    targetElement.classList.remove('touch-active')
    targetElement.removeEventListener('contextmenu', preventContextMenu)
    document.removeEventListener('touchmove', checkMovement)
  }
  
  document.addEventListener('touchend', cleanupTouch, { once: true })
  document.addEventListener('touchcancel', cleanupTouch, { once: true })
}

const handleGlobalMouseMove = (event: MouseEvent) => {
  const deltaX = Math.abs(event.clientX - dragState.startX)
  const deltaY = Math.abs(event.clientY - dragState.startY)
  
  // Start dragging after threshold
  if (!dragState.isDragging && (deltaX > 5 || deltaY > 5)) {
    dragState.isDragging = true
    startAutoScroll()
  }
  
  if (dragState.isDragging) {
    dragState.currentX = event.clientX
    dragState.currentY = event.clientY
    updateHoverPosition(event.clientX, event.clientY)
  }
}

const handleGlobalTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0]
  
  if (dragState.isDragging) {
    // Only prevent default when actually dragging
    event.preventDefault()
    event.stopPropagation()
    
    dragState.currentX = touch.clientX
    dragState.currentY = touch.clientY
    updateHoverPosition(touch.clientX, touch.clientY)
  }
}

const handleGlobalMouseUp = () => {
  handleDrop()
  cleanup()
}

const handleGlobalTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  handleDrop()
  cleanup()
}

const handleContainerMouseLeave = () => {
  if (dragState.isDragging && !dragState.isTouch) {
    dragState.hoverIndex = null
    dragState.hoverSide = null
  }
}

// Update hover position and perform real-time reordering
const updateHoverPosition = (x: number, y: number) => {
  if (!containerRef.value || !dragState.draggedId) return
  
  const container = containerRef.value
  const rect = container.getBoundingClientRect()
  
  // Find which page we're hovering over
  const thumbnails = container.querySelectorAll('.thumbnail-wrapper')
  
  let newHoverIndex: number | null = null
  let newHoverSide: 'left' | 'right' | null = null
  
  for (let i = 0; i < thumbnails.length; i++) {
    const thumbRect = thumbnails[i].getBoundingClientRect()
    
    if (x >= thumbRect.left && x <= thumbRect.right) {
      newHoverIndex = i
      
      // Determine which side
      const thumbCenter = thumbRect.left + thumbRect.width / 2
      newHoverSide = x < thumbCenter ? 'left' : 'right'
      break
    }
  }
  
  // Only update if hover position changed
  if (newHoverIndex !== dragState.hoverIndex || newHoverSide !== dragState.hoverSide) {
    dragState.hoverIndex = newHoverIndex
    dragState.hoverSide = newHoverSide
    
    // Perform real-time reordering
    if (insertPosition.value !== null && dragState.draggedId) {
      const fromIndex = reorderedPages.value.findIndex(p => p.id === dragState.draggedId)
      const toIndex = insertPosition.value
      
      if (fromIndex !== -1 && fromIndex !== toIndex) {
        // Create a new array with the page moved
        const newPages = [...reorderedPages.value]
        const [movedPage] = newPages.splice(fromIndex, 1)
        
        // Insert at new position
        const adjustedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex
        newPages.splice(adjustedIndex, 0, movedPage)
        
        reorderedPages.value = newPages
      }
    }
  }
}

// Handle drop - commit the final order
const handleDrop = () => {
  if (dragState.isDragging && dragState.draggedId) {
    // Find the final positions in the reordered array
    const originalIndex = props.pages.findIndex(p => p.id === dragState.draggedId)
    const newIndex = reorderedPages.value.findIndex(p => p.id === dragState.draggedId)
    
    if (originalIndex !== -1 && newIndex !== -1 && originalIndex !== newIndex) {
      // Emit the final reorder event with original indices
      emit('reorderPages', originalIndex, newIndex)
    }
  }
}

// Auto-scroll functionality
const startAutoScroll = () => {
  const checkScroll = () => {
    if (!containerRef.value || !dragState.isDragging) return
    
    const container = containerRef.value
    const rect = container.getBoundingClientRect()
    const scrollSpeed = 5
    const edgeThreshold = 50
    
    if (dragState.currentX < rect.left + edgeThreshold) {
      container.scrollLeft -= scrollSpeed
    } else if (dragState.currentX > rect.right - edgeThreshold) {
      container.scrollLeft += scrollSpeed
    }
    
    if (dragState.isDragging) {
      autoScrollRAF = requestAnimationFrame(checkScroll)
    }
  }
  
  checkScroll()
}

// Cleanup
const cleanup = () => {
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
  document.removeEventListener('touchmove', handleGlobalTouchMove)
  document.removeEventListener('touchend', handleGlobalTouchEnd)
  
  // Restore body scrolling
  document.body.style.overflow = ''
  document.body.style.touchAction = ''
  
  // Restore container scrolling
  if (containerRef.value) {
    containerRef.value.style.overflow = ''
  }
  
  // Remove any dragging classes
  const draggingElements = document.querySelectorAll('.thumbnail-item.dragging')
  draggingElements.forEach(el => el.classList.remove('dragging'))
  
  if (autoScrollRAF) {
    cancelAnimationFrame(autoScrollRAF)
    autoScrollRAF = null
  }
  
  resetDragState()
}

// Update reset function
const resetDragState = () => {
  dragState.isDragging = false
  dragState.draggedIndex = null
  dragState.draggedId = null
  dragState.hoverIndex = null
  dragState.hoverSide = null
  originalDraggedId.value = null
}

// Event handlers
const handleAddPages = () => {
  emit('addPages')
}

const handleCreatePdf = () => {
  emit('createPdf')
}

const handleImageError = (event: Event, index: number) => {
  console.error(`[ThumbnailStrip] Image failed to load for page ${index + 1}`, {
    page: props.pages[index],
    src: (event.target as HTMLImageElement).src
  })
}

// Cleanup on unmount
onUnmounted(() => {
  cleanup()
})

// Debug on mount and when pages change
onMounted(() => {
  console.log('[ThumbnailStrip] Mounted with pages:', props.pages.length)
  
  // Prevent context menu on the entire thumbnail strip
  if (containerRef.value) {
    containerRef.value.addEventListener('contextmenu', (e) => {
      // Only prevent if it's on a thumbnail
      const target = e.target as HTMLElement
      if (target.closest('.thumbnail-item')) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    })
  }
})



</script>

<style scoped>
/* Typography System Integration */
.thumbnail-strip {
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

/* Typography Classes */
.ds-text-caption {
  font-size: var(--ds-font-size-xs);
  font-weight: var(--ds-font-weight-normal);
  line-height: var(--ds-line-height-normal);
  font-family: var(--ds-font-family);
}

.ds-button-text {
  font-size: var(--ds-font-size-xs);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  letter-spacing: var(--ds-letter-spacing-wide);
  font-family: var(--ds-font-family);
}

/* Thumbnail strip styling */
.thumbnail-strip {
  backdrop-filter: blur(10px);
  background-color: rgba(0, 0, 0, 0.9) !important;
}

/* Thumbnail container - horizontal scrolling */
.thumbnail-container {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch; /* iOS smooth scrolling */
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent; /* Firefox */
  padding: 0 10px; /* Add padding for better touch area */
  margin: 0 -10px; /* Compensate for padding */
  touch-action: pan-x; /* Allow horizontal scrolling */
  white-space: nowrap; /* Prevent wrapping */
}

/* Webkit scrollbar styling */
.thumbnail-container::-webkit-scrollbar {
  height: 6px;
}

.thumbnail-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.thumbnail-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.thumbnail-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Thumbnail wrapper - handles transforms */
.thumbnail-wrapper {
  display: inline-flex;
  vertical-align: top;
  margin-right: 4px;
  flex-shrink: 0;
  width: auto;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Thumbnail items */
.thumbnail-item {
  flex-shrink: 0;
  min-width: 44px; /* Minimum touch target */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none !important; /* Disable iOS callout - important to override */
  -webkit-tap-highlight-color: transparent; /* Remove tap highlight */
  transition: opacity 0.2s ease, transform 0.2s ease;
  /* Prevent context menu on mobile */
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

/* Additional prevention for images */
.thumbnail-img {
  width: 60px;
  height: 80px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  pointer-events: none; /* Disable pointer events on image */
}

/* Re-enable pointer events on the wrapper */
.thumbnail-item {
  pointer-events: auto;
}

.thumbnail-img.border-primary {
  border-width: 3px !important;
  box-shadow: 0 0 12px rgba(0, 123, 255, 0.7);
}

.thumbnail-img:hover:not(.dragging) {
  transform: scale(1.05);
}

/* Dragging state */
.thumbnail-item.dragging {
  opacity: 0.7 !important;
  transform: scale(1.05) rotate(2deg) !important;
  z-index: 1000 !important;
  cursor: grabbing !important;
}

.thumbnail-item.dragging .thumbnail-img {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

/* Drag source (original position) */
.thumbnail-item.drag-ghost:not(.dragging) {
  opacity: 0.3;
}

/* Placeholder wrapper - in flow */
.placeholder-page-wrapper {
  display: inline-flex;
  vertical-align: top;
  margin-right: 4px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  width: 74px; /* 70px placeholder + 4px margin */
  opacity: 1;
}

/* Placeholder page styles */
.placeholder-page {
  width: 70px;
  height: 90px;
  border: 2px dashed #007bff;
  border-radius: 8px;
  background: rgba(0, 123, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: placeholderPulse 1.5s ease-in-out infinite alternate;
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: 0.8;
  pointer-events: none;
}

.placeholder-icon {
  font-size: 24px;
  margin-bottom: 4px;
  filter: grayscale(1) brightness(0.8);
}

.placeholder-text {
  font-size: 10px;
  color: #007bff;
  font-weight: 600;
  font-family: var(--ds-font-family);
}

@keyframes placeholderPulse {
  0% {
    background: rgba(0, 123, 255, 0.1);
    border-color: rgba(0, 123, 255, 0.5);
  }
  100% {
    background: rgba(0, 123, 255, 0.2);
    border-color: rgba(0, 123, 255, 0.8);
  }
}

/* Cursor states */
.thumbnail-item {
  cursor: pointer;
}

.thumbnail-item:active {
  cursor: grabbing;
}

/* Action button styling */
.thumbnail-strip .btn {
  min-height: 44px;
  font-weight: 500;
  font-family: var(--ds-font-family);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Responsive Typography */
@media (min-width: 768px) {
  .thumbnail-strip {
    --ds-font-size-xs: 0.8rem;   /* Slightly larger on tablet+ */
    --ds-font-size-sm: 0.9rem;
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .thumbnail-strip {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}

/* Focus states for buttons */
.thumbnail-strip .btn-outline-light:focus,
.thumbnail-strip .btn-outline-light:active {
  color: #fff !important;
  background-color: rgba(255, 255, 255, 0.15);
  border-color: #fff;
  box-shadow: 0 0 0 0.2rem rgba(255, 255, 255, 0.25);
}

.thumbnail-strip .btn-success:focus,
.thumbnail-strip .btn-success:active {
  color: #fff !important;
  background-color: #198754;
  border-color: #198754;
  box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25);
}

.thumbnail-strip .btn-outline-light:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.02);
}

.thumbnail-strip .btn-success:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

/* Long press visual feedback for mobile */
@media (hover: none) and (pointer: coarse) {
  .thumbnail-item:active {
    animation: longPressHint 0.5s ease-out;
  }
  
  /* Immediate feedback when touched */
  .thumbnail-item.touch-active {
    transform: scale(0.95);
    opacity: 0.9;
    transition: all 0.1s ease;
  }
  
  /* Long press indicator */
  .thumbnail-item.touch-active::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(0, 123, 255, 0.2);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: longPressRipple 0.4s ease-out;
  }
}

@keyframes longPressHint {
  0% { transform: scale(1); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

@keyframes longPressRipple {
  0% {
    width: 0;
    height: 0;
    opacity: 1;
  }
  100% {
    width: 100px;
    height: 100px;
    opacity: 0;
  }
}

/* Remove any opacity that might hide pages except when dragging */
.thumbnail-wrapper:not(.drag-ghost) {
  opacity: 1 !important;
}

/* Page container - wrapper for pages */
.page-container {
  display: inline-flex;
  vertical-align: top;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style> 