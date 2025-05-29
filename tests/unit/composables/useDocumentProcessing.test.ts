import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import { useDocumentProcessing } from '@/composables/useDocumentProcessing'
import type { Page } from '@/types'

describe('useDocumentProcessing', () => {
  let mockPageManager: any
  let mockPages: any
  let mockFile1: File
  let mockFile2: File
  let mockFile3: File

  // Helper function to create mock Page objects
  const createMockPage = (id: string, fileName: string): Page => ({
    id,
    originalFile: new File(['content'], fileName, { type: 'image/jpeg' }),
    originalFileName: fileName,
    originalImageDataURL: `data:image/jpeg;base64,mock-${id}`,
    originalWidth: 400,
    originalHeight: 300,
    corners: null,
    currentRotation: 0,
    mode: 'edit' as const,
    timestampAdded: Date.now()
  })

  beforeEach(() => {
    // Create mock files
    mockFile1 = new File(['test content 1'], 'test1.jpg', { type: 'image/jpeg' })
    mockFile2 = new File(['test content 2'], 'test2.png', { type: 'image/png' })
    mockFile3 = new File(['test content 3'], 'test3.jpg', { type: 'image/jpeg' })

    // Setup mock pages
    mockPages = ref<Page[]>([
      createMockPage('existing-page-1', 'existing1.jpg'),
      createMockPage('existing-page-2', 'existing2.jpg')
    ])

    // Setup mock page manager
    mockPageManager = {
      pages: computed(() => mockPages.value),
      addFileAsPageWithProgress: vi.fn(),
      selectPage: vi.fn()
    }

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock setTimeout
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const { isLoading, processingStatus, processingProgress } = useDocumentProcessing({
        pageManager: mockPageManager
      })

      expect(isLoading.value).toBe(false)
      expect(processingStatus.value).toBe('')
      expect(processingProgress.value).toBe(0)
    })

    it('should return all required methods and state', () => {
      const result = useDocumentProcessing({
        pageManager: mockPageManager
      })

      expect(result).toHaveProperty('isLoading')
      expect(result).toHaveProperty('processingStatus')
      expect(result).toHaveProperty('processingProgress')
      expect(result).toHaveProperty('handleFilesSelected')
      expect(typeof result.handleFilesSelected).toBe('function')
    })
  })

  describe('handleFilesSelected', () => {
    describe('empty files handling', () => {
      it('should handle empty file array without processing', async () => {
        const { handleFilesSelected, isLoading, processingStatus } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([])

        expect(isLoading.value).toBe(false)
        expect(processingStatus.value).toBe('')
        expect(mockPageManager.addFileAsPageWithProgress).not.toHaveBeenCalled()
        expect(mockPageManager.selectPage).not.toHaveBeenCalled()
      })

      it('should log appropriate message for empty files', async () => {
        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([])

        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] handleFilesSelected with files:', 0
        )
      })
    })

    describe('single file processing', () => {
      it('should process single file successfully', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        
        const { handleFilesSelected, isLoading, processingStatus, processingProgress } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        const promise = handleFilesSelected([mockFile1])
        
        // Check initial loading state
        expect(isLoading.value).toBe(true)
        // Status changes quickly from "Processing images..." to "Processing image 1 of 1..."
        expect(processingStatus.value).toMatch(/Processing/)
        expect(processingProgress.value).toBeGreaterThanOrEqual(0)

        // Add new page to simulate successful processing (before await)
        mockPages.value = [
          ...mockPages.value,
          createMockPage('new-page-id', 'new-page.jpg')
        ]

        await promise

        expect(mockPageManager.addFileAsPageWithProgress).toHaveBeenCalledWith(
          mockFile1,
          expect.any(Function)
        )
        expect(mockPageManager.selectPage).toHaveBeenCalledWith('new-page-id')
        expect(isLoading.value).toBe(false)
      })

      it('should track progress correctly for single file', async () => {
        mockPageManager.addFileAsPageWithProgress.mockImplementation(async (file: File, progressCallback: (status: string, progress: number) => void) => {
          // Simulate progress updates
          progressCallback('Loading image...', 25)
          progressCallback('Processing...', 50)
          progressCallback('Finalizing...', 100)
          return 'new-page-id'
        })

        const { handleFilesSelected, processingProgress } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(processingProgress.value).toBe(100)
      })
    })

    describe('multiple files processing', () => {
      it('should process multiple files in sequence', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        
        // Add new pages to simulate successful processing
        mockPages.value = [
          ...mockPages.value,
          createMockPage('new-page-1', 'new-page-1.jpg'),
          createMockPage('new-page-2', 'new-page-2.jpg'),
          createMockPage('new-page-3', 'new-page-3.jpg')
        ]

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1, mockFile2, mockFile3])

        expect(mockPageManager.addFileAsPageWithProgress).toHaveBeenCalledTimes(3)
        expect(mockPageManager.addFileAsPageWithProgress).toHaveBeenNthCalledWith(1, mockFile1, expect.any(Function))
        expect(mockPageManager.addFileAsPageWithProgress).toHaveBeenNthCalledWith(2, mockFile2, expect.any(Function))
        expect(mockPageManager.addFileAsPageWithProgress).toHaveBeenNthCalledWith(3, mockFile3, expect.any(Function))
      })

      it('should update status for each file in multiple file processing', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        
        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1, mockFile2])

        // Should have logged processing for each file with the correct format
        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] Processing file 1/2:',
          'test1.jpg',
          'size:',
          expect.any(Number),
          'type:',
          'image/jpeg'
        )
        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] Processing file 2/2:',
          'test2.png',
          'size:',
          expect.any(Number),
          'type:',
          'image/png'
        )
      })

      it('should calculate progress correctly for multiple files', async () => {
        mockPageManager.addFileAsPageWithProgress.mockImplementation(async (file: File, progressCallback: (status: string, progress: number) => void) => {
          progressCallback('Processing...', 50)
          return 'new-page-id'
        })

        const { handleFilesSelected, processingProgress } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        const promise = handleFilesSelected([mockFile1, mockFile2])
        await promise

        // Progress should reach 100% at the end
        expect(processingProgress.value).toBe(100)
      })
    })

    describe('page selection logic', () => {
      it('should select first newly added page when pages are added', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        
        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        // Start with original page count
        const originalPageCount = mockPages.value.length

        const promise = handleFilesSelected([mockFile1])

        // Simulate adding new page during processing
        mockPages.value = [
          ...mockPages.value,
          createMockPage('first-new-page', 'first-new.jpg')
        ]

        await promise

        expect(mockPageManager.selectPage).toHaveBeenCalledWith('first-new-page')
      })

      it('should not select page when no new pages are added', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('existing-page-id')
        
        // Don't add any new pages (simulate failure or duplicate)
        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(mockPageManager.selectPage).not.toHaveBeenCalled()
      })

      it('should select correct page when multiple files are processed', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        
        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        const promise = handleFilesSelected([mockFile1, mockFile2])

        // Add multiple new pages during processing
        mockPages.value = [
          ...mockPages.value,
          createMockPage('first-new-page', 'first-new.jpg'),
          createMockPage('second-new-page', 'second-new.jpg')
        ]

        await promise

        // Should select the first newly added page
        expect(mockPageManager.selectPage).toHaveBeenCalledWith('first-new-page')
      })
    })

    describe('error handling', () => {
      it('should handle file processing errors gracefully', async () => {
        const testError = new Error('File processing failed')
        mockPageManager.addFileAsPageWithProgress.mockRejectedValue(testError)

        const { handleFilesSelected, isLoading, processingStatus } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(console.error).toHaveBeenCalledWith(
          '[useDocumentProcessing] Error processing files:', testError
        )
        expect(processingStatus.value).toBe('Error processing images')
        expect(isLoading.value).toBe(false)
      })

      it('should handle individual file errors in multiple file processing', async () => {
        const testError = new Error('Second file failed')
        mockPageManager.addFileAsPageWithProgress
          .mockResolvedValueOnce('success-page-id')
          .mockRejectedValueOnce(testError)

        const { handleFilesSelected, processingStatus } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1, mockFile2])

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error processing file 2'),
          testError
        )
        expect(processingStatus.value).toBe('Error processing images')
      })

      it('should clear error status after timeout', async () => {
        const testError = new Error('Processing failed')
        mockPageManager.addFileAsPageWithProgress.mockRejectedValue(testError)

        const { handleFilesSelected, processingStatus, processingProgress } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(processingStatus.value).toBe('Error processing images')

        // Fast-forward timers
        vi.advanceTimersByTime(2000)

        expect(processingStatus.value).toBe('')
        expect(processingProgress.value).toBe(0)
      })

      it('should log error stack trace when available', async () => {
        const testError = new Error('Test error with stack')
        testError.stack = 'Error stack trace here'
        mockPageManager.addFileAsPageWithProgress.mockRejectedValue(testError)

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(console.error).toHaveBeenCalledWith(
          '[useDocumentProcessing] Error stack:', 'Error stack trace here'
        )
      })

      it('should handle non-Error objects gracefully', async () => {
        const testError = 'String error'
        mockPageManager.addFileAsPageWithProgress.mockRejectedValue(testError)

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(console.error).toHaveBeenCalledWith(
          '[useDocumentProcessing] Error stack:', 'No stack trace'
        )
      })
    })

    describe('progress callback integration', () => {
      it('should properly integrate progress callbacks from page manager', async () => {
        mockPageManager.addFileAsPageWithProgress.mockImplementation(async (file: File, progressCallback: (status: string, progress: number) => void) => {
          progressCallback('Loading...', 25)
          progressCallback('Processing...', 50)
          progressCallback('Finalizing...', 100)
          return 'new-page-id'
        })

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        // Verify that progress callbacks were logged
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Progress callback - Status: Loading..., Progress: 25')
        )
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Progress callback - Status: Processing..., Progress: 50')
        )
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Progress callback - Status: Finalizing..., Progress: 100')
        )
      })

      it('should calculate combined progress for multiple files', async () => {
        mockPageManager.addFileAsPageWithProgress.mockImplementation(async (file: File, progressCallback: (status: string, progress: number) => void) => {
          progressCallback('Processing...', 100)
          return 'new-page-id'
        })

        const { handleFilesSelected, processingProgress } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1, mockFile2])

        // Final progress should be 100%
        expect(processingProgress.value).toBe(100)
      })
    })

    describe('status clearing', () => {
      it('should clear status after successful completion', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        mockPages.value = [...mockPages.value, createMockPage('new-page-id', 'new-page.jpg')]

        const { handleFilesSelected, processingStatus, processingProgress } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(processingStatus.value).toBe('Complete!')
        expect(processingProgress.value).toBe(100)

        // Fast-forward timers
        vi.advanceTimersByTime(500)

        expect(processingStatus.value).toBe('')
        expect(processingProgress.value).toBe(0)
      })

      it('should log status clearing', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        mockPages.value = [...mockPages.value, createMockPage('new-page-id', 'new-page.jpg')]

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        vi.advanceTimersByTime(500)

        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] Clearing processing status...'
        )
      })
    })

    describe('loading state management', () => {
      it('should set loading state during processing', async () => {
        let resolveProcessing: (value: string) => void
        const processingPromise = new Promise<string>((resolve) => {
          resolveProcessing = resolve
        })
        
        mockPageManager.addFileAsPageWithProgress.mockReturnValue(processingPromise)

        const { handleFilesSelected, isLoading } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        const promise = handleFilesSelected([mockFile1])

        // Should be loading during processing
        expect(isLoading.value).toBe(true)

        // Resolve the processing
        resolveProcessing!('new-page-id')
        await promise

        // Should not be loading after completion
        expect(isLoading.value).toBe(false)
      })

      it('should clear loading state even on error', async () => {
        mockPageManager.addFileAsPageWithProgress.mockRejectedValue(new Error('Test error'))

        const { handleFilesSelected, isLoading } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(isLoading.value).toBe(false)
      })
    })

    describe('logging and debugging', () => {
      it('should log comprehensive processing information', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')
        mockPages.value = [...mockPages.value, createMockPage('new-page-id', 'new-page.jpg')]

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] handleFilesSelected with files:', 1
        )
        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] Proceeding with file processing...'
        )
        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] Setting loading state...'
        )
        expect(console.log).toHaveBeenCalledWith(
          '[useDocumentProcessing] Processing complete!'
        )
      })

      it('should log file details during processing', async () => {
        mockPageManager.addFileAsPageWithProgress.mockResolvedValue('new-page-id')

        const { handleFilesSelected } = useDocumentProcessing({
          pageManager: mockPageManager
        })

        await handleFilesSelected([mockFile1])

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Processing file 1/1:'),
          'test1.jpg',
          'size:',
          expect.any(Number),
          'type:',
          'image/jpeg'
        )
      })
    })
  })
}) 