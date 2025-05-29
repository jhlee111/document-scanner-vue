import { watch } from 'vue'
import type { Ref } from 'vue'
import type { Corners } from '../types'
import { generateDefaultCornersPx, transformCornersForRotation, calculateAreaFromPoints } from '../utils/imageProcessing'

interface PageData {
  id: string
  mode: string
  corners: Corners | null
  originalWidth: number
  originalHeight: number
  currentRotation: number
}

interface PageManager {
  currentPage: Ref<any>
  updatePageData: (pageId: string, updates: any) => void
}

interface UseCornerValidationOptions {
  currentDisplayPage: Ref<PageData | null>
  pageManager: PageManager
}

export function useCornerValidation({ currentDisplayPage, pageManager }: UseCornerValidationOptions) {
  // Watch for changes to the current display page and validate/fix corners
  watch(currentDisplayPage, (newPageData) => {
    if (newPageData && newPageData.id && newPageData.mode === 'edit') {
      let updateNeeded = false
      let cornersToSet: Corners | null = newPageData.corners

      if (!newPageData.corners) {
        console.log(`[useCornerValidation] Watcher: corners for page ${newPageData.id} are null. Setting default.`)
        const defaultBase = generateDefaultCornersPx(newPageData.originalWidth, newPageData.originalHeight, 32)
        const defaultDisplay = transformCornersForRotation(defaultBase, newPageData.currentRotation, newPageData.originalWidth, newPageData.originalHeight)
        
        cornersToSet = defaultDisplay
        updateNeeded = true
      } else {
        const displayArea = calculateAreaFromPoints(newPageData.corners)
        const currentViewWidth = (newPageData.currentRotation === 90 || newPageData.currentRotation === 270) ? newPageData.originalHeight : newPageData.originalWidth
        const currentViewHeight = (newPageData.currentRotation === 90 || newPageData.currentRotation === 270) ? newPageData.originalWidth : newPageData.originalHeight
        const imageArea = currentViewWidth * currentViewHeight
        
        // Use adaptive area threshold based on image resolution (same logic as corner detection)
        const isHighResolution = imageArea > 8000000; // 8MP+ (likely mobile camera)
        const isMediumResolution = imageArea > 2000000; // 2MP+ 
        
        let areaThresholdMultiplier = 0.05; // Default 5% for low-res images
        if (isHighResolution) {
          // For high-res images (mobile camera), use much lower threshold
          areaThresholdMultiplier = 0.005; // 0.5% - 10x more lenient
        } else if (isMediumResolution) {
          // For medium-res images, use moderately lower threshold
          areaThresholdMultiplier = 0.025; // 2.5% - 2x more lenient
        }
        
        const areaThreshold = imageArea * areaThresholdMultiplier

        if (displayArea < areaThreshold) {
          console.warn(`[useCornerValidation] Watcher: corners area for page ${newPageData.id} is too small (${displayArea} < ${areaThreshold}). Resetting to default. Image: ${isHighResolution ? 'High-res' : isMediumResolution ? 'Medium-res' : 'Low-res'} (${currentViewWidth}x${currentViewHeight})`)
          const defaultBase = generateDefaultCornersPx(newPageData.originalWidth, newPageData.originalHeight, 32)
          const defaultDisplay = transformCornersForRotation(defaultBase, newPageData.currentRotation, newPageData.originalWidth, newPageData.originalHeight)
          
          cornersToSet = defaultDisplay
          updateNeeded = true
        }
      }

      if (updateNeeded && pageManager.currentPage.value && pageManager.currentPage.value.id === newPageData.id) {
        pageManager.updatePageData(newPageData.id, { 
          corners: cornersToSet,
        })
      }
    }
  }, { immediate: false, deep: true })

  return {
    // This composable primarily sets up the watcher
    // Could expose validation utilities if needed in the future
  }
} 