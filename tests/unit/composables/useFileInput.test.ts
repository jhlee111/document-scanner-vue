import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, shallowRef, type Ref } from 'vue'
import { useFileInput, type FileInputOptions } from '@/composables/useFileInput'

// Mock console methods to avoid noise in tests
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
}

// Mock alert to prevent actual alerts during tests
const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

describe('useFileInput Security and Behavior Tests', () => {
  let mockOnFilesSelected: ReturnType<typeof vi.fn>
  let mockIsOpenCVReady: ReturnType<typeof vi.fn>
  let mockCameraInputRef: ReturnType<typeof ref<HTMLInputElement | null>>
  let mockGalleryInputRef: ReturnType<typeof ref<HTMLInputElement | null>>
  let mockCameraElement: HTMLInputElement
  let mockGalleryElement: HTMLInputElement
  let options: FileInputOptions

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Create mock functions
    mockOnFilesSelected = vi.fn()
    mockIsOpenCVReady = vi.fn().mockReturnValue(true)
    
    // Create mock DOM elements
    mockCameraElement = document.createElement('input')
    mockCameraElement.type = 'file'
    mockGalleryElement = document.createElement('input')
    mockGalleryElement.type = 'file'
    
    // Create refs
    mockCameraInputRef = shallowRef<HTMLInputElement | null>(mockCameraElement)
    mockGalleryInputRef = shallowRef<HTMLInputElement | null>(mockGalleryElement)
    
    // Setup options
    options = {
      onFilesSelected: mockOnFilesSelected,
      isOpenCVReady: mockIsOpenCVReady,
      cameraInputRef: mockCameraInputRef,
      galleryInputRef: mockGalleryInputRef
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('File Type Security Validation', () => {
    it('should reject non-image files and only process valid images', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      // Create mock files with different types
      const validImageFile = new File(['image data'], 'test.jpg', { type: 'image/jpeg' })
      const invalidTextFile = new File(['text data'], 'test.txt', { type: 'text/plain' })
      const invalidPdfFile = new File(['pdf data'], 'test.pdf', { type: 'application/pdf' })
      const validPngFile = new File(['png data'], 'test.png', { type: 'image/png' })
      
      const mixedFiles = [validImageFile, invalidTextFile, invalidPdfFile, validPngFile]
      
      await handleFilesSelected(mixedFiles)
      
      // Should only process the 2 valid image files
      expect(mockOnFilesSelected).toHaveBeenCalledWith([validImageFile, validPngFile])
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Filtered 2 non-image files')
      )
    })

    it('should reject all files if none are valid images', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      const invalidFiles = [
        new File(['text'], 'test.txt', { type: 'text/plain' }),
        new File(['pdf'], 'test.pdf', { type: 'application/pdf' }),
        new File(['video'], 'test.mp4', { type: 'video/mp4' })
      ]
      
      await handleFilesSelected(invalidFiles)
      
      expect(mockOnFilesSelected).not.toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalledWith('Please select valid image files.')
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('No valid image files found')
      )
    })

    it('should accept various valid image MIME types', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      const validImageFiles = [
        new File(['jpeg'], 'test.jpg', { type: 'image/jpeg' }),
        new File(['png'], 'test.png', { type: 'image/png' }),
        new File(['gif'], 'test.gif', { type: 'image/gif' }),
        new File(['webp'], 'test.webp', { type: 'image/webp' }),
        new File(['bmp'], 'test.bmp', { type: 'image/bmp' })
      ]
      
      await handleFilesSelected(validImageFiles)
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith(validImageFiles)
    })

    it('should handle malformed MIME types gracefully', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      // File with malformed MIME type
      const malformedFile = new File(['data'], 'test.jpg', { type: 'malformed/type' })
      const validFile = new File(['image'], 'valid.jpg', { type: 'image/jpeg' })
      
      await handleFilesSelected([malformedFile, validFile])
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith([validFile])
    })
  })

  describe('OpenCV Dependency and Error Handling', () => {
    it('should prevent file processing when OpenCV is not ready', async () => {
      mockIsOpenCVReady.mockReturnValue(false)
      const { handleFilesSelected } = useFileInput(options)
      
      const validFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
      
      await handleFilesSelected([validFile])
      
      expect(mockOnFilesSelected).not.toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalledWith(
        'Scanner is still loading. Please wait a moment and try again.'
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('OpenCV is not ready yet')
      )
    })

    it('should handle errors during file processing gracefully', async () => {
      mockOnFilesSelected.mockRejectedValue(new Error('Processing failed'))
      const { handleFilesSelected } = useFileInput(options)
      
      const validFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
      
      await handleFilesSelected([validFile])
      
      expect(alertSpy).toHaveBeenCalledWith('Error processing files. Please try again.')
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing files'),
        expect.any(Error)
      )
    })

    it('should reset processing state after error', async () => {
      mockOnFilesSelected.mockRejectedValue(new Error('Processing failed'))
      const { handleFilesSelected, isProcessing } = useFileInput(options)
      
      const validFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
      
      expect(isProcessing.value).toBe(false)
      
      await handleFilesSelected([validFile])
      
      // Should be false again after error handling
      expect(isProcessing.value).toBe(false)
    })
  })

  describe('Concurrent Processing Protection', () => {
    it('should prevent multiple simultaneous file processing', async () => {
      let resolveProcessing: () => void
      const processingPromise = new Promise<void>((resolve) => {
        resolveProcessing = resolve
      })
      
      mockOnFilesSelected.mockImplementation(() => processingPromise)
      const { handleFilesSelected, isProcessing } = useFileInput(options)
      
      const file1 = new File(['image1'], 'test1.jpg', { type: 'image/jpeg' })
      const file2 = new File(['image2'], 'test2.jpg', { type: 'image/jpeg' })
      
      // Start first processing
      const firstCall = handleFilesSelected([file1])
      expect(isProcessing.value).toBe(true)
      
      // Try to start second processing while first is ongoing
      await handleFilesSelected([file2])
      
      // Second call should be ignored
      expect(mockOnFilesSelected).toHaveBeenCalledTimes(1)
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already processing files, ignoring new selection')
      )
      
      // Complete first processing
      resolveProcessing!()
      await firstCall
      expect(isProcessing.value).toBe(false)
    })
  })

  describe('Mobile Camera Integration', () => {
    it('should configure camera input with proper attributes for mobile', () => {
      const { setupInputListeners } = useFileInput(options)
      
      setupInputListeners()
      
      expect(mockCameraElement.getAttribute('accept')).toBe('image/*')
      expect(mockCameraElement.getAttribute('capture')).toBe('environment')
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Camera input configured with capture attribute')
      )
    })

    it('should configure gallery input for multiple file selection', () => {
      const { setupInputListeners } = useFileInput(options)
      
      setupInputListeners()
      
      expect(mockGalleryElement.getAttribute('accept')).toBe('image/*')
      expect(mockGalleryElement.getAttribute('multiple')).toBe('true')
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Gallery input configured for multiple image selection')
      )
    })

    it('should trigger camera input and handle file selection', () => {
      const { triggerCameraInput } = useFileInput(options)
      const clickSpy = vi.spyOn(mockCameraElement, 'click').mockImplementation(() => {})
      
      triggerCameraInput()
      
      expect(clickSpy).toHaveBeenCalled()
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Triggering camera input')
      )
    })

    it('should trigger gallery input and handle file selection', () => {
      const { triggerGalleryInput } = useFileInput(options)
      const clickSpy = vi.spyOn(mockGalleryElement, 'click').mockImplementation(() => {})
      
      triggerGalleryInput()
      
      expect(clickSpy).toHaveBeenCalled()
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Triggering gallery input')
      )
    })
  })

  describe('Input Reference Validation', () => {
    it('should validate dependencies and return false when refs are missing', () => {
      const invalidOptions = {
        ...options,
        cameraInputRef: ref(null),
        galleryInputRef: ref(null)
      }
      
      const { validateDependencies } = useFileInput(invalidOptions)
      
      expect(validateDependencies()).toBe(false)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Camera or gallery input refs not provided')
      )
    })

    it('should handle null camera input ref gracefully', () => {
      const optionsWithNullCamera = {
        ...options,
        cameraInputRef: ref(null)
      }
      
      const { triggerCameraInput } = useFileInput(optionsWithNullCamera)
      
      triggerCameraInput()
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Camera input ref is null')
      )
    })

    it('should handle null gallery input ref gracefully', () => {
      const optionsWithNullGallery = {
        ...options,
        galleryInputRef: ref(null)
      }
      
      const { triggerGalleryInput } = useFileInput(optionsWithNullGallery)
      
      triggerGalleryInput()
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Gallery input ref is null')
      )
    })
  })

  describe('Event Handling and Cleanup', () => {
    it('should handle direct file change events', () => {
      const { handleDirectFileChange } = useFileInput(options)
      
      const mockEvent = {
        target: {
          files: [new File(['image'], 'test.jpg', { type: 'image/jpeg' })],
          value: 'test.jpg'
        }
      } as unknown as Event
      
      handleDirectFileChange(mockEvent)
      
      // Should reset the input value
      expect((mockEvent.target as HTMLInputElement).value).toBe('')
    })

    it('should handle empty file selection gracefully', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      await handleFilesSelected([])
      
      expect(mockOnFilesSelected).not.toHaveBeenCalled()
    })

    it('should remove event listeners after camera input use', () => {
      const { triggerCameraInput } = useFileInput(options)
      const removeEventListenerSpy = vi.spyOn(mockCameraElement, 'removeEventListener')
      
      triggerCameraInput()
      
      // Simulate file selection
      const changeEvent = new Event('change')
      Object.defineProperty(changeEvent, 'target', {
        value: {
          files: [new File(['image'], 'test.jpg', { type: 'image/jpeg' })],
          value: 'test.jpg'
        }
      })
      
      mockCameraElement.dispatchEvent(changeEvent)
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('should remove event listeners after gallery input use', () => {
      const { triggerGalleryInput } = useFileInput(options)
      const removeEventListenerSpy = vi.spyOn(mockGalleryElement, 'removeEventListener')
      
      triggerGalleryInput()
      
      // Simulate file selection
      const changeEvent = new Event('change')
      Object.defineProperty(changeEvent, 'target', {
        value: {
          files: [new File(['image'], 'test.jpg', { type: 'image/jpeg' })],
          value: 'test.jpg'
        }
      })
      
      mockGalleryElement.dispatchEvent(changeEvent)
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('Edge Cases and Robustness', () => {
    it('should handle files with empty names', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      const fileWithEmptyName = new File(['image'], '', { type: 'image/jpeg' })
      
      await handleFilesSelected([fileWithEmptyName])
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith([fileWithEmptyName])
    })

    it('should handle very large file names', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      const longFileName = 'a'.repeat(1000) + '.jpg'
      const fileWithLongName = new File(['image'], longFileName, { type: 'image/jpeg' })
      
      await handleFilesSelected([fileWithLongName])
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith([fileWithLongName])
    })

    it('should handle files with special characters in names', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      const specialCharFile = new File(['image'], 'test@#$%^&*().jpg', { type: 'image/jpeg' })
      
      await handleFilesSelected([specialCharFile])
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith([specialCharFile])
    })

    it('should maintain readonly state for isProcessing', () => {
      const { isProcessing } = useFileInput(options)
      
      // Should not be able to modify the readonly ref
      expect(() => {
        // @ts-expect-error - Testing readonly behavior
        isProcessing.value = true
      }).toThrow()
    })
  })

  describe('Performance and Memory Considerations', () => {
    it('should handle multiple files efficiently', async () => {
      const { handleFilesSelected } = useFileInput(options)
      
      // Create array of 10 files
      const multipleFiles = Array.from({ length: 10 }, (_, i) => 
        new File(['image'], `test${i}.jpg`, { type: 'image/jpeg' })
      )
      
      await handleFilesSelected(multipleFiles)
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith(multipleFiles)
      expect(mockOnFilesSelected).toHaveBeenCalledTimes(1)
    })

    it('should reset input values to prevent memory leaks', () => {
      const { handleDirectFileChange } = useFileInput(options)
      
      const mockInput = document.createElement('input')
      mockInput.type = 'file'
      mockInput.value = 'test.jpg'
      
      const mockEvent = {
        target: {
          ...mockInput,
          files: [new File(['image'], 'test.jpg', { type: 'image/jpeg' })]
        }
      } as unknown as Event
      
      handleDirectFileChange(mockEvent)
      
      expect((mockEvent.target as HTMLInputElement).value).toBe('')
    })
  })
}) 