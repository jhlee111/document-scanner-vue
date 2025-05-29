<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Point } from '../types'; // Point 타입 임포트
import { usePageManager } from '../composables/usePageManager';

/**
 * ImagePreview Component:
 * Handles displaying an image on a canvas, allowing users to adjust selection corners.
 * Emits 'corners-adjusted' when the user finishes adjusting corners.
 */

// CSS Variable Default Constants
const CSS_DEFAULTS = {
  MAGNIFIER_SIZE: '100',
  MAGNIFIER_ZOOM: '2',
  MAGNIFIER_BORDER_COLOR: '#555',
  MAGNIFIER_BG_COLOR: 'rgba(230, 230, 230, 0.85)',
  MAGNIFIER_CROSSHAIR_COLOR: 'white',
  MAGNIFIER_CROSSHAIR_LINE_WIDTH: '1',
  HANDLE_RADIUS: '8',
  HANDLE_COLOR: 'rgba(0, 123, 255, 0.7)',
  ACTIVE_HANDLE_COLOR: 'rgba(200, 200, 0, 0.3)',
  LINE_COLOR: 'rgba(255, 0, 0, 0.7)',
  LINE_WIDTH: '2'
} as const;

// Utility to get CSS variable or default
function getCssVar(varName: string, defaultValue: string): string {
    if (typeof window !== 'undefined') {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || defaultValue;
    }
    return defaultValue;
}

export interface ImagePreviewProps {
    imageDataURL: string | null;
    initialCorners?: Point[] | null;
    isProcessedPreview?: boolean;
    isEditMode?: boolean;
    pageManager?: ReturnType<typeof usePageManager>;
}

const props = defineProps<ImagePreviewProps>();
const emit = defineEmits(['corners-adjusted']);

// Use the passed page manager or create a fallback with empty state
const pageManager = props.pageManager || {
  moveToNextPage: () => {},
  moveToPrevPage: () => {},
  totalPages: computed(() => 0),
  pageCountDisplay: computed(() => '0/0')
};

const { moveToNextPage, moveToPrevPage, totalPages, pageCountDisplay } = pageManager;

const showNavigation = computed(() => totalPages.value > 1 && !isEditModeActive.value);
const hasMultiplePages = computed(() => totalPages.value > 1);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const magnifierCanvasRef = ref<HTMLCanvasElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let magCtx: CanvasRenderingContext2D | null = null;

const currentCorners = ref<Point[] | null>(null);
const currentTransformedCorners = ref<Point[] | null>(null); // Corners transformed for current rotation/scale

const activeCornerIndex = ref<number | null>(null);
const isDragging = ref(false);
const lastPointerPosition = ref<Point | null>(null);

// Default values for props if not provided
const isProcessedPreviewMode = computed(() => props.isProcessedPreview ?? false);
const isEditModeActive = computed(() => props.isEditMode ?? false);

// Render parameters
const renderParams = ref({
    imageWidth: 0,
    imageHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    renderWidth: 0,
    renderHeight: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    isReady: false,
});

// Magnifier state
const magnifierVisible = ref(false);
const magnifierFixedPositionSide = ref<'top-left' | 'top-right' | null>(null);
const magnifierSize = ref(parseFloat(getCssVar('--magnifier-size', CSS_DEFAULTS.MAGNIFIER_SIZE))); 
const magnifierZoom = ref(parseFloat(getCssVar('--magnifier-zoom', CSS_DEFAULTS.MAGNIFIER_ZOOM)));

// Constants for touch interaction
const TOUCH_AREA_EXPANSION = 30; // Additional pixels for easier touch targeting
const CORNER_INDEX = {
    TOP_LEFT: 0,
    TOP_RIGHT: 1,
    BOTTOM_RIGHT: 2,
    BOTTOM_LEFT: 3,
} as const;

const magnifierStaticStyle = computed(() => {
    if (!magnifierVisible.value || !magnifierFixedPositionSide.value) return { display: 'none' };

    const style: Record<string, string> = {
        position: 'absolute',
        width: `${magnifierSize.value}px`,
        height: `${magnifierSize.value}px`,
        borderRadius: '50%',
        border: `2px solid ${getCssVar('--magnifier-border-color', CSS_DEFAULTS.MAGNIFIER_BORDER_COLOR)}`,
        boxShadow: '0 0 10px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        zIndex: '1001',
        top: '15px', // Offset from top of the canvas container
        backgroundColor: getCssVar('--magnifier-bg-color', CSS_DEFAULTS.MAGNIFIER_BG_COLOR),
        opacity: '1 !important',
    };
    if (magnifierFixedPositionSide.value === 'top-right') {
        style.right = '15px'; // Offset from right
    } else { // top-left
        style.left = '15px'; // Offset from left
    }
    return style;
});

watch(() => props.imageDataURL, (newURL) => {
    console.log('[IP] imageDataURL changed:', newURL ? 'has URL' : 'is null');
    renderParams.value.isReady = false; // Mark as not ready until new image loads
    currentCorners.value = null; // Reset corners for new image
    currentTransformedCorners.value = null;
    activeCornerIndex.value = null;
    if (newURL) {
        // Image ref will trigger onImageLoadSetupCanvas via @load
    } else {
        clearCanvas();
    }
}, { immediate: true });

watch(() => props.initialCorners, (newCorners) => {
    console.log('[IP] initialCorners changed:', newCorners);
    if (newCorners && newCorners.length === 4) {
        currentCorners.value = JSON.parse(JSON.stringify(newCorners));
        if (renderParams.value.isReady) {
            transformAndDraw();
        }
    } else if (!newCorners && imageRef.value && imageRef.value.complete && renderParams.value.isReady) {
        // Handle if needed
    }
}, { immediate: true, deep: true });

const onImageLoadSetupCanvas = async () => {
    const image = imageRef.value;
    const canvas = canvasRef.value;

    if (!image || !canvas || !image.complete || image.naturalWidth === 0) {
        console.warn('[IP] onImageLoad: Image or canvas not ready or image has no dimensions.');
        renderParams.value.isReady = false;
        return;
    }
    console.log('[IP] Image loaded:', image.src.substring(0, 50), `(${image.naturalWidth}x${image.naturalHeight})`);

    renderParams.value.imageWidth = image.naturalWidth;
    renderParams.value.imageHeight = image.naturalHeight;
    
    // Wait for DOM to be updated and retry container dimension calculation
    await nextTick();
    
    // Retry mechanism for container dimensions in complex app layouts
    let retries = 0;
    const maxRetries = 5;
    const retryDelay = 50; // ms
    
    const attemptCalculation = async (): Promise<boolean> => {
    if (!canvas.parentElement) {
        console.warn('[IP] Canvas parent element not found during image load setup.');
            return false;
        }

        const containerWidth = canvas.parentElement.clientWidth;
        const containerHeight = canvas.parentElement.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) {
            retries++;
            
            // Detailed debugging for zero dimensions
            console.log(`[IP] Container dimensions zero, retry ${retries}/${maxRetries} in ${retryDelay}ms`);
            console.log('[IP] Debug info:', {
                parentElement: canvas.parentElement.tagName,
                parentClass: canvas.parentElement.className,
                parentStyle: canvas.parentElement.getAttribute('style'),
                clientWidth: canvas.parentElement.clientWidth,
                clientHeight: canvas.parentElement.clientHeight,
                offsetWidth: canvas.parentElement.offsetWidth,
                offsetHeight: canvas.parentElement.offsetHeight,
                scrollWidth: canvas.parentElement.scrollWidth,
                scrollHeight: canvas.parentElement.scrollHeight,
                computedDisplay: window.getComputedStyle(canvas.parentElement).display,
                computedWidth: window.getComputedStyle(canvas.parentElement).width,
                computedHeight: window.getComputedStyle(canvas.parentElement).height,
                computedFlex: window.getComputedStyle(canvas.parentElement).flex,
                grandParent: canvas.parentElement.parentElement ? {
                    tagName: canvas.parentElement.parentElement.tagName,
                    className: canvas.parentElement.parentElement.className,
                    clientWidth: canvas.parentElement.parentElement.clientWidth,
                    clientHeight: canvas.parentElement.parentElement.clientHeight,
                } : null
            });
            
            if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return attemptCalculation();
            } else {
                console.warn('[IP] Container dimensions still zero after all retries.');
                return false;
            }
        }

        return true;
    };

    const success = await attemptCalculation();
    if (!success) {
        // Fallback: Force minimum dimensions as last resort
        console.warn('[IP] Using fallback dimensions due to layout issues');
        
        // Get viewport dimensions as fallback
        const fallbackWidth = Math.min(window.innerWidth - 40, 800); // Leave some margin
        const fallbackHeight = Math.min(window.innerHeight - 200, 600); // Account for headers/toolbars
        
        if (canvas.parentElement) {
            // Force the parent container to have dimensions
            canvas.parentElement.style.width = `${fallbackWidth}px`;
            canvas.parentElement.style.height = `${fallbackHeight}px`;
            canvas.parentElement.style.minWidth = `${fallbackWidth}px`;
            canvas.parentElement.style.minHeight = `${fallbackHeight}px`;
            canvas.parentElement.style.display = 'flex';
            canvas.parentElement.style.flexDirection = 'column';
            
            console.log(`[IP] Forced parent dimensions to ${fallbackWidth}x${fallbackHeight}`);
            
            // Try calculation one more time
            await nextTick();
            calculateRenderParameters();
            
            if (!renderParams.value.isReady) {
                console.error('[IP] Still failed after forced dimensions');
                return;
            }
        } else {
        renderParams.value.isReady = false;
        return;
    }
    } else {
    calculateRenderParameters();

    if (!renderParams.value.isReady) {
        console.warn("[IP] Render parameters could not be established after image load.");
        return;
        }
    }

    ctx = canvas.getContext('2d');
    if (magnifierCanvasRef.value) {
        magCtx = magnifierCanvasRef.value.getContext('2d');
        // Set magnifier canvas fixed size once
        magnifierCanvasRef.value.width = magnifierSize.value;
        magnifierCanvasRef.value.height = magnifierSize.value;
    }

    if (!currentCorners.value && !isProcessedPreviewMode.value) {
        console.log("[IP] No initial corners provided, setting default corners.");
        setDefaultCorners();
    }
    
    transformAndDraw();
    console.log('[IP] Initial draw complete after image load.');
};

const calculateRenderParameters = () => {
    const canvas = canvasRef.value;
    const image = imageRef.value;

    if (!canvas || !image || !image.complete || !canvas.parentElement) {
        console.warn("[IP] calcRenderParams: Prerequisites not met.");
        renderParams.value.isReady = false;
        return;
    }

    const containerWidth = canvas.parentElement.clientWidth;
    const containerHeight = canvas.parentElement.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) {
        console.warn("[IP] calcRenderParams: Container dimensions are zero.", {
            containerWidth,
            containerHeight,
            parentElement: canvas.parentElement.tagName,
            parentStyles: window.getComputedStyle(canvas.parentElement)
        });
        renderParams.value.isReady = false;
        return;
    }
    
    renderParams.value.canvasWidth = containerWidth;
    renderParams.value.canvasHeight = containerHeight;
    canvas.width = renderParams.value.canvasWidth;
    canvas.height = renderParams.value.canvasHeight;

    // Update magnifier canvas size if it changed through CSS vars after initial setup
    if (magnifierCanvasRef.value) {
        const newMagnifierSize = parseFloat(getCssVar('--magnifier-size', CSS_DEFAULTS.MAGNIFIER_SIZE));
        if (magnifierSize.value !== newMagnifierSize) {
            magnifierSize.value = newMagnifierSize;
        }
        magnifierCanvasRef.value.width = magnifierSize.value;
        magnifierCanvasRef.value.height = magnifierSize.value;
    }
    const newMagnifierZoom = parseFloat(getCssVar('--magnifier-zoom', CSS_DEFAULTS.MAGNIFIER_ZOOM));
    if (magnifierZoom.value !== newMagnifierZoom) {
        magnifierZoom.value = newMagnifierZoom;
    }

    let imgEffectiveWidth = renderParams.value.imageWidth;
    let imgEffectiveHeight = renderParams.value.imageHeight;

    const imageAspectRatio = imgEffectiveWidth / imgEffectiveHeight;
    const canvasAspectRatio = renderParams.value.canvasWidth / renderParams.value.canvasHeight;

    // Different scaling behavior for preview vs edit mode
    if (isProcessedPreviewMode.value) {
        // For preview mode: Use "contain" behavior to show the entire processed image
        // This ensures the user sees the full result of their format selection
        if (imageAspectRatio > canvasAspectRatio) {
            renderParams.value.renderWidth = renderParams.value.canvasWidth;
            renderParams.value.renderHeight = renderParams.value.canvasWidth / imageAspectRatio;
        } else {
            renderParams.value.renderHeight = renderParams.value.canvasHeight;
            renderParams.value.renderWidth = renderParams.value.canvasHeight * imageAspectRatio;
        }
    } else {
        // For edit mode: Use "contain" behavior to show entire image for corner adjustment
        if (imageAspectRatio > canvasAspectRatio) {
            renderParams.value.renderWidth = renderParams.value.canvasWidth;
            renderParams.value.renderHeight = renderParams.value.canvasWidth / imageAspectRatio;
        } else {
            renderParams.value.renderHeight = renderParams.value.canvasHeight;
            renderParams.value.renderWidth = renderParams.value.canvasHeight * imageAspectRatio;
        }
    }

    renderParams.value.offsetX = (renderParams.value.canvasWidth - renderParams.value.renderWidth) / 2;
    renderParams.value.offsetY = (renderParams.value.canvasHeight - renderParams.value.renderHeight) / 2;
    renderParams.value.scale = renderParams.value.renderWidth / imgEffectiveWidth;
    renderParams.value.isReady = true;
    console.log('[IP] Render params calculated:', JSON.parse(JSON.stringify(renderParams.value)));
};

const transformAndDraw = () => {
    if (!ctx || !imageRef.value || !imageRef.value.complete || !renderParams.value.isReady) {
        console.warn('[IP] transformAndDraw: Canvas context or image not ready.');
        clearCanvas();
        return;
    }
    
    calculateRenderParameters();
    if (!renderParams.value.isReady) {
        console.warn('[IP] transformAndDraw: Render parameters not ready after recalculation.');
        clearCanvas();
        return;
    }

    clearCanvas();
    
    ctx.drawImage(
        imageRef.value,
        0, 0,
        renderParams.value.imageWidth, renderParams.value.imageHeight,
        renderParams.value.offsetX, renderParams.value.offsetY,
        renderParams.value.renderWidth, renderParams.value.renderHeight
    );

    if (currentCorners.value && isEditModeActive.value && !isProcessedPreviewMode.value) {
        currentTransformedCorners.value = currentCorners.value.map(corner =>
            transformCornerToCanvasSpace(corner)
        );
        drawSelectionHandles();
        drawConnectingLines();
    } else {
        currentTransformedCorners.value = null;
    }

    // Log state before the drawMagnifier condition
    console.log(`[IP] Pre-Magnifier Check: visible=${magnifierVisible.value}, activeIdx=${activeCornerIndex.value}, editMode=${isEditModeActive.value}, processedPreview=${isProcessedPreviewMode.value}`);

    if (magnifierVisible.value && activeCornerIndex.value !== null && isEditModeActive.value && !isProcessedPreviewMode.value) {
        drawMagnifier();
    }
};

const transformCornerToCanvasSpace = (corner: Point): Point => {
    const scaledX = corner.x * renderParams.value.scale;
    const scaledY = corner.y * renderParams.value.scale;
    return {
        x: renderParams.value.offsetX + scaledX,
        y: renderParams.value.offsetY + scaledY,
    };
};

const transformCornerFromCanvasSpace = (canvasPoint: Point): Point => {
    const originalX = (canvasPoint.x - renderParams.value.offsetX) / renderParams.value.scale;
    const originalY = (canvasPoint.y - renderParams.value.offsetY) / renderParams.value.scale;
    return { x: originalX, y: originalY };
};

const setDefaultCorners = () => {
    if (!renderParams.value.isReady) return;
    const { imageWidth, imageHeight } = renderParams.value;
    const insetPixels = 32;
    const insetInImageCoords = insetPixels / renderParams.value.scale;
    const safeInset = Math.min(insetInImageCoords, Math.min(imageWidth, imageHeight) * 0.1);
    
    currentCorners.value = [
        { x: safeInset, y: safeInset },
        { x: imageWidth - safeInset, y: safeInset },
        { x: imageWidth - safeInset, y: imageHeight - safeInset },
        { x: safeInset, y: imageHeight - safeInset },
    ];
    console.log('[IP] Default corners set:', JSON.parse(JSON.stringify(currentCorners.value)));
};

const clearCanvas = () => {
    if (ctx && canvasRef.value) {
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
};

const drawSelectionHandles = () => {
    if (!ctx || !currentTransformedCorners.value || isProcessedPreviewMode.value) return;
    const handleRadius = parseFloat(getCssVar('--handle-radius', CSS_DEFAULTS.HANDLE_RADIUS));
    const handleColor = getCssVar('--handle-color', CSS_DEFAULTS.HANDLE_COLOR);
    const activeHandleColor = getCssVar('--active-handle-color', CSS_DEFAULTS.ACTIVE_HANDLE_COLOR);

    currentTransformedCorners.value.forEach((corner, index) => {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, handleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = index === activeCornerIndex.value ? activeHandleColor : handleColor;
        ctx.fill();
    });
};

const drawConnectingLines = () => {
    if (!ctx || !currentTransformedCorners.value || currentTransformedCorners.value.length !== 4 || isProcessedPreviewMode.value) return;
    ctx.beginPath();
    ctx.moveTo(currentTransformedCorners.value[0].x, currentTransformedCorners.value[0].y);
    for (let i = 1; i < 4; i++) {
        ctx.lineTo(currentTransformedCorners.value[i].x, currentTransformedCorners.value[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = getCssVar('--line-color', CSS_DEFAULTS.LINE_COLOR);
    ctx.lineWidth = parseFloat(getCssVar('--line-width', CSS_DEFAULTS.LINE_WIDTH));
    ctx.stroke();
};

const getCanvasCoordinates = (event: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.value;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (event instanceof MouseEvent) {
        clientX = event.clientX;
        clientY = event.clientY;
    } else if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        return null;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
};

const onPointerDown = (event: PointerEvent) => {
    if (!isEditModeActive.value || isProcessedPreviewMode.value || !canvasRef.value || !currentTransformedCorners.value) return;
    event.preventDefault();
    
    const coords = getCanvasCoordinates(event as unknown as MouseEvent);
    if (!coords) return;

    const handleRadius = parseFloat(getCssVar('--handle-radius', CSS_DEFAULTS.HANDLE_RADIUS));
    for (let i = 0; i < currentTransformedCorners.value.length; i++) {
        const corner = currentTransformedCorners.value[i];
        const distance = Math.sqrt(Math.pow(coords.x - corner.x, 2) + Math.pow(coords.y - corner.y, 2));
        if (distance < handleRadius + TOUCH_AREA_EXPANSION) { // Enhanced touch area for better usability
            activeCornerIndex.value = i;
            isDragging.value = true;
            lastPointerPosition.value = coords;
            
            // Determine magnifier position side based on corner location
            if (i === CORNER_INDEX.TOP_LEFT || i === CORNER_INDEX.BOTTOM_LEFT) {
                magnifierFixedPositionSide.value = 'top-right';
            } else { // TOP_RIGHT or BOTTOM_RIGHT corner
                magnifierFixedPositionSide.value = 'top-left';
            }
            magnifierVisible.value = true;
            
            canvasRef.value.setPointerCapture(event.pointerId);
            console.log('[IP] PointerDown on handle:', i, 'Magnifier side:', magnifierFixedPositionSide.value);
            transformAndDraw(); // Redraw to show active handle and magnifier
            return;
        }
    }
    activeCornerIndex.value = null;
    magnifierVisible.value = false;
    magnifierFixedPositionSide.value = null;
    transformAndDraw();
};

const onPointerMove = (event: PointerEvent) => {
    if (!isDragging.value || activeCornerIndex.value === null || !isEditModeActive.value || isProcessedPreviewMode.value) return;
    event.preventDefault();
    
    const coords = getCanvasCoordinates(event as unknown as MouseEvent);
    if (!coords || !lastPointerPosition.value || !currentCorners.value || !currentTransformedCorners.value) return;

    const dxCanvas = coords.x - lastPointerPosition.value.x;
    const dyCanvas = coords.y - lastPointerPosition.value.y;

    currentTransformedCorners.value[activeCornerIndex.value].x += dxCanvas;
    currentTransformedCorners.value[activeCornerIndex.value].y += dyCanvas;
    
    const newOriginalCorner = transformCornerFromCanvasSpace(currentTransformedCorners.value[activeCornerIndex.value]);
    
    const { imageWidth, imageHeight } = renderParams.value;
    currentCorners.value[activeCornerIndex.value].x = Math.max(0, Math.min(newOriginalCorner.x, imageWidth));
    currentCorners.value[activeCornerIndex.value].y = Math.max(0, Math.min(newOriginalCorner.y, imageHeight));

    currentTransformedCorners.value[activeCornerIndex.value] = transformCornerToCanvasSpace(currentCorners.value[activeCornerIndex.value]);
    
    lastPointerPosition.value = coords;
    // Magnifier position is fixed, but its content needs update
    transformAndDraw();
};

const onPointerUp = (event: PointerEvent) => {
    if (!isDragging.value || !isEditModeActive.value || isProcessedPreviewMode.value) return;
    event.preventDefault();

    if (canvasRef.value) {
        canvasRef.value.releasePointerCapture(event.pointerId);
    }
    
    console.log('[IP] PointerUp, emitting corners-adjusted:', JSON.parse(JSON.stringify(currentCorners.value)));
    if (currentCorners.value) {
      emit('corners-adjusted', JSON.parse(JSON.stringify(currentCorners.value)));
    }
    
    isDragging.value = false;
    // activeCornerIndex.value = null; // Keep activeCornerIndex for magnifier until next click if needed, or clear it
    magnifierVisible.value = false;
    magnifierFixedPositionSide.value = null;
    magCtx = null; // Nullify magCtx when magnifier is hidden
    transformAndDraw();
};

const drawMagnifier = () => {
    console.log("[IP] Entered drawMagnifier function"); 

    // Detailed check for guard condition
    console.log(`[IP] Guard Check: magCtx=${!!magCtx}, magCanvasRef=${!!magnifierCanvasRef.value}, ctx=${!!ctx}, canvasRef=${!!canvasRef.value}, activeIdx=${activeCornerIndex.value}, currentTransformedCorners=${!!currentTransformedCorners.value}, imageRef=${!!imageRef.value}, renderParamsReady=${renderParams.value.isReady}, magnifierVisible=${magnifierVisible.value}, isProcessedPreview=${isProcessedPreviewMode.value}`);

    // Attempt to get magCtx if it's null but canvas ref exists
    if (magnifierCanvasRef.value && !magCtx) {
        console.log("[IP] Attempting to re-acquire magCtx in drawMagnifier");
        magCtx = magnifierCanvasRef.value.getContext('2d');
        if (magCtx) {
            console.log("[IP] Successfully re-acquired magCtx");
            // Ensure its dimensions are set if we just got the context
            magnifierCanvasRef.value.width = magnifierSize.value;
            magnifierCanvasRef.value.height = magnifierSize.value;
        } else {
            console.error("[IP] Failed to re-acquire magCtx in drawMagnifier");
        }
    }

    if (!magCtx || !magnifierCanvasRef.value || !ctx || !canvasRef.value || activeCornerIndex.value === null || !currentTransformedCorners.value || !imageRef.value || !renderParams.value.isReady || !magnifierVisible.value || isProcessedPreviewMode.value) {
        if (magnifierVisible.value && isProcessedPreviewMode.value) {
            magnifierVisible.value = false; // ensure it's hidden
            magnifierFixedPositionSide.value = null;
            magCtx = null; // Nullify magCtx if guard hides magnifier
        }
        // Add a log here too if it exits early
        // console.log("[IP] drawMagnifier exited early due to guard conditions."); 
        return;
    }

    const mSize = magnifierSize.value;
    const mZoom = magnifierZoom.value;
    
    const handlePos = currentTransformedCorners.value[activeCornerIndex.value as number]; 
    const sourceRectSize = mSize / mZoom;
    const sourceRectX = handlePos.x - sourceRectSize / 2;
    const sourceRectY = handlePos.y - sourceRectSize / 2;

    // UNCOMMENT and activate the detailed log:
    console.log(`[IP] drawMagnifier Details: activeIdx=${activeCornerIndex.value}, handlePosX=${handlePos.x.toFixed(2)}, handlePosY=${handlePos.y.toFixed(2)}, mSize=${mSize}, mZoom=${mZoom}, sourceRectX=${sourceRectX.toFixed(2)}, sourceRectY=${sourceRectY.toFixed(2)}`);

    magCtx.clearRect(0, 0, mSize, mSize);

    // Log canvas state before fillRect
    if (magnifierCanvasRef.value && magCtx) {
        console.log(`[IP] Magnifier pre-fill: Canvas W=${magnifierCanvasRef.value.width}, H=${magnifierCanvasRef.value.height}, Ctx valid=${!!magCtx}`);
    } else {
        console.log('[IP] Magnifier pre-fill: Canvas or Ctx is NULL');
    }

    // Fill with red for debugging
    magCtx.fillStyle = 'red';
    magCtx.fillRect(0, 0, mSize, mSize);
    
    // Draw the zoomed portion of the main canvas
    magCtx.drawImage(
        canvasRef.value,      // Source canvas
        sourceRectX,          // Source X
        sourceRectY,          // Source Y
        sourceRectSize,       // Source Width
        sourceRectSize,       // Source Height
        0,                    // Destination X on magnifier
        0,                    // Destination Y on magnifier
        mSize,                // Destination Width on magnifier
        mSize                 // Destination Height on magnifier
    );

    magCtx.strokeStyle = getCssVar('--magnifier-crosshair-color', CSS_DEFAULTS.MAGNIFIER_CROSSHAIR_COLOR);
    magCtx.lineWidth = parseFloat(getCssVar('--magnifier-crosshair-line-width', CSS_DEFAULTS.MAGNIFIER_CROSSHAIR_LINE_WIDTH));
    magCtx.beginPath();
    magCtx.moveTo(mSize / 2, 0);
    magCtx.lineTo(mSize / 2, mSize);
    magCtx.moveTo(0, mSize / 2);
    magCtx.lineTo(mSize, mSize / 2);
    magCtx.stroke();
};

const resetCorners = () => {
    if (isProcessedPreviewMode.value) return;
    console.log('[IP] resetCorners called');
    setDefaultCorners();
    transformAndDraw();
    if (currentCorners.value) {
        emit('corners-adjusted', JSON.parse(JSON.stringify(currentCorners.value)));
    }
};

const processCorners = () => {
    console.log('[IP] processCorners called.');
    if (currentCorners.value && currentCorners.value.length === 4) {
        console.log('[IP] Emitting corners-adjusted from processCorners with:', JSON.parse(JSON.stringify(currentCorners.value)));
        emit('corners-adjusted', JSON.parse(JSON.stringify(currentCorners.value)));
    } else {
        console.warn('[IP] processCorners called, but currentCorners are not valid.');
    }
};

const resetSelection = () => {
    console.log('[IP] resetSelection called');
    if (renderParams.value.isReady) {
        setDefaultCorners();
        transformAndDraw();
        if (currentCorners.value) {
            console.log('[IP] Emitting corners-adjusted from resetSelection');
            emit('corners-adjusted', JSON.parse(JSON.stringify(currentCorners.value)));
        }
    }
};

const triggerRedraw = () => {
    console.log('[IP] triggerRedraw called');
    if (renderParams.value.isReady) {
        transformAndDraw();
    }
}

defineExpose({
    processCorners,
    resetSelection,
    triggerRedraw,
    resetCorners,
});

onMounted(() => {
    magnifierSize.value = parseFloat(getCssVar('--magnifier-size', CSS_DEFAULTS.MAGNIFIER_SIZE));
    magnifierZoom.value = parseFloat(getCssVar('--magnifier-zoom', CSS_DEFAULTS.MAGNIFIER_ZOOM));

    if (props.imageDataURL) {
        // Image ref will trigger its @load event which calls onImageLoadSetupCanvas
    }
    window.addEventListener('resize', transformAndDraw);
});

onUnmounted(() => {
    window.removeEventListener('resize', transformAndDraw);
});

</script>

<template>
    <div class="image-preview-container d-flex flex-column w-100 h-100 overflow-hidden bg-dark position-relative user-select-none"
         data-testid="image-preview"
         style="max-width: 100%; max-height: 100%;">
        
        <!-- Navigation Buttons -->
        <div v-if="showNavigation" class="navigation-buttons">
            <button
                class="nav-btn nav-btn-prev"
                @click="moveToPrevPage"
                :disabled="false"
                aria-label="Previous page"
                title="Previous page"
            >
                <ChevronLeft :size="24" />
            </button>
            
            <div class="page-counter">
                {{ pageCountDisplay }}
            </div>
            
            <button
                class="nav-btn nav-btn-next"
                @click="moveToNextPage"
                :disabled="false"
                aria-label="Next page"
                title="Next page"
            >
                <ChevronRight :size="24" />
            </button>
        </div>
        
        <canvas
            ref="canvasRef"
            class="flex-grow-1 w-100"
            :data-testid="isProcessedPreviewMode ? 'processed-image' : undefined"
            style="touch-action: none; min-height: 0; max-width: 100%; max-height: 100%; object-fit: contain;"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp" 
        ></canvas>
        
        <canvas 
            v-if="magnifierVisible && !isProcessedPreviewMode && magnifierFixedPositionSide"
            ref="magnifierCanvasRef"
            class="magnifier-canvas"
            :style="magnifierStaticStyle"
            aria-hidden="true"
        ></canvas> <!-- width/height are set in onImageLoadSetupCanvas & calculateRenderParameters -->

        <img
            v-if="props.imageDataURL"
            ref="imageRef"
            :src="props.imageDataURL"
            alt="Preview for dimensions"
            class="d-none" 
            @load="onImageLoadSetupCanvas"
            @error="console.error('Image failed to load for preview:', props.imageDataURL)"
        />
    </div>
</template>

<style scoped>
/* Bootstrap classes handle most styling. */
.image-preview-container {
    min-height: 500px; /* Increased from 300px to provide more space for preview images */
    background-color: #000 !important; /* Ensure dark background */
    /* Ensure strict containment */
    max-width: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
    box-sizing: border-box;
}

canvas {
    background-color: transparent !important;
    cursor: crosshair; /* Default cursor for adjustment area */
    /* Strict sizing constraints */
    max-width: 100% !important;
    max-height: 100% !important;
    box-sizing: border-box;
    /* Prevent canvas from creating its own scrollable area */
    display: block;
}

/* Navigation buttons */
.navigation-buttons {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 24px;
    padding: 8px 16px;
    backdrop-filter: blur(4px);
}

.nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
}

.nav-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
}

.nav-btn:active {
    transform: scale(0.95);
}

.nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

.nav-btn:disabled:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: none;
}

.page-counter {
    color: white;
    font-size: 14px;
    font-weight: 500;
    min-width: 60px;
    text-align: center;
    letter-spacing: 0.5px;
}

/* Magnifier canvas has its style set dynamically by magnifierStaticStyle for position,
   and its internal background can be set by --magnifier-bg-color or defaults. */
.magnifier-canvas {
    /* Base styles if needed, but most are dynamic or via CSS vars */
}
</style>