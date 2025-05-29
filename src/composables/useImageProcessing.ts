import { ref, readonly, watch, type Ref, type DeepReadonly } from 'vue';
import {
  detectDocumentCorners,
  applyPerspectiveTransform,
  rotateImageDataURL,
} from "../utils/opencvUtils";
import { transformCornersForRotation, sortCornersForConsistentOrientation } from "../utils/imageProcessing";
import { Point, Page as PageType, PaperFormat } from "../types";

console.log('[UIP] opencvUtils imported:', typeof detectDocumentCorners, typeof applyPerspectiveTransform); // Test log

// Define standard paper ratios and tolerance
const STANDARD_PAPER_RATIOS: { name: string; ratio: number }[] = [
  { name: 'A4 Portrait', ratio: 1 / Math.sqrt(2) }, // ~0.7071
  { name: 'A4 Landscape', ratio: Math.sqrt(2) }, // ~1.4142
  { name: 'Letter Portrait', ratio: 8.5 / 11 }, // ~0.7727
  { name: 'Letter Landscape', ratio: 11 / 8.5 }, // ~1.2941
  { name: 'Legal Portrait', ratio: 8.5 / 14 },   // ~0.6071
  { name: 'Legal Landscape', ratio: 14 / 8.5 },  // ~1.6471
  { name: 'Square', ratio: 1.0 },
  { name: 'ID Card/Credit Card', ratio: 85.6 / 53.98 }, // ~1.5857 (ISO/IEC 7810 ID-1)
  { name: 'Business Card (US)', ratio: 3.5 / 2 }, // 1.75
  { name: 'Business Card (EU)', ratio: 85 / 55 }, // ~1.545
];

const RATIO_ADJUSTMENT_TOLERANCE = 0.15; // 15% tolerance, increased for better real-world matching

// Add a flag to control which method to use
const USE_PERSPECTIVE_AWARE_RATIO = true;

// Disable automatic format adjustment - let users choose
const USE_AUTOMATIC_FORMAT_ADJUSTMENT = false;

// Helper function to find closest standard ratio
function findClosestStandardRatio(calculatedRatio: number): { name: string; ratio: number } | null {
  if (calculatedRatio <= 0) return null;

  let closestMatch = null;
  let smallestDifference = Infinity;

  for (const standard of STANDARD_PAPER_RATIOS) {
    const difference = Math.abs(standard.ratio - calculatedRatio);
    const relativeDifference = difference / calculatedRatio;
    
    console.log(`[ImgProc] Checking ${standard.name}: target=${standard.ratio.toFixed(4)}, calculated=${calculatedRatio.toFixed(4)}, diff=${difference.toFixed(4)}, relative=${(relativeDifference * 100).toFixed(1)}%`);
    
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestMatch = standard;
    }
  }

  // Check if the closest match is within tolerance relative to the calculated ratio
  if (closestMatch && (smallestDifference / calculatedRatio) < RATIO_ADJUSTMENT_TOLERANCE) {
    console.log(`[ImgProc] ✅ Calculated ratio ${calculatedRatio.toFixed(4)} matched to ${closestMatch.name} (ratio ${closestMatch.ratio.toFixed(4)}) with relative difference ${((smallestDifference / calculatedRatio) * 100).toFixed(1)}%`);
    return closestMatch;
  }
  console.log(`[ImgProc] ❌ Calculated ratio ${calculatedRatio.toFixed(4)} did not find a close standard match. Closest: ${closestMatch?.name} with relative difference ${closestMatch ? ((smallestDifference / calculatedRatio) * 100).toFixed(1) : 'N/A'}%`);
  return null;
}

/**
 * Composable for handling image processing operations
 * Manages corner detection, adjustment, and perspective transform
 */
export function useImageProcessing(
  isOpenCVReady: Readonly<Ref<boolean>>
) {
  const detectedCornersInternal = ref<ReadonlyArray<Point> | null>(null);
  const adjustedCornersInternal = ref<ReadonlyArray<Point> | null>(null);
  const currentRotationInternal = ref<number>(0);
  const isProcessingInternal = ref<boolean>(false); // For its own long operations

  const detectedCorners: Readonly<Ref<ReadonlyArray<Point> | null>> = readonly(detectedCornersInternal);
  const adjustedCorners: Readonly<Ref<ReadonlyArray<Point> | null>> = readonly(adjustedCornersInternal);
  const currentRotation: Readonly<Ref<number>> = readonly(currentRotationInternal);
  const isProcessing: Readonly<Ref<boolean>> = readonly(isProcessingInternal);

  /**
   * Performs edge detection on an image and updates detected corners
   * @param imageDataURL - Data URL of the image to process
   */
  async function detectEdges(imageDataURL: string): Promise<ReadonlyArray<Point> | null> {
    if (!isOpenCVReady.value || !imageDataURL) {
      console.warn("[ImgProc] OpenCV not ready or no image data URL for edge detection.");
      return null;
    }
    isProcessingInternal.value = true;
    try {
      const corners = await detectDocumentCorners(imageDataURL);

      if (corners && corners.length === 4) {
        detectedCornersInternal.value = Object.freeze(corners);
        adjustedCornersInternal.value = Object.freeze(corners);
        return detectedCornersInternal.value;
      } else {
        console.warn("[ImgProc] Edge detection did not return 4 corners.");
        detectedCornersInternal.value = null;
        adjustedCornersInternal.value = null;
        return null;
      }
    } catch (error) {
      console.error("[ImgProc] Error during edge detection:", error);
      detectedCornersInternal.value = null;
      adjustedCornersInternal.value = null;
      return null;
    } finally {
      isProcessingInternal.value = false;
    }
  }

  /**
   * Detect paper format from current corners
   */
  function detectPaperFormat(corners: ReadonlyArray<Point>) {
    // Implementation of detectPaperFormat function
  }

  /**
   * Processes an image with perspective transform using specified format
   * @param imageDataURL - Source image data URL
   * @param cornersToApply - Adjusted corner coordinates (expected as ReadonlyArray<Point>)
   * @param outputFormat - Optional paper format to use for output dimensions
   * @returns Promise<{ imageDataURL: string; processedWidth: number; processedHeight: number } | null>
   */
  async function performPerspectiveTransform(
    imageDataURL: string,
    cornersToApply: ReadonlyArray<Point>,
    outputFormat?: PaperFormat | null
  ): Promise<{
    imageDataURL: string;
    processedWidth: number;
    processedHeight: number;
  } | null> {
    if (!isOpenCVReady.value || !imageDataURL || !cornersToApply || cornersToApply.length !== 4) {
      console.warn("[ImgProc] Prerequisites for perspective transform not met.");
      return null;
    }
    isProcessingInternal.value = true;
    try {
      const sortedCorners = sortCornersForConsistentOrientation([...cornersToApply]);
      
      let outputWidthOpt: number | undefined = undefined;
      let outputHeightOpt: number | undefined = undefined;

      if (USE_AUTOMATIC_FORMAT_ADJUSTMENT) {
        // OLD: Automatic format detection and adjustment
        const currentCalculatedAspectRatio = calculateOriginalAspectRatio(sortedCorners);

        if (currentCalculatedAspectRatio !== null && currentCalculatedAspectRatio > 0) {
          const closestStandard = findClosestStandardRatio(currentCalculatedAspectRatio);
          if (closestStandard) {
            // Calculate maxWidth and maxHeight based on sortedCorners (as opencvUtils would)
            const [tl, tr, br, bl] = sortedCorners;
            const dist = (p1: Point, p2: Point) => Math.sqrt(((p1.x - p2.x) ** 2) + ((p1.y - p2.y) ** 2));

            const widthTop = dist(tl, tr);
            const widthBottom = dist(bl, br);
            const calculatedMaxWidth = Math.max(Math.floor(widthTop), Math.floor(widthBottom));

            const heightLeft = dist(tl, bl);
            const heightRight = dist(tr, br);
            const calculatedMaxHeight = Math.max(Math.floor(heightLeft), Math.floor(heightRight));

            // Determine target output dimensions based on the standard ratio,
            // preserving the scale of the detected shape's dominant dimension.
            if (calculatedMaxHeight >= calculatedMaxWidth) { // Detected shape is portrait or square
              outputHeightOpt = calculatedMaxHeight;
              outputWidthOpt = Math.round(outputHeightOpt * closestStandard.ratio); // standard.ratio is W/H
            } else { // Detected shape is landscape
              outputWidthOpt = calculatedMaxWidth;
              outputHeightOpt = Math.round(outputWidthOpt / closestStandard.ratio); // standard.ratio is W/H
            }
            console.log(`[ImgProc] Adjusting output to standard ratio: ${closestStandard.name}. Original calc dims: ${calculatedMaxWidth}x${calculatedMaxHeight}. Target output: ${outputWidthOpt}x${outputHeightOpt}`);
          }
        }
      } else if (outputFormat) {
        // NEW: Use user-selected format
        const [tl, tr, br, bl] = sortedCorners;
        const dist = (p1: Point, p2: Point) => Math.sqrt(((p1.x - p2.x) ** 2) + ((p1.y - p2.y) ** 2));

        const widthTop = dist(tl, tr);
        const widthBottom = dist(bl, br);
        const calculatedMaxWidth = Math.max(Math.floor(widthTop), Math.floor(widthBottom));

        const heightLeft = dist(tl, bl);
        const heightRight = dist(tr, br);
        const calculatedMaxHeight = Math.max(Math.floor(heightLeft), Math.floor(heightRight));

        // Use the larger dimension as the base and calculate the other based on the selected ratio
        const maxDimension = Math.max(calculatedMaxWidth, calculatedMaxHeight);
        
        if (outputFormat.ratio < 1) {
          // Portrait format
          outputHeightOpt = maxDimension;
          outputWidthOpt = Math.round(outputHeightOpt * outputFormat.ratio);
        } else {
          // Landscape or square format
          outputWidthOpt = maxDimension;
          outputHeightOpt = Math.round(outputWidthOpt / outputFormat.ratio);
        }
        
        console.log(`[ImgProc] Using selected format: ${outputFormat.name}. Target output: ${outputWidthOpt}x${outputHeightOpt}`);
      }

      const result = await applyPerspectiveTransform(
        imageDataURL,
        sortedCorners,
        { outputWidth: outputWidthOpt, outputHeight: outputHeightOpt } // Pass our calculated target dimensions
      );
      
      if (result && result.imageDataURL) {
        return result; // result will contain the actual processedWidth/Height used by OpenCV
      }
      return null;
    } catch (error) {
      console.error("[ImgProc] Error during perspective transform:", error);
      return null;
    } finally {
      isProcessingInternal.value = false;
    }
  }

  /**
   * Handles corner adjustment completion
   * @param newCorners - Adjusted corner coordinates
   */
  function setAdjustedCorners(newCorners: ReadonlyArray<Point> | null): void {
    if (newCorners && newCorners.length === 4) {
      adjustedCornersInternal.value = Object.freeze([...newCorners]);
    } else if (newCorners === null) {
      adjustedCornersInternal.value = null;
    } else {
      console.warn("[ImgProc] Attempted to set invalid adjusted corners.");
    }
  }

  /**
   * Resets image processing state
   */
  function resetActiveImageState(): void {
    console.log("[ImgProc] resetActiveImageState called");
    detectedCornersInternal.value = null;
    adjustedCornersInternal.value = null;
    currentRotationInternal.value = 0;
    isProcessingInternal.value = false;
  }

  /**
   * Updates rotation value
   * @param rotation - New rotation angle in degrees
   */
  function setRotation(rotation: number): void {
    currentRotationInternal.value = (rotation % 360 + 360) % 360;
  }

  // NEW function to sync state from a Page object
  function syncStateFromPage(page: PageType | null): void {
    if (page) {
      console.log("[ImgProc] Syncing state from page:", page.id);
      // Ensure corners are new readonly arrays or null
      detectedCornersInternal.value = page.corners ? Object.freeze([...page.corners]) : null;
      adjustedCornersInternal.value = page.corners ? Object.freeze([...page.corners]) : null;
      currentRotationInternal.value = page.currentRotation;
    } else {
      console.log("[ImgProc] No page to sync from, resetting active image state.");
      resetActiveImageState();
    }
  }

  /**
   * Rotates an image and returns the rotated dataURL
   * @param imageDataURL - Source image data URL
   * @param rotationAngle - Rotation angle in degrees
   * @returns Promise<string> - Rotated image data URL
   */
  async function rotateImageData(imageDataURL: string, rotationAngle: number): Promise<string> {
    if (!isOpenCVReady.value || !imageDataURL) {
      console.warn("[ImgProc] OpenCV not ready or no image data URL for rotation.");
      return imageDataURL; // Return original if can't rotate
    }
    
    try {
      isProcessingInternal.value = true;
      const rotatedDataURL = await rotateImageDataURL(imageDataURL, rotationAngle);
      return rotatedDataURL;
    } catch (error) {
      console.error("[ImgProc] Error during image rotation:", error);
      return imageDataURL; // Return original on error
    } finally {
      isProcessingInternal.value = false;
    }
  }

  /**
   * Transforms corner coordinates to match a rotated image's coordinate system
   * @param corners - Original corner coordinates
   * @param rotationIncrement - Rotation increment in degrees (90, -90, 180)
   * @param originalWidth - Width of the original image
   * @param originalHeight - Height of the original image
   * @returns Transformed corner coordinates
   */
  function transformCornersForRotationIncrement(
    corners: ReadonlyArray<Point> | null,
    rotationIncrement: number,
    originalWidth: number,
    originalHeight: number
  ): ReadonlyArray<Point> | null {
    if (!corners || corners.length !== 4) {
      return null;
    }
    
    const transformedCorners = transformCornersForRotation(
      [...corners], // Convert ReadonlyArray to regular array
      rotationIncrement,
      originalWidth,
      originalHeight
    );
    
    return Object.freeze(transformedCorners) as ReadonlyArray<Point>;
  }

  return {
    detectedCorners,
    adjustedCorners,
    currentRotation,
    isProcessing,

    detectEdges,
    performPerspectiveTransform,
    setAdjustedCorners,
    resetActiveImageState,
    setRotation,
    syncStateFromPage,
    rotateImageData,
    transformCornersForRotationIncrement,
  };
}

export function calculateOriginalAspectRatio(corners: Point[]): number | null {
  if (!corners || corners.length !== 4) {
    console.warn("[calculateOriginalAspectRatio] Requires 4 corner points.");
    return null;
  }

  // Use simple calculation
  return calculateSimpleAspectRatio(corners);
}

// Fallback function for simple aspect ratio calculation
function calculateSimpleAspectRatio(corners: Point[]): number {
  const [tl, tr, br, bl] = corners;
  
  const distPoints = (p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };
  
  const topEdgeLength = distPoints(tl, tr);
  const bottomEdgeLength = distPoints(bl, br);
  const effectiveWidth = Math.max(topEdgeLength, bottomEdgeLength);
  
  const leftEdgeLength = distPoints(tl, bl);
  const rightEdgeLength = distPoints(tr, br);
  const effectiveHeight = Math.max(leftEdgeLength, rightEdgeLength);
  
  if (effectiveHeight === 0) {
    console.warn("[calculateSimpleAspectRatio] Calculated effective height is zero.");
    return 1.0; // Default to square
  }
  
  return effectiveWidth / effectiveHeight;
}
 