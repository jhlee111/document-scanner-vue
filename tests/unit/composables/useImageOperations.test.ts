import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import { useImageOperations } from '@/composables/useImageOperations'
import type { Page, Corners, Point } from '@/types'

// Mock timers for setTimeout testing
vi.useFakeTimers()

describe('useImageOperations', () => {
  let mockPageManager: any
  let mockOptions: any
  let mockPage: Page
  let mockPerformPerspectiveTransform: any
  let mockRotateImageData: any
  let mockTransformCornersForRotationIncrement: any
  let pages: any
  let currentPage: any

  beforeEach(() => {
    // Create mock file
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // Create mock page data
    mockPage = {
      id: 'test-page-1',
      originalFile: mockFile,
      originalFileName: 'test.jpg',
      originalImageDataURL: 'data:image/jpeg;base64,original',
      processedImageDataURL: 'data:image/jpeg;base64,processed',
      originalWidth: 800,
      originalHeight: 600,
      processedWidth: 400,
      processedHeight: 300,
      currentRotation: 0 as 0 | 90 | 180 | 270,
      mode: 'edit' as 'edit' | 'preview',
      corners: [
        { x: 100, y: 100 },
        { x: 700, y: 100 },
        { x: 700, y: 500 },
        { x: 100, y: 500 }
      ] as Corners,
      timestampAdded: Date.now()
    }

    // Create reactive refs for proper isolation
    pages = ref([mockPage])
    currentPage = ref(mockPage)
    
    mockPageManager = {
      pages: computed(() => pages.value),
      currentPage: computed(() => currentPage.value),
      updatePageData: vi.fn((pageId: string, updates: any) => {
        const pageIndex = pages.value.findIndex((p: Page) => p.id === pageId)
        if (pageIndex !== -1) {
          pages.value[pageIndex] = { ...pages.value[pageIndex], ...updates }
          if (currentPage.value?.id === pageId) {
            currentPage.value = { ...currentPage.value, ...updates }
          }
        }
      }),
      getPageById: vi.fn((pageId: string) => pages.value.find((p: Page) => p.id === pageId))
    }

    // Create mock functions
    mockPerformPerspectiveTransform = vi.fn().mockResolvedValue({
      imageDataURL: 'data:image/jpeg;base64,transformed',
      processedWidth: 400,
      processedHeight: 300
    })

    mockRotateImageData = vi.fn().mockResolvedValue('data:image/jpeg;base64,rotated')

    mockTransformCornersForRotationIncrement = vi.fn().mockReturnValue([
      { x: 50, y: 50 },
      { x: 350, y: 50 },
      { x: 350, y: 250 },
      { x: 50, y: 250 }
    ])

    // Create mock options
    mockOptions = {
      pageManager: mockPageManager,
      isOpenCVReady: ref(true),
      performPerspectiveTransform: mockPerformPerspectiveTransform,
      rotateImageData: mockRotateImageData,
      transformCornersForRotationIncrement: mockTransformCornersForRotationIncrement
    }

    // Mock Image constructor
    const MockImage = vi.fn().mockImplementation(() => ({
      onload: null,
      onerror: null,
      src: '',
      naturalWidth: 400,
      naturalHeight: 300
    }))
    vi.stubGlobal('Image', MockImage)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.unstubAllGlobals()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { isLoading, processingStatus, processingProgress } = useImageOperations(mockOptions)

      expect(isLoading.value).toBe(false)
      expect(processingStatus.value).toBe('')
      expect(processingProgress.value).toBe(0)
    })
  })

  describe('computed properties', () => {
    describe('currentDisplayPage', () => {
      it('should return current page', () => {
        const { currentDisplayPage } = useImageOperations(mockOptions)

        expect(currentDisplayPage.value).toEqual(mockPage)
      })

      it('should return null when no current page', () => {
        currentPage.value = null
        const { currentDisplayPage } = useImageOperations(mockOptions)

        expect(currentDisplayPage.value).toBeNull()
      })
    })

    describe('rotatedImageDataURLByRotation', () => {
      it('should return original image for 0° rotation', async () => {
        const { rotatedImageDataURLByRotation } = useImageOperations(mockOptions)
        
        // Wait for watcher to process
        await nextTick()
        await nextTick()

        expect(rotatedImageDataURLByRotation.value).toBe(mockPage.originalImageDataURL)
      })

      it('should generate and return rotated image for non-zero rotations', async () => {
        currentPage.value = { ...mockPage, currentRotation: 90 }
        const { rotatedImageDataURLByRotation } = useImageOperations(mockOptions)

        // Wait for watcher to process
        await nextTick()
        await nextTick()

        expect(mockRotateImageData).toHaveBeenCalledWith(mockPage.originalImageDataURL, 90)
        expect(rotatedImageDataURLByRotation.value).toBe('data:image/jpeg;base64,rotated')
      })

      it('should return null when no current page', () => {
        currentPage.value = null
        const { rotatedImageDataURLByRotation } = useImageOperations(mockOptions)

        expect(rotatedImageDataURLByRotation.value).toBeNull()
      })

      it('should fallback to original image when OpenCV not ready', async () => {
        mockOptions.isOpenCVReady.value = false
        currentPage.value = { ...mockPage, currentRotation: 90 }
        const { rotatedImageDataURLByRotation } = useImageOperations(mockOptions)

        // Wait for watcher to process
        await nextTick()
        await nextTick()

        expect(rotatedImageDataURLByRotation.value).toBe(mockPage.originalImageDataURL)
      })
    })

    describe('imageSrcForPreviewComponent', () => {
      it('should return processed image in preview mode', async () => {
        currentPage.value = { ...mockPage, mode: 'preview' }
        const { imageSrcForPreviewComponent } = useImageOperations(mockOptions)

        await nextTick()

        expect(imageSrcForPreviewComponent.value).toBe(mockPage.processedImageDataURL)
      })

      it('should return rotated image in edit mode', async () => {
        currentPage.value = { ...mockPage, mode: 'edit' }
        const { imageSrcForPreviewComponent } = useImageOperations(mockOptions)

        // Wait for watcher to process
        await nextTick()
        await nextTick()

        expect(imageSrcForPreviewComponent.value).toBe(mockPage.originalImageDataURL)
      })

      it('should return null when no current page', () => {
        currentPage.value = null
        const { imageSrcForPreviewComponent } = useImageOperations(mockOptions)

        expect(imageSrcForPreviewComponent.value).toBeNull()
      })

      it('should return rotated image when in preview mode but no processed image', async () => {
        currentPage.value = { ...mockPage, mode: 'preview', processedImageDataURL: null }
        const { imageSrcForPreviewComponent } = useImageOperations(mockOptions)

        // Wait for watcher to process
        await nextTick()
        await nextTick()

        expect(imageSrcForPreviewComponent.value).toBe(mockPage.originalImageDataURL)
      })
    })
  })

  describe('processActivePage', () => {
    it('should process page successfully', async () => {
      const { processActivePage, isLoading, processingStatus, processingProgress } = useImageOperations(mockOptions)

      // Wait for initial watcher to complete
      await nextTick()

      // Start processing but don't await yet
      const processPromise = processActivePage()
      
      // Check that loading state is set synchronously
      expect(isLoading.value).toBe(true)
      expect(processingStatus.value).toBe('Processing document...')
      expect(processingProgress.value).toBe(50)

      await processPromise

      // Check perspective transform was called correctly
      expect(mockPerformPerspectiveTransform).toHaveBeenCalledWith(
        mockPage.originalImageDataURL,
        mockPage.corners,
        undefined
      )

      // Check page data was updated
      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, {
        processedImageDataURL: 'data:image/jpeg;base64,transformed',
        processedWidth: 400,
        processedHeight: 300,
        mode: 'preview'
      })

      expect(isLoading.value).toBe(false)
      expect(processingProgress.value).toBe(100)
      expect(processingStatus.value).toBe('Complete!')

      // Fast-forward timers to check status clearing
      vi.advanceTimersByTime(500)
      expect(processingStatus.value).toBe('')
      expect(processingProgress.value).toBe(0)
    })

    it('should handle no current page', async () => {
      currentPage.value = null
      const { processActivePage } = useImageOperations(mockOptions)

      await processActivePage()

      expect(mockPerformPerspectiveTransform).not.toHaveBeenCalled()
      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })

    it('should handle no image data', async () => {
      const { processActivePage, rotatedImageDataURLByRotation } = useImageOperations(mockOptions)
      
      // Mock rotatedImageDataURLByRotation to return null
      Object.defineProperty(rotatedImageDataURLByRotation, 'value', {
        get: () => null,
        configurable: true
      })

      await processActivePage()

      expect(mockPerformPerspectiveTransform).not.toHaveBeenCalled()
      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })

    it('should handle invalid corners', async () => {
      currentPage.value = { ...mockPage, corners: null }
      const { processActivePage } = useImageOperations(mockOptions)

      await processActivePage()

      expect(mockPerformPerspectiveTransform).not.toHaveBeenCalled()
      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })

    it('should handle perspective transform failure', async () => {
      mockPerformPerspectiveTransform.mockResolvedValue(null)
      const { processActivePage, processingStatus } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      await processActivePage()

      expect(processingStatus.value).toBe('Processing failed')
      
      vi.advanceTimersByTime(2000)
      expect(processingStatus.value).toBe('')
    })

    it('should handle perspective transform error', async () => {
      mockPerformPerspectiveTransform.mockRejectedValue(new Error('Transform failed'))
      const { processActivePage, processingStatus } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      await processActivePage()

      expect(processingStatus.value).toBe('Error processing document')
      
      vi.advanceTimersByTime(2000)
      expect(processingStatus.value).toBe('')
    })
  })

  describe('resetCornersForCurrentPage', () => {
    it('should reset corners for current page', async () => {
      const { resetCornersForCurrentPage, rotatedImageDataURLByRotation } = useImageOperations(mockOptions)

      // Wait for initial watcher and ensure rotated image is available
      await nextTick()
      await nextTick()
      
      // Ensure rotatedImageDataURLByRotation has a value
      expect(rotatedImageDataURLByRotation.value).toBe(mockPage.originalImageDataURL)

      resetCornersForCurrentPage()

      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, {
        corners: [
          { x: 80, y: 60 },
          { x: 720, y: 60 },
          { x: 720, y: 540 },
          { x: 80, y: 540 }
        ]
      })
    })

    it('should handle rotated image dimensions', async () => {
      currentPage.value = { ...mockPage, currentRotation: 90 }
      const { resetCornersForCurrentPage, rotatedImageDataURLByRotation } = useImageOperations(mockOptions)

      // Wait for initial watcher and ensure rotated image is available
      await nextTick()
      await nextTick()
      
      // Ensure rotatedImageDataURLByRotation has a value
      expect(rotatedImageDataURLByRotation.value).toBeTruthy()

      resetCornersForCurrentPage()

      // For 90° rotation, width and height are swapped
      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, {
        corners: [
          { x: 60, y: 80 },
          { x: 540, y: 80 },
          { x: 540, y: 720 },
          { x: 60, y: 720 }
        ]
      })
    })

    it('should handle no current page', () => {
      currentPage.value = null
      const { resetCornersForCurrentPage } = useImageOperations(mockOptions)

      resetCornersForCurrentPage()

      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })

    it('should handle no image data', async () => {
      const { resetCornersForCurrentPage, rotatedImageDataURLByRotation } = useImageOperations(mockOptions)

      // Mock rotatedImageDataURLByRotation to return null
      Object.defineProperty(rotatedImageDataURLByRotation, 'value', {
        get: () => null,
        configurable: true
      })

      resetCornersForCurrentPage()

      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })
  })

  describe('rotateCurrentPage', () => {
    it('should rotate page right successfully', async () => {
      const { rotateCurrentPage, isLoading, processingStatus, currentDisplayPage } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      // Ensure we have a valid page with originalImageDataURL
      expect(currentDisplayPage.value).toBeTruthy()
      expect(currentDisplayPage.value?.originalImageDataURL).toBe('data:image/jpeg;base64,original')

      // Call rotation function
      await rotateCurrentPage('right')

      expect(mockTransformCornersForRotationIncrement).toHaveBeenCalledWith(
        mockPage.corners,
        90,
        800,
        600
      )

      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, {
        currentRotation: 90,
        processedImageDataURL: undefined,
        processedWidth: undefined,
        processedHeight: undefined,
        corners: [
          { x: 50, y: 50 },
          { x: 350, y: 50 },
          { x: 350, y: 250 },
          { x: 50, y: 250 }
        ]
      })

      // After completion, loading should be false
      expect(isLoading.value).toBe(false)
      expect(processingStatus.value).toBe('Rotation complete!')

      vi.advanceTimersByTime(500)
      expect(processingStatus.value).toBe('')
    })

    it('should rotate page left successfully', async () => {
      const { rotateCurrentPage } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      await rotateCurrentPage('left')

      expect(mockTransformCornersForRotationIncrement).toHaveBeenCalledWith(
        mockPage.corners,
        -90,
        800,
        600
      )

      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, {
        currentRotation: 270,
        processedImageDataURL: undefined,
        processedWidth: undefined,
        processedHeight: undefined,
        corners: [
          { x: 50, y: 50 },
          { x: 350, y: 50 },
          { x: 350, y: 250 },
          { x: 50, y: 250 }
        ]
      })
    })

    it('should handle rotation from 270° to 0°', async () => {
      currentPage.value = { ...mockPage, currentRotation: 270 }
      const { rotateCurrentPage } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      await rotateCurrentPage('right')

      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, expect.objectContaining({
        currentRotation: 0
      }))
    })

    it('should handle no current page', async () => {
      currentPage.value = null
      const { rotateCurrentPage } = useImageOperations(mockOptions)

      await rotateCurrentPage('right')

      expect(mockTransformCornersForRotationIncrement).not.toHaveBeenCalled()
      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })

    it('should handle no original image data', async () => {
      currentPage.value = { ...mockPage, originalImageDataURL: '' }
      const { rotateCurrentPage } = useImageOperations(mockOptions)

      await rotateCurrentPage('right')

      expect(mockTransformCornersForRotationIncrement).not.toHaveBeenCalled()
      expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
    })

    it('should handle rotation error', async () => {
      // Mock an error in the rotation process by making updatePageData throw
      mockPageManager.updatePageData.mockImplementationOnce(() => {
        throw new Error('Update failed')
      })
      
      const { rotateCurrentPage, processingStatus } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      await rotateCurrentPage('right')

      expect(processingStatus.value).toBe('Rotation failed')
      
      vi.advanceTimersByTime(2000)
      expect(processingStatus.value).toBe('')
    })

    it('should handle page without corners', async () => {
      currentPage.value = { ...mockPage, corners: null }
      const { rotateCurrentPage } = useImageOperations(mockOptions)

      // Wait for initial watcher
      await nextTick()

      await rotateCurrentPage('right')

      expect(mockTransformCornersForRotationIncrement).not.toHaveBeenCalled()
      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, expect.objectContaining({
        corners: undefined
      }))
    })
  })

  describe('applyPerspectiveTransformAndGetDataURL', () => {
    it('should handle page not found', async () => {
      mockPageManager.getPageById.mockReturnValue(undefined)
      const { applyPerspectiveTransformAndGetDataURL } = useImageOperations(mockOptions)

      const result = await applyPerspectiveTransformAndGetDataURL('non-existent')

      expect(result).toBeNull()
      expect(mockPerformPerspectiveTransform).not.toHaveBeenCalled()
    })

    it('should handle page without corners', async () => {
      mockPageManager.getPageById.mockReturnValue({ ...mockPage, corners: null })
      const { applyPerspectiveTransformAndGetDataURL } = useImageOperations(mockOptions)

      const result = await applyPerspectiveTransformAndGetDataURL(mockPage.id)

      expect(result).toBeNull()
      expect(mockPerformPerspectiveTransform).not.toHaveBeenCalled()
    })

    it('should handle perspective transform failure', async () => {
      mockPerformPerspectiveTransform.mockResolvedValue(null)
      const { applyPerspectiveTransformAndGetDataURL } = useImageOperations(mockOptions)

      const result = await applyPerspectiveTransformAndGetDataURL(mockPage.id)

      expect(result).toBeNull()
    })

    it('should handle perspective transform error', async () => {
      mockPerformPerspectiveTransform.mockRejectedValue(new Error('Transform failed'))
      const { applyPerspectiveTransformAndGetDataURL } = useImageOperations(mockOptions)

      const result = await applyPerspectiveTransformAndGetDataURL(mockPage.id)

      expect(result).toBeNull()
      expect(mockPageManager.updatePageData).toHaveBeenCalledWith(mockPage.id, { mode: 'edit' })
    })
  })
}) 