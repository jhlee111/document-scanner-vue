import { ref, readonly, type Ref } from 'vue'

export interface FileInputOptions {
  onFilesSelected: (files: File[]) => void
  isOpenCVReady: () => boolean
  cameraInputRef: Ref<HTMLInputElement | null>
  galleryInputRef: Ref<HTMLInputElement | null>
}

export function useFileInput(options: FileInputOptions) {
  // Refs
  const hiddenFileInputRef = ref<HTMLInputElement | null>(null)
  const isProcessing = ref(false)

  // Validate that required dependencies are provided
  const validateDependencies = (): boolean => {
    if (!options.cameraInputRef || !options.galleryInputRef) {
      console.error('[useFileInput] Camera or gallery input refs not provided')
      return false
    }
    return true
  }

  // File input handlers
  const handleDirectFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      handleFilesSelected(Array.from(target.files))
      target.value = '' // Reset file input
    }
  }

  const handleFilesSelected = async (newFiles: File[]) => {
    console.log('[useFileInput] handleFilesSelected with files:', newFiles.length)
    if (newFiles.length === 0) return
    
    // Prevent multiple simultaneous processing
    if (isProcessing.value) {
      console.warn('[useFileInput] Already processing files, ignoring new selection')
      return
    }
    
    // Check if OpenCV is ready before processing
    if (!options.isOpenCVReady()) {
      console.error('[useFileInput] OpenCV is not ready yet. Cannot process files.')
      alert('Scanner is still loading. Please wait a moment and try again.')
      return
    }
    
    try {
      isProcessing.value = true
      console.log('[useFileInput] OpenCV is ready, proceeding with file processing...')
      
      // Filter files to ensure only images are processed
      const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
      
      if (imageFiles.length === 0) {
        console.warn('[useFileInput] No valid image files found')
        alert('Please select valid image files.')
        return
      }
      
      if (imageFiles.length !== newFiles.length) {
        console.warn(`[useFileInput] Filtered ${newFiles.length - imageFiles.length} non-image files`)
      }
      
      await options.onFilesSelected(imageFiles)
    } catch (error) {
      console.error('[useFileInput] Error processing files:', error)
      alert('Error processing files. Please try again.')
    } finally {
      isProcessing.value = false
    }
  }

  // Camera input handler using injected dependency
  const triggerCameraInput = () => {
    if (!validateDependencies()) return
    
    console.log('[useFileInput] Triggering camera input')
    
    if (!options.cameraInputRef) {
      console.error('[useFileInput] Camera input ref is null')
      return
    }
    
    // Set up event listener for camera input
    const handleCameraChange = (event: Event) => {
      const target = event.target as HTMLInputElement
      if (target.files && target.files.length > 0) {
        handleFilesSelected(Array.from(target.files))
        target.value = '' // Reset input
      }
      // Remove event listener after use
      options.cameraInputRef.value?.removeEventListener('change', handleCameraChange)
    }
    
    // Add event listener and trigger click
    options.cameraInputRef.value?.addEventListener('change', handleCameraChange)
    options.cameraInputRef.value?.click()
  }

  // Gallery input handler using injected dependency
  const triggerGalleryInput = () => {
    if (!validateDependencies()) return
    
    console.log('[useFileInput] Triggering gallery input')
    
    if (!options.galleryInputRef) {
      console.error('[useFileInput] Gallery input ref is null')
      return
    }
    
    // Set up event listener for gallery input
    const handleGalleryChange = (event: Event) => {
      const target = event.target as HTMLInputElement
      if (target.files && target.files.length > 0) {
        handleFilesSelected(Array.from(target.files))
        target.value = '' // Reset input
      }
      // Remove event listener after use
      options.galleryInputRef.value?.removeEventListener('change', handleGalleryChange)
    }
    
    // Add event listener and trigger click
    options.galleryInputRef.value?.addEventListener('change', handleGalleryChange)
    options.galleryInputRef.value?.click()
  }

  // Hidden file input handler (for desktop integration)
  const triggerHiddenFileInput = () => {
    if (hiddenFileInputRef.value) {
      console.log('[useFileInput] Triggering hidden file input')
      hiddenFileInputRef.value.click()
    } else {
      console.error('[useFileInput] Hidden file input ref is null or undefined')
    }
  }

  // Setup method to initialize event listeners on the injected inputs
  const setupInputListeners = () => {
    if (!validateDependencies()) return
    
    // Setup camera input
    if (options.cameraInputRef.value) {
      options.cameraInputRef.value.setAttribute('accept', 'image/*')
      options.cameraInputRef.value.setAttribute('capture', 'environment')
      console.log('[useFileInput] Camera input configured with capture attribute')
    }
    
    // Setup gallery input
      if (options.galleryInputRef.value) {
      options.galleryInputRef.value.setAttribute('accept', 'image/*')
      options.galleryInputRef.value.setAttribute('multiple', 'true')
      console.log('[useFileInput] Gallery input configured for multiple image selection')
    }
  }

  // Cleanup method to remove event listeners
  const cleanup = () => {
    // Event listeners are automatically removed after each use,
    // so no persistent cleanup needed
    console.log('[useFileInput] Cleanup completed')
  }

  return {
    // Reactive state (readonly to prevent external mutations)
    isProcessing: readonly(isProcessing),
    
    // Methods
    handleDirectFileChange,
    handleFilesSelected,
    setupInputListeners,
    cleanup,
    triggerCameraInput,
    triggerGalleryInput,
    // Validation
    validateDependencies,
  }
} 