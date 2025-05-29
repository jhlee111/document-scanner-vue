import { ref, computed, nextTick, type ComputedRef, type DeepReadonly, type Ref, watch } from 'vue'
import type { Page, Corners, Point } from '@/types'
import { useImageProcessing } from './useImageProcessing'
import { calculateAreaFromPoints, generateDefaultCornersPx, transformCornersForRotation } from '@/utils/imageProcessing'

export interface ImageOperationsOptions {
  pageManager: {
    pages: ComputedRef<DeepReadonly<Page[]>>
    currentPage: ComputedRef<Page | null>
    updatePageData: (pageId: string, data: any) => void
    getPageById: (pageId: string) => Page | undefined
  }
  isOpenCVReady: Ref<boolean>
  performPerspectiveTransform: (imageDataURL: string, corners: ReadonlyArray<Point>, outputFormat?: any) => Promise<{ imageDataURL: string; processedWidth: number; processedHeight: number } | null>
  rotateImageData: (imageDataURL: string, angle: number) => Promise<string>
  transformCornersForRotationIncrement: (corners: ReadonlyArray<Point> | null, rotationIncrement: number, originalWidth: number, originalHeight: number) => ReadonlyArray<Point> | null
}

export function useImageOperations(options: ImageOperationsOptions) {
  // Processing state
  const isLoading = ref(false)
  const processingStatus = ref('')
  const processingProgress = ref(0)

  // Rotation cache: Map<pageId-rotation, imageDataURL>
  const rotationCache = ref(new Map<string, string>())
  
  // Current rotated image data URL
  const currentRotatedImageDataURL = ref<string | null>(null)

  // Helper function to get cache key
  const getCacheKey = (pageId: string, rotation: number): string => {
    return `${pageId}-${rotation}`
  }

  // Helper function to clear cache for a specific page
  const clearPageCache = (pageId: string) => {
    const keysToDelete = Array.from(rotationCache.value.keys()).filter(key => 
      key.startsWith(`${pageId}-`)
    )
    keysToDelete.forEach(key => {
      const imageDataURL = rotationCache.value.get(key)
      if (imageDataURL && imageDataURL.startsWith('blob:')) {
        URL.revokeObjectURL(imageDataURL)
      }
      rotationCache.value.delete(key)
    })
  }

  // Helper function to clear all cache
  const clearAllCache = () => {
    rotationCache.value.forEach((imageDataURL) => {
      if (imageDataURL.startsWith('blob:')) {
        URL.revokeObjectURL(imageDataURL)
      }
    })
    rotationCache.value.clear()
  }

  const currentDisplayPage = computed(() => {
    return options.pageManager.currentPage.value
  })

  // Function to generate rotated image on-demand
  const generateRotatedImage = async (page: any, rotation: number): Promise<string> => {
    // For 0 rotation, always return original
    if (rotation === 0) {
      return page.originalImageDataURL
    }
    
    // Check cache first
    const cacheKey = getCacheKey(page.id, rotation)
    const cached = rotationCache.value.get(cacheKey)
    if (cached) {
      return cached
    }
    
    // Generate rotation on-demand
    if (!options.isOpenCVReady.value) {
      console.warn('[useImageOperations] OpenCV not ready for rotation generation')
      return page.originalImageDataURL // Fallback to original
    }
    
    try {
      console.log(`[useImageOperations] Generating ${rotation}° rotation for page ${page.id}`)
      const rotatedImageDataURL = await options.rotateImageData(page.originalImageDataURL, rotation)
      
      // Cache the result
      rotationCache.value.set(cacheKey, rotatedImageDataURL)
      
      return rotatedImageDataURL
    } catch (error) {
      console.error(`[useImageOperations] Error generating ${rotation}° rotation:`, error)
      return page.originalImageDataURL // Fallback to original
    }
  }

  // Watch for changes in current page or rotation and update rotated image
  watch(
    () => currentDisplayPage.value ? [currentDisplayPage.value.id, currentDisplayPage.value.currentRotation] : null,
    async (newValue) => {
      if (!newValue || !currentDisplayPage.value) {
        currentRotatedImageDataURL.value = null
        return
      }
      
      const [pageId, rotation] = newValue as [string, 0 | 90 | 180 | 270]
      const page = currentDisplayPage.value
      
      try {
        const rotatedImageURL = await generateRotatedImage(page, rotation)
        currentRotatedImageDataURL.value = rotatedImageURL
      } catch (error) {
        console.error('[useImageOperations] Error updating rotated image:', error)
        currentRotatedImageDataURL.value = page.originalImageDataURL
      }
    },
    { immediate: true }
  )

  const rotatedImageDataURLByRotation = computed(() => {
    return currentRotatedImageDataURL.value
  })

  const imageSrcForPreviewComponent = computed(() => {
    if (!currentDisplayPage.value) return null

    // In preview mode, always show processed image if available
    if (currentDisplayPage.value.mode === 'preview' && currentDisplayPage.value.processedImageDataURL) {
      return currentDisplayPage.value.processedImageDataURL
    }

    // In edit mode, show rotated or original image
    return rotatedImageDataURLByRotation.value
  })

  // Process active page
  const processActivePage = async (outputFormat?: any) => {
    if (!currentDisplayPage.value) {
      console.warn('[useImageOperations] processActivePage: No current page.')
      return
    }
    const pageToProcess = currentDisplayPage.value

    // Use the rotated image if available, otherwise fall back to original
    const imageToProcess = rotatedImageDataURLByRotation.value
    if (!imageToProcess) {
      console.warn('[useImageOperations] processActivePage: No image data available for processing.')
      return
    }

    const cornersToUse = pageToProcess.corners

    if (!cornersToUse || cornersToUse.length !== 4) {
      console.warn(`[useImageOperations] processActivePage: Valid corners not available for page '${pageToProcess.id}'.`)
      return
    }

    isLoading.value = true
    processingStatus.value = 'Processing document...'
    processingProgress.value = 50
    try {
      console.log(`[useImageOperations] Processing page '${pageToProcess.id}' with image:`, imageToProcess === rotatedImageDataURLByRotation.value ? 'rotated' : 'original', 'and corners:', cornersToUse)
      const result = await options.performPerspectiveTransform(
        imageToProcess, // Use rotated image if available
        cornersToUse as ReadonlyArray<Point>, // Already checked length
        outputFormat // Pass the format parameter
      )

      if (!result || !result.imageDataURL) {
        console.error(`[useImageOperations] Perspective transform failed for page '${pageToProcess.id}'.`)
        processingStatus.value = 'Processing failed'
        setTimeout(() => {
          processingStatus.value = ''
          processingProgress.value = 0
        }, 2000)
        isLoading.value = false
        return
      }

      processingProgress.value = 90
      processingStatus.value = 'Finalizing...'

      options.pageManager.updatePageData(pageToProcess.id, {
        processedImageDataURL: result.imageDataURL,
        processedWidth: result.processedWidth,
        processedHeight: result.processedHeight,
        mode: 'preview', // Switch to preview mode after successful processing
      })
      console.log(`[useImageOperations] Page '${pageToProcess.id}' processed successfully.`)

      processingProgress.value = 100
      processingStatus.value = 'Complete!'
      
      // Clear status after a brief delay
      setTimeout(() => {
        processingStatus.value = ''
        processingProgress.value = 0
      }, 500)

    } catch (error) {
      console.error(`[useImageOperations] Error processing page '${pageToProcess.id}':`, error)
      processingStatus.value = 'Error processing document'
      setTimeout(() => {
        processingStatus.value = ''
        processingProgress.value = 0
      }, 2000)
    } finally {
      isLoading.value = false
    }
  }

  // Reset corners for current page
  const resetCornersForCurrentPage = () => {
    if (currentDisplayPage.value) {
      const page = currentDisplayPage.value

      // Create simple default box corners based on current rotated image dimensions
      const imageToUse = rotatedImageDataURLByRotation.value
      if (!imageToUse) {
        console.warn('[useImageOperations] Reset corners: No image data available.')
        return
      }

      // Get dimensions from current rotated image or original
      let width = page.originalWidth
      let height = page.originalHeight

      // For rotated images, we need to get dimensions from the rotated version
      // For now, let's use a simple calculation based on rotation
      if (page.currentRotation === 90 || page.currentRotation === 270) {
        // Swap dimensions for 90/270 degree rotations
        width = page.originalHeight
        height = page.originalWidth
      }

      // Create default box with 10% inset from edges
      const insetRatio = 0.1
      const insetX = width * insetRatio
      const insetY = height * insetRatio

      const defaultCorners: Corners = [
        { x: insetX, y: insetY },
        { x: width - insetX, y: insetY },
        { x: width - insetX, y: height - insetY },
        { x: insetX, y: height - insetY },
      ]

      // Clear adjusted corners and set detected corners to default
      options.pageManager.updatePageData(page.id, {
        corners: defaultCorners,
      })

      console.log(`[useImageOperations] Corners reset to default box for page ${page.id}:`, defaultCorners)
    } else {
      console.warn('[useImageOperations] Reset corners: No current page.')
    }
  }

  // Rotate current page
  const rotateCurrentPage = async (direction: 'left' | 'right') => {
    if (!currentDisplayPage.value) {
      console.warn('[useImageOperations] Rotate: No current page.')
      return
    }

    const page = currentDisplayPage.value
    const rotationIncrement = direction === 'left' ? -90 : 90
    let newRotationAngle = (page.currentRotation + rotationIncrement + 360) % 360 as 0 | 90 | 180 | 270

    if (!page.originalImageDataURL) {
      console.warn('[useImageOperations] Rotate: No original image data available.')
      return
    }

    console.log(`[useImageOperations] Rotating page ${page.id} by ${rotationIncrement}°...`)
    isLoading.value = true
    processingStatus.value = `Rotating image ${rotationIncrement > 0 ? 'right' : 'left'}...`
    processingProgress.value = 30

    try {
      processingProgress.value = 60
      
      // Transform current corners if they exist
      let newAdjustedCorners = undefined

      // Calculate current image dimensions after existing rotation
      let currentWidth = page.originalWidth
      let currentHeight = page.originalHeight

      // Adjust dimensions based on current rotation
      if (page.currentRotation === 90 || page.currentRotation === 270) {
        currentWidth = page.originalHeight
        currentHeight = page.originalWidth
      }

      if (page.corners) {
        console.log(`[useImageOperations] Transforming current corners by ${rotationIncrement}° using dimensions ${currentWidth}x${currentHeight}`)
        const transformedCorners = options.transformCornersForRotationIncrement(
          page.corners,
          rotationIncrement,
          currentWidth,
          currentHeight
        )
        newAdjustedCorners = transformedCorners as Corners | null | undefined
        console.log(`[useImageOperations] Transformed corners:`, newAdjustedCorners)
      }

      processingProgress.value = 90
      
      // Update page with new rotation - the watcher will handle generating the rotated image
      options.pageManager.updatePageData(page.id, {
        currentRotation: newRotationAngle,
        // Clear processed version since rotation invalidates previous processing
        processedImageDataURL: undefined,
        processedWidth: undefined,
        processedHeight: undefined,
        // Use transformed corners or undefined to trigger re-detection
        corners: newAdjustedCorners as Corners | null | undefined
      })

      processingProgress.value = 100
      processingStatus.value = 'Rotation complete!'
      console.log(`[useImageOperations] Successfully rotated page ${page.id} to ${newRotationAngle}°, corners ${newAdjustedCorners ? 'transformed (adjusted)' : 'reset for re-detection'}`)
      
      // Clear status after a brief delay
      setTimeout(() => {
        processingStatus.value = ''
        processingProgress.value = 0
      }, 500)
    } catch (error) {
      console.error(`[useImageOperations] Error rotating page ${page.id}:`, error)
      processingStatus.value = 'Rotation failed'
      // Revert rotation angle on error
      options.pageManager.updatePageData(page.id, { currentRotation: page.currentRotation })
      setTimeout(() => {
        processingStatus.value = ''
        processingProgress.value = 0
      }, 2000)
    } finally {
      isLoading.value = false
    }
  }

  // Apply perspective transform and get data URL
  const applyPerspectiveTransformAndGetDataURL = async (pageId: string): Promise<string | null> => {
    const page = options.pageManager.getPageById(pageId)
    if (!page) {
      console.error('Cannot apply perspective transform: page not found for id', pageId)
      return null
    }
    if (!page.corners) {
      console.error('Cannot apply perspective transform: corners are null for page', page.id)
      return null
    }
    try {
      const processedImage = await options.performPerspectiveTransform(page.originalImageDataURL, page.corners)
      if (processedImage) {
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = (err) => {
            console.error("Error loading processed image to get dimensions:", err)
            reject(err) 
          }
          img.src = processedImage.imageDataURL
        })
        options.pageManager.updatePageData(page.id, {
          processedImageDataURL: processedImage.imageDataURL,
          processedWidth: img.naturalWidth,
          processedHeight: img.naturalHeight,
          mode: 'preview'
        })
      }
      return processedImage?.imageDataURL || null
    } catch (error) {
      console.error('Error applying perspective transform for page:', page.id, error)
      options.pageManager.updatePageData(page.id, { mode: 'edit' })
      return null
    }
  }

  return {
    // State
    isLoading,
    processingStatus,
    processingProgress,
    
    // Computed
    currentDisplayPage,
    rotatedImageDataURLByRotation,
    imageSrcForPreviewComponent,
    
    // Methods
    processActivePage,
    resetCornersForCurrentPage,
    rotateCurrentPage,
    applyPerspectiveTransformAndGetDataURL,
    
    // Cache management
    clearPageCache,
    clearAllCache
  }
} 