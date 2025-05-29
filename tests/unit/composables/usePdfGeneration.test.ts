import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import { usePdfGeneration, type PdfGenerationOptions } from '@/composables/usePdfGeneration'
import type { Page } from '@/types'

// Mock the PDF generator utility
vi.mock('@/utils/pdfGenerator', () => ({
  generatePdfFromProcessedPages: vi.fn()
}))

import { generatePdfFromProcessedPages } from '@/utils/pdfGenerator'

// Mock console methods to avoid noise in tests
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
}

// Mock alert to prevent actual alerts during tests
const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

describe('usePdfGeneration Workflow and Reliability Tests', () => {
  let mockPages: Page[]
  let mockPagesRef: ReturnType<typeof ref<Page[]>>
  let mockIsLoading: ReturnType<typeof ref<boolean>>
  let mockOnPdfCreated: ReturnType<typeof vi.fn>
  let mockOnCloseScanner: ReturnType<typeof vi.fn>
  let mockApplyPerspectiveTransform: ReturnType<typeof vi.fn>
  let mockGetPageById: ReturnType<typeof vi.fn>
  let options: PdfGenerationOptions

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Create mock pages
    mockPages = [
      {
        id: 'page-1',
        originalFile: new File([''], 'test1.jpg', { type: 'image/jpeg' }),
        originalFileName: 'test1.jpg',
        originalImageDataURL: 'data:image/jpeg;base64,page1data',
        originalWidth: 800,
        originalHeight: 600,
        processedImageDataURL: 'data:image/jpeg;base64,processed1',
        processedWidth: 800,
        processedHeight: 600,
        corners: [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 600 },
          { x: 0, y: 600 }
        ],
        currentRotation: 0,
        mode: 'preview' as const,
        timestampAdded: Date.now()
      },
      {
        id: 'page-2',
        originalFile: new File([''], 'test2.jpg', { type: 'image/jpeg' }),
        originalFileName: 'test2.jpg',
        originalImageDataURL: 'data:image/jpeg;base64,page2data',
        originalWidth: 600,
        originalHeight: 800,
        processedImageDataURL: 'data:image/jpeg;base64,processed2',
        processedWidth: 600,
        processedHeight: 800,
        corners: [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 800 },
          { x: 0, y: 800 }
        ],
        currentRotation: 0,
        mode: 'preview' as const,
        timestampAdded: Date.now()
      }
    ]
    
    mockPagesRef = ref(mockPages)
    mockIsLoading = ref(false) as ReturnType<typeof ref<boolean>>
    mockOnPdfCreated = vi.fn()
    mockOnCloseScanner = vi.fn()
    mockApplyPerspectiveTransform = vi.fn().mockResolvedValue('data:image/jpeg;base64,transformed')
    mockGetPageById = vi.fn().mockImplementation((id: string) => 
      mockPages.find(page => page.id === id)
    )
    
    // Setup options
    options = {
      pageManager: {
        pages: computed(() => mockPagesRef.value as readonly Page[]),
        getPageById: mockGetPageById
      },
      imageOperations: {
        isLoading: mockIsLoading,
        applyPerspectiveTransformAndGetDataURL: mockApplyPerspectiveTransform
      },
      closeAfterPdfCreated: false,
      onPdfCreated: mockOnPdfCreated,
      onCloseScanner: mockOnCloseScanner
    }
    
    // Mock PDF generator to return a blob
    vi.mocked(generatePdfFromProcessedPages).mockResolvedValue(
      new Blob(['mock pdf content'], { type: 'application/pdf' })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PDF Creation Workflow', () => {
    it('should create PDF from multiple processed pages successfully', async () => {
      const { createPdfFromAllPages, isProcessingPdf } = usePdfGeneration(options)
      
      expect(isProcessingPdf.value).toBe(false)
      
      await createPdfFromAllPages()
      
      // Should have called PDF generator with correct data
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith([
        {
          imageDataURL: 'data:image/jpeg;base64,processed1',
          width: 800,
          height: 600
        },
        {
          imageDataURL: 'data:image/jpeg;base64,processed2',
          width: 600,
          height: 800
        }
      ])
      
      // Should have called success callback
      expect(mockOnPdfCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'application/pdf'
        })
      )
      
      // Should reset processing state
      expect(isProcessingPdf.value).toBe(false)
      expect(mockIsLoading.value).toBe(false)
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('PDF generated successfully')
      )
    })

    it('should process unprocessed pages before PDF creation', async () => {
      // Create pages where one needs processing
      mockPages[1].processedImageDataURL = undefined
      mockPages[1].processedWidth = undefined
      mockPages[1].processedHeight = undefined
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      // Should have called perspective transform for unprocessed page
      expect(mockApplyPerspectiveTransform).toHaveBeenCalledWith('page-2')
      
      // Should still create PDF with processed page
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith([
        {
          imageDataURL: 'data:image/jpeg;base64,processed1',
          width: 800,
          height: 600
        }
      ])
    })

    it('should handle single page PDF creation', async () => {
      // Set up single page
      mockPagesRef.value = [mockPages[0]]
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith([
        {
          imageDataURL: 'data:image/jpeg;base64,processed1',
          width: 800,
          height: 600
        }
      ])
      
      expect(mockOnPdfCreated).toHaveBeenCalled()
    })

    it('should close scanner after PDF creation when configured', async () => {
      options.closeAfterPdfCreated = true
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(mockOnPdfCreated).toHaveBeenCalled()
      expect(mockOnCloseScanner).toHaveBeenCalled()
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Closing scanner after PDF creation')
      )
    })

    it('should not close scanner when closeAfterPdfCreated is false', async () => {
      options.closeAfterPdfCreated = false
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(mockOnPdfCreated).toHaveBeenCalled()
      expect(mockOnCloseScanner).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle empty pages array gracefully', async () => {
      mockPagesRef.value = []
      
      const { createPdfFromAllPages, isProcessingPdf } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(alertSpy).toHaveBeenCalledWith('No pages to create PDF from.')
      expect(generatePdfFromProcessedPages).not.toHaveBeenCalled()
      expect(mockOnPdfCreated).not.toHaveBeenCalled()
      expect(isProcessingPdf.value).toBe(false)
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('No pages available for PDF creation')
      )
    })

    it('should handle PDF generation failure gracefully', async () => {
      vi.mocked(generatePdfFromProcessedPages).mockRejectedValue(
        new Error('PDF generation failed')
      )
      
      const { createPdfFromAllPages, isProcessingPdf } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(alertSpy).toHaveBeenCalledWith('Failed to generate PDF. Please try again.')
      expect(mockOnPdfCreated).not.toHaveBeenCalled()
      expect(isProcessingPdf.value).toBe(false)
      expect(mockIsLoading.value).toBe(false)
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error generating PDF'),
        expect.any(Error)
      )
    })

    it('should handle null PDF blob from generator', async () => {
      vi.mocked(generatePdfFromProcessedPages).mockResolvedValue(null)
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to generate PDF blob. No content returned from generator.'
      )
      expect(mockOnPdfCreated).not.toHaveBeenCalled()
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('PDF generation returned null')
      )
    })

    it('should handle perspective transform errors during processing', async () => {
      mockPages[0].processedImageDataURL = undefined
      mockApplyPerspectiveTransform.mockRejectedValue(new Error('Transform failed'))
      
      const { createPdfFromAllPages, isProcessingPdf } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(alertSpy).toHaveBeenCalledWith('Failed to create PDF. Please try again.')
      expect(isProcessingPdf.value).toBe(false)
      expect(mockIsLoading.value).toBe(false)
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in PDF creation workflow'),
        expect.any(Error)
      )
    })

    it('should handle pages being deleted during processing', async () => {
      // Mock getPageById to return undefined for deleted page
      mockGetPageById.mockImplementation((id: string) => {
        if (id === 'page-2') return undefined
        return mockPages.find(page => page.id === id)
      })
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      // Should skip deleted page and continue with remaining
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Page page-2 was deleted before PDF creation loop, skipping.')
      )
      
      // Should still create PDF with remaining page
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith([
        {
          imageDataURL: 'data:image/jpeg;base64,processed1',
          width: 800,
          height: 600
        }
      ])
    })

    it('should handle no successfully processed pages', async () => {
      // Set all pages to have no processed data
      mockPages.forEach(page => {
        page.processedImageDataURL = undefined
        page.processedWidth = undefined
        page.processedHeight = undefined
      })
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(alertSpy).toHaveBeenCalledWith(
        'No pages could be successfully processed to create a PDF.'
      )
      expect(generatePdfFromProcessedPages).not.toHaveBeenCalled()
      expect(mockOnPdfCreated).not.toHaveBeenCalled()
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('No pages could be successfully processed')
      )
    })
  })

  describe('State Management', () => {
    it('should set processing state during PDF creation', async () => {
      let processingStateWhenGenerating = false
      
      vi.mocked(generatePdfFromProcessedPages).mockImplementation(async () => {
        const { isProcessingPdf } = usePdfGeneration(options)
        processingStateWhenGenerating = isProcessingPdf.value
        return new Blob(['pdf'], { type: 'application/pdf' })
      })
      
      const { createPdfFromAllPages, isProcessingPdf } = usePdfGeneration(options)
      
      expect(isProcessingPdf.value).toBe(false)
      
      await createPdfFromAllPages()
      
      expect(isProcessingPdf.value).toBe(false) // Should be reset after completion
    })

    it('should set loading state during PDF creation', async () => {
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      expect(mockIsLoading.value).toBe(false)
      
      const pdfPromise = createPdfFromAllPages()
      
      // Should be true during processing
      expect(mockIsLoading.value).toBe(true)
      
      await pdfPromise
      
      // Should be reset after completion
      expect(mockIsLoading.value).toBe(false)
    })

    it('should reset state even when errors occur', async () => {
      vi.mocked(generatePdfFromProcessedPages).mockRejectedValue(
        new Error('PDF generation failed')
      )
      
      const { createPdfFromAllPages, isProcessingPdf } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(isProcessingPdf.value).toBe(false)
      expect(mockIsLoading.value).toBe(false)
    })
  })

  describe('Memory Management and Performance', () => {
    it('should handle large number of pages efficiently', async () => {
      // Create 20 pages
      const largePagesArray: Page[] = Array.from({ length: 20 }, (_, i) => ({
        id: `page-${i + 1}`,
        originalFile: new File([''], `test${i + 1}.jpg`, { type: 'image/jpeg' }),
        originalFileName: `test${i + 1}.jpg`,
        originalImageDataURL: `data:image/jpeg;base64,page${i + 1}data`,
        originalWidth: 800,
        originalHeight: 600,
        processedImageDataURL: `data:image/jpeg;base64,processed${i + 1}`,
        processedWidth: 800,
        processedHeight: 600,
        corners: [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 600 },
          { x: 0, y: 600 }
        ],
        currentRotation: 0,
        mode: 'preview' as const,
        timestampAdded: Date.now()
      }))
      
      mockPagesRef.value = largePagesArray
      mockGetPageById.mockImplementation((id: string) => 
        largePagesArray.find(page => page.id === id)
      )
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            imageDataURL: expect.stringContaining('processed'),
            width: 800,
            height: 600
          })
        ])
      )
      
      expect(generatePdfFromProcessedPages).toHaveBeenCalledTimes(1)
      expect(mockOnPdfCreated).toHaveBeenCalled()
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('20 pages ready for PDF generation')
      )
    })

    it('should handle mixed processed and unprocessed pages', async () => {
      // Mix of processed and unprocessed pages
      mockPages[0].processedImageDataURL = 'data:image/jpeg;base64,processed1'
      mockPages[1].processedImageDataURL = undefined
      mockPages[1].processedWidth = undefined
      mockPages[1].processedHeight = undefined
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      // Should process unprocessed page
      expect(mockApplyPerspectiveTransform).toHaveBeenCalledWith('page-2')
      
      // Should include only successfully processed pages
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith([
        {
          imageDataURL: 'data:image/jpeg;base64,processed1',
          width: 800,
          height: 600
        }
      ])
    })

    it('should handle pages with different dimensions', async () => {
      // Pages with various dimensions
      mockPages[0].processedWidth = 1200
      mockPages[0].processedHeight = 800
      mockPages[1].processedWidth = 600
      mockPages[1].processedHeight = 900
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(generatePdfFromProcessedPages).toHaveBeenCalledWith([
        {
          imageDataURL: 'data:image/jpeg;base64,processed1',
          width: 1200,
          height: 800
        },
        {
          imageDataURL: 'data:image/jpeg;base64,processed2',
          width: 600,
          height: 900
        }
      ])
    })
  })

  describe('Logging and Debugging', () => {
    it('should log comprehensive processing information', async () => {
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting PDF creation process')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing 2 pages')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('2 pages ready for PDF generation')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Generating PDF')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('PDF creation process completed')
      )
    })

    it('should log page processing details', async () => {
      mockPages[0].processedImageDataURL = undefined
      
      const { createPdfFromAllPages } = usePdfGeneration(options)
      
      await createPdfFromAllPages()
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing page page-1 for PDF')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Page page-2 already processed, skipping')
      )
    })
  })
}) 