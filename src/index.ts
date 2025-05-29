import DocumentScanner from './DocumentScanner.vue'
import ImagePreview from './components/ImagePreview.vue'

// Import custom CSS to ensure it's bundled
import './assets/custom-styles.css'

// Primary exports - main component and useful sub-components
export { 
  DocumentScanner,
  ImagePreview  // Useful for building custom UIs with corner detection
}

// Default export
export default DocumentScanner

// Export composables - for building custom document scanner UIs
export { usePageManager } from './composables/usePageManager'
export { useImageProcessing } from './composables/useImageProcessing'
export { useOpenCV } from '@jhlee111/vue-opencv-composable'
export { useKeyboardNavigation } from './composables/useKeyboardNavigation'
export { useCornerValidation } from './composables/useCornerValidation'

// Export utilities - for custom image processing workflows
export { 
  detectDocumentCorners, 
  rotateImageDataURL 
} from './utils/opencvUtils'
export { 
  generateDefaultCornersPx, 
  transformCornersForRotation, 
  transformDisplayCornersToBase,
  calculateAreaFromPoints,
  sortCornersForConsistentOrientation
} from './utils/imageProcessing'
export { 
  generatePdfFromProcessedPages,
  type ProcessedPageData 
} from './utils/pdfGenerator'
export { revokeObjectURL } from './utils/fileHelpers'

// Export types - essential for TypeScript users
export * from './types'