<script setup lang="ts">

import { ref, onUnmounted, onMounted, computed, nextTick, watch, toRef } from 'vue';
import { useImageProcessing } from './composables/useImageProcessing';
import { usePageManager } from './composables/usePageManager';
import { useDocumentProcessing } from './composables/useDocumentProcessing';
import { useImageOperations } from './composables/useImageOperations';
import { useKeyboardNavigation } from './composables/useKeyboardNavigation';
import { useCornerValidation } from './composables/useCornerValidation';
import type { Corners, PaperFormat } from './types';
import LoadingSpinner from './components/LoadingSpinner.vue';
import ScannerTriggerButton from './components/ScannerTriggerButton.vue';
import FullscreenScanner from './components/FullscreenScanner.vue';
import { useOpenCV } from '@jhlee111/vue-opencv-composable';
import { useFileInput } from './composables/useFileInput';
import { usePdfGeneration } from './composables/usePdfGeneration';
import { useLogger } from './composables/useLogger';

const logger = useLogger('DocumentScanner');

// --- Props ---
interface Props {
    buttonSize?: 'sm' | 'md' | 'lg';
    closeAfterPdfCreated?: boolean;
    label?: string;
    openCvUrl?: string;
}
const props = withDefaults(defineProps<Props>(), {
    buttonSize: 'lg', // Default size
    closeAfterPdfCreated: false, // Default behavior is to stay open
    label: 'Scan Document', // Default label
    openCvUrl: undefined, // Default to undefined to use latest stable version
});

// --- Composables ---
const pageManager = usePageManager();
const { isReady: isOpenCVReady, error: openCvError, loadOpenCV, getCurrentUrl } = useOpenCV({
    url: props.openCvUrl
});

// Convert readonly ref to regular ref for compatibility
const isOpenCVReadyRef = toRef(() => isOpenCVReady.value);

const {
    performPerspectiveTransform,
    rotateImageData,
    transformCornersForRotationIncrement
} = useImageProcessing(isOpenCVReadyRef);

// Initialize document processing composable
const { 
    isLoading, 
    processingStatus, 
    processingProgress, 
    handleFilesSelected 
} = useDocumentProcessing({
    pageManager: {
        pages: pageManager.pages,
        addFileAsPageWithProgress: pageManager.addFileAsPageWithProgress,
        selectPage: pageManager.selectPage
    }
});

// File input refs for different use cases
const cameraInputRef = ref<HTMLInputElement | null>(null);
const galleryInputRef = ref<HTMLInputElement | null>(null);

// Initialize file input composable
const fileInput = useFileInput({
    onFilesSelected: handleFilesSelected,
    isOpenCVReady: () => isOpenCVReady.value,
    cameraInputRef: cameraInputRef,
    galleryInputRef: galleryInputRef
});


// Initialize image operations composable
const imageOperations = useImageOperations({
    pageManager: {
        pages: pageManager.pages,
        currentPage: pageManager.currentPage,
        updatePageData: pageManager.updatePageData,
        getPageById: pageManager.getPageById
    },
    isOpenCVReady: isOpenCVReadyRef,
    performPerspectiveTransform,
    rotateImageData,
    transformCornersForRotationIncrement
});

// Initialize corner validation composable
useCornerValidation({
    currentDisplayPage: imageOperations.currentDisplayPage,
    pageManager: {
        currentPage: pageManager.currentPage,
        updatePageData: pageManager.updatePageData
    }
});

// --- Emits ---
/**
 * @emits pdf-created - Fired when a PDF has been generated.
 * @property {Blob} pdfBlob - The generated PDF as a Blob.
 */
const emit = defineEmits<{
    (e: 'pdf-created', pdfBlob: Blob): void;
}>();

// --- Refs ---
const fullscreenScannerRef = ref<InstanceType<typeof FullscreenScanner> | null>(null);
const showFullscreenScanner = ref(false);

// --- Computed Properties from pageManager ---
const currentDisplayPage = imageOperations.currentDisplayPage;

const imageSrcForPreviewComponent = imageOperations.imageSrcForPreviewComponent;

// Computed properties for processing status display
const displayProcessingStatus = computed(() => {
    // Priority order: waiting for input -> document processing -> image operations

    if (isLoading.value && processingStatus.value) {
        return processingStatus.value
    }
    if (imageOperations.processingStatus.value) {
        return imageOperations.processingStatus.value
    }
    return ''
})

const displayProcessingProgress = computed(() => {
    // Priority order: waiting for input -> document processing -> image operations

    if (isLoading.value && processingProgress.value > 0) {
        return processingProgress.value
    }
    if (imageOperations.processingProgress.value > 0) {
        return imageOperations.processingProgress.value
    }
    return 0
})

const isInEditMode = computed(() => {
    return currentDisplayPage.value?.mode === 'edit';
});

const isInPreviewMode = computed(() => {
    return currentDisplayPage.value?.mode === 'preview';
});

// --- Lifecycle Hooks ---
onMounted(() => {
    loadOpenCV();
});

onUnmounted(() => {
    pageManager.clearAllPages(); // Clears pages and revokes URLs
    // Clear any lingering processing status from image operations
    imageOperations.processingStatus.value = '';
    imageOperations.processingProgress.value = 0;
    imageOperations.isLoading.value = false;
});

// --- Watchers ---
// Close fullscreen scanner when no pages exist
watch(pageManager.pages, (newPages) => {
    if (newPages.length === 0) {
        showFullscreenScanner.value = false;
    }
}, { immediate: true });

// --- Methods ---
const processActivePage = imageOperations.processActivePage;

const handleDoneClick = async () => { // "Crop" button
    console.log('[DS] Crop button clicked.');
    if (fullscreenScannerRef.value?.imagePreviewRef && typeof fullscreenScannerRef.value.imagePreviewRef.processCorners === 'function') {
        // This should ensure ImagePreview emits 'corners-adjusted' one last time
        // with its most up-to-date internal corners.
        fullscreenScannerRef.value.imagePreviewRef.processCorners();
    }
    // Give a tick for the update from 'corners-adjusted' -> handleCornersAdjusted -> pageManager
    // to propagate and for currentDisplayPage.value.adjustedCorners to be the latest.
    await nextTick();

    if (currentDisplayPage.value && currentDisplayPage.value.corners) {
        console.log('[DS] handleDoneClick: Calling processActivePage.');
        
        // Ensure the page has a format set, use default if not
        let formatToUse = currentDisplayPage.value.outputFormat;
        if (!formatToUse) {
            formatToUse = {
                name: 'Letter Portrait',
                ratio: 8.5 / 11,
                dimensions: '8.5" × 11"',
                category: 'standard' as const
            };
            pageManager.updatePageData(currentDisplayPage.value.id, { 
                outputFormat: formatToUse 
            });
            console.log('[DS] Applied default format to page:', formatToUse);
        }
        
        // Process with the specific format
        await imageOperations.processActivePage(formatToUse);
    } else {
        console.error("[DS] Crop clicked, but no current page or corners available.");
    }
};

const loadPageForThumbnailClick = (pageId: string) => {
    console.log(`[DS] Thumbnail clicked for page ${pageId}. Selecting it.`);
    pageManager.selectPage(pageId);
};

const deleteCurrentPage = async () => {
    const pageValue = currentDisplayPage.value;
    if (pageValue) {
        // Clear rotation cache for this page before deleting
        imageOperations.clearPageCache(pageValue.id);
        pageManager.deletePage(pageValue.id);
        console.log('Page deleted');
    }
};

const resetCornersForCurrentPageHandler = imageOperations.resetCornersForCurrentPage;

const rotateCurrentPageHandler = imageOperations.rotateCurrentPage;

const closeScanner = () => {
    // Clear all rotation cache before clearing pages
    imageOperations.clearAllCache();
    pageManager.clearAllPages(); // This will trigger the watcher and set showFullscreenScanner to false
    // The watcher will automatically set showFullscreenScanner.value = false when pages are cleared
    // Clear any lingering processing status from image operations
    imageOperations.processingStatus.value = '';
    imageOperations.processingProgress.value = 0;
    imageOperations.isLoading.value = false;
    // Clear waiting state
};

const discardProcessedImage = () => {
    const pageValue = currentDisplayPage.value;
    if (pageValue && pageValue.id) {
        pageManager.updatePageData(pageValue.id, {
            processedImageDataURL: null,
            processedWidth: null,
            processedHeight: null,
            mode: 'edit'
        });
    }
};

// Initialize PDF generation composable
const pdfGeneration = usePdfGeneration({
    pageManager: {
        pages: pageManager.pages,
        getPageById: pageManager.getPageById
    },
    imageOperations: {
        isLoading: imageOperations.isLoading,
        applyPerspectiveTransformAndGetDataURL: imageOperations.applyPerspectiveTransformAndGetDataURL
    },
    closeAfterPdfCreated: props.closeAfterPdfCreated,
    onPdfCreated: (pdfBlob: Blob) => emit('pdf-created', pdfBlob),
    onCloseScanner: closeScanner
});

// Initialize keyboard navigation with VueUse
useKeyboardNavigation({
    showFullscreenScanner,
    isProcessingPdf: pdfGeneration.isProcessingPdf,
    currentDisplayPage,
    pageManager: {
        currentPage: pageManager.currentPage,
        pages: pageManager.pages,
        selectPage: pageManager.selectPage
    },
    onCloseScanner: closeScanner,
    onDiscardProcessedImage: discardProcessedImage
});

const handleOpenScannerBtnClick = () => {
    showFullscreenScanner.value = true; 
    
};

const handleAddPages = () => {
    // Use camera input for adding pages (one at a time)
    fileInput.triggerCameraInput();
};

const handleImportPages = () => {
    // Use gallery input for importing multiple pages
    fileInput.triggerGalleryInput();
};

const switchToEditMode = () => {
    if (currentDisplayPage.value) {
        console.log(`[DS] Switching page ${currentDisplayPage.value.id} to edit mode`);
        pageManager.updatePageData(currentDisplayPage.value.id, { mode: 'edit' });
    }
};

const handleCornersUpdate = (newCorners: Corners | null) => {
    const currentPageValue = pageManager.currentPage.value;
    if (currentPageValue && newCorners) {
        console.log("[DS.vue] Handling corners update from ImagePreview (new corners):", newCorners);
        pageManager.updatePageData(currentPageValue.id, { corners: newCorners });
    }
};

const handleFormatChange = async (format: PaperFormat) => {
    const currentPageValue = pageManager.currentPage.value;
    if (currentPageValue && currentPageValue.corners) {
        console.log("[DS.vue] Handling format change for page:", currentPageValue.id, "New format:", format);
        
        // Always update page with the format (even if it's the same)
        pageManager.updatePageData(currentPageValue.id, { 
            outputFormat: format 
        });
        
        console.log("[DS.vue] Processing image with format:", format);
        
        // Always re-process the image with the format to ensure consistency
        await imageOperations.processActivePage(format);
        
        // Log the result
        const updatedPage = pageManager.getPageById(currentPageValue.id);
        console.log("[DS.vue] Page after format change and processing:", {
            id: updatedPage?.id,
            mode: updatedPage?.mode,
            processedWidth: updatedPage?.processedWidth,
            processedHeight: updatedPage?.processedHeight,
            outputFormat: updatedPage?.outputFormat,
            expectedRatio: format.ratio,
            actualRatio: updatedPage?.processedWidth && updatedPage?.processedHeight ? 
                updatedPage.processedWidth / updatedPage.processedHeight : 'N/A'
        });
    }
};

const applyPerspectiveTransformAndGetDataURL = imageOperations.applyPerspectiveTransformAndGetDataURL;

const createPdfFromAllPages = pdfGeneration.createPdfFromAllPages;

const handleReorderPages = (fromIndex: number, toIndex: number) => {
  pageManager.reorderPages(fromIndex, toIndex);
};

// File input helper methods
const handleCameraInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        // Filter to only image files for camera input
        const imageFiles = Array.from(target.files).filter(file => 
            file.type.startsWith('image/')
        );
        if (imageFiles.length > 0) {
            fileInput.handleFilesSelected(imageFiles);
        } else {
            console.warn('[DS] No valid image files selected from camera');
        }
    } else {
        console.warn('[DS] No files selected from camera');
    }
    target.value = ''; // Reset input
};

const handleGalleryInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        // Filter to only image files for gallery input
        const imageFiles = Array.from(target.files).filter(file => 
            file.type.startsWith('image/')
        );
        if (imageFiles.length > 0) {
            fileInput.handleFilesSelected(imageFiles);
        } else {
            console.warn('[DS] No valid image files selected from gallery');

        }
    } else {
        console.warn('[DS] No files selected from gallery');
    }
    target.value = ''; // Reset input
};


</script>
<template>    
    <!-- Camera input for mobile camera capture -->
    <input type="file" ref="cameraInputRef"
     @change="handleCameraInputChange"
     accept="image/*"
     capture="environment"
     class="d-none" />
    
    <!-- Gallery input for file selection -->
    <input type="file" ref="galleryInputRef"
     @change="handleGalleryInputChange" multiple
     accept="image/*"
     class="d-none" />

    <!-- Full-Screen Scanner -->
    <FullscreenScanner
        v-if="showFullscreenScanner"
        ref="fullscreenScannerRef"
        :current-display-page="currentDisplayPage"
        :image-src-for-preview-component="imageSrcForPreviewComponent || null"
        :is-in-edit-mode="isInEditMode"
        :is-in-preview-mode="isInPreviewMode"
        :processing-status="displayProcessingStatus"
        :processing-progress="displayProcessingProgress"
        :pages="pageManager.pages.value"
        :active-page-id="pageManager.activePageId.value"
        :page-count-display="pageManager.pageCountDisplay.value"
        :pageManager="pageManager"
        @close="closeScanner"
        @corners-update="handleCornersUpdate"
        @rotate-left="rotateCurrentPageHandler('left')"
        @rotate-right="rotateCurrentPageHandler('right')"
        @reset-corners="resetCornersForCurrentPageHandler"
        @crop="handleDoneClick"
        @switch-to-edit="switchToEditMode"
        @delete-page="deleteCurrentPage"
        @page-click="loadPageForThumbnailClick"
        @add-pages="handleAddPages"
        @import-pages="handleImportPages"
        @create-pdf="createPdfFromAllPages"
        @format-change="handleFormatChange"
        @reorder-pages="handleReorderPages"
    />

    <!-- Initial Interface (when scanner not active and OpenCV is ready) -->
    <ScannerTriggerButton
        v-else-if="isOpenCVReady && !openCvError && !pdfGeneration.isProcessingPdf.value"
        :button-size="props.buttonSize"
        :label="props.label"
        :is-loading="isLoading"
        :processing-status="processingStatus"
        @click="handleOpenScannerBtnClick"
    />
    <!-- OpenCV Loading/Error State -->
    <div v-else class="document-scanner p-3 bg-light min-vh-100">
        <div v-if="openCvError" class="mt-5 text-center text-danger">
            <p class="ds-error-message">Error loading OpenCV.js: {{ openCvError }}</p>
            <p class="ds-text-secondary">Please refresh the page or check your internet connection.</p>
        </div>
        <div v-if="!isOpenCVReady" class="d-flex flex-column align-items-center justify-content-center min-vh-100">
            <LoadingSpinner message="Loading Scanner..." />
            <p class="ds-loading-message mt-2">Please wait for libraries to load.</p>
        </div>
    </div>
</template>

<style scoped>
/* Typography System with CSS Custom Properties */
.document-scanner {
  /* Font Family Stack - Optimized for UI readability */
  --ds-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  --ds-font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  
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
  --ds-font-size-2xl: 1.5rem;    /* 24px */
  
  /* Line Heights */
  --ds-line-height-tight: 1.25;
  --ds-line-height-normal: 1.5;
  --ds-line-height-relaxed: 1.625;
  
  /* Letter Spacing */
  --ds-letter-spacing-tight: -0.025em;
  --ds-letter-spacing-normal: 0;
  --ds-letter-spacing-wide: 0.025em;
  
  /* Apply base typography */
  font-family: var(--ds-font-family);
  font-size: var(--ds-font-size-base);
  line-height: var(--ds-line-height-normal);
  font-weight: var(--ds-font-weight-normal);
  letter-spacing: var(--ds-letter-spacing-normal);
  
  /* Improve text rendering */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Typography Hierarchy Classes */
.ds-text-primary {
  font-size: var(--ds-font-size-lg);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  letter-spacing: var(--ds-letter-spacing-tight);
}

.ds-text-secondary {
  font-size: var(--ds-font-size-sm);
  font-weight: var(--ds-font-weight-normal);
  line-height: var(--ds-line-height-normal);
  opacity: 0.8;
}

.ds-text-caption {
  font-size: var(--ds-font-size-xs);
  font-weight: var(--ds-font-weight-normal);
  line-height: var(--ds-line-height-normal);
  opacity: 0.7;
}

/* Status Message Typography */
.ds-status-message {
  font-size: var(--ds-font-size-base);
  font-weight: var(--ds-font-weight-medium);
  line-height: var(--ds-line-height-normal);
}

.ds-error-message {
  font-size: var(--ds-font-size-base);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-normal);
}

.ds-loading-message {
  font-size: var(--ds-font-size-lg);
  font-weight: var(--ds-font-weight-medium);
  line-height: var(--ds-line-height-tight);
}

/* Button Typography */
.ds-button-text {
  font-size: var(--ds-font-size-base);
  font-weight: var(--ds-font-weight-semibold);
  line-height: var(--ds-line-height-tight);
  letter-spacing: var(--ds-letter-spacing-wide);
}

/* Responsive Typography */
@media (min-width: 768px) {
  .document-scanner {
    --ds-font-size-base: 1.125rem;   /* 18px on tablet+ */
    --ds-font-size-lg: 1.25rem;      /* 20px on tablet+ */
    --ds-font-size-xl: 1.375rem;     /* 22px on tablet+ */
  }
}

@media (min-width: 1024px) {
  .document-scanner {
    --ds-font-size-base: 1.125rem;   /* 18px on desktop */
    --ds-font-size-lg: 1.375rem;     /* 22px on desktop */
    --ds-font-size-xl: 1.5rem;       /* 24px on desktop */
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .document-scanner {
    --ds-font-weight-normal: 500;
    --ds-font-weight-medium: 600;
    --ds-font-weight-semibold: 700;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .document-scanner * {
    transition: none !important;
    animation: none !important;
  }
}

/* Font Loading Optimization */
@supports (font-display: swap) {
  .document-scanner {
    font-display: swap;
  }
}

/* Legacy styles */
.cursor-pointer {
    cursor: pointer;
}

.document-scanner-initial-trigger {
    /* You might want to add some specific styling here if needed,
       e.g., to control its size when embedded in another component. */
}
</style>