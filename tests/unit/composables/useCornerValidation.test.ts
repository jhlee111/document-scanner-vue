import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useCornerValidation } from '@/composables/useCornerValidation'
import type { Corners } from '@/types'
import * as imageProcessingUtils from '@/utils/imageProcessing'

// Mock the image processing utilities
vi.mock('@/utils/imageProcessing', () => ({
  generateDefaultCornersPx: vi.fn(),
  transformCornersForRotation: vi.fn(),
  calculateAreaFromPoints: vi.fn()
}))

describe('useCornerValidation', () => {
  let mockPageManager: any
  let currentDisplayPage: any
  let mockPageData: any
  let mockDefaultCorners: Corners
  let mockTransformedCorners: Corners

  beforeEach(() => {
    // Setup mock corners
    mockDefaultCorners = [
      { x: 50, y: 50 },
      { x: 350, y: 50 },
      { x: 350, y: 250 },
      { x: 50, y: 250 }
    ]

    mockTransformedCorners = [
      { x: 60, y: 60 },
      { x: 340, y: 60 },
      { x: 340, y: 240 },
      { x: 60, y: 240 }
    ]

    // Setup mock page data
    mockPageData = {
      id: 'test-page-1',
      mode: 'edit',
      corners: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 100, y: 200 }
      ] as Corners,
      originalWidth: 400,
      originalHeight: 300,
      currentRotation: 0
    }

    // Setup reactive refs - start with null to trigger watcher
    currentDisplayPage = ref(null)

    // Setup mock page manager
    mockPageManager = {
      currentPage: ref({ id: 'test-page-1' }),
      updatePageData: vi.fn()
    }

    // Setup mock utility functions
    vi.mocked(imageProcessingUtils.generateDefaultCornersPx).mockReturnValue(mockDefaultCorners)
    vi.mocked(imageProcessingUtils.transformCornersForRotation).mockReturnValue(mockTransformedCorners)
    vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(20000) // Valid area

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })
      }).not.toThrow()
    })

    it('should return an object', () => {
      const result = useCornerValidation({
        currentDisplayPage,
        pageManager: mockPageManager
      })

      expect(result).toBeTypeOf('object')
    })
  })

  describe('corner validation watcher', () => {
    describe('null corners handling', () => {
      it('should set default corners when corners are null', async () => {
        // Setup the composable first
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        // Then trigger the watcher by setting page data with null corners
        currentDisplayPage.value = {
          ...mockPageData,
          corners: null
        }

        await nextTick()

        expect(imageProcessingUtils.generateDefaultCornersPx).toHaveBeenCalledWith(400, 300, 32)
        expect(imageProcessingUtils.transformCornersForRotation).toHaveBeenCalledWith(
          mockDefaultCorners,
          0,
          400,
          300
        )
        expect(mockPageManager.updatePageData).toHaveBeenCalledWith('test-page-1', {
          corners: mockTransformedCorners
        })
        expect(console.log).toHaveBeenCalledWith(
          '[useCornerValidation] Watcher: corners for page test-page-1 are null. Setting default.'
        )
      })

      it('should handle null corners with rotation', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          corners: null,
          currentRotation: 90
        }

        await nextTick()

        expect(imageProcessingUtils.transformCornersForRotation).toHaveBeenCalledWith(
          mockDefaultCorners,
          90,
          400,
          300
        )
      })
    })

    describe('small area corners handling', () => {
      it('should reset corners when area is too small', async () => {
        // Mock small area (less than 5% of image area)
        const imageArea = 400 * 300 // 120,000
        const smallArea = imageArea * 0.03 // 3,600 (less than 5% threshold)
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(smallArea)

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = mockPageData

        await nextTick()

        const areaThreshold = imageArea * 0.05 // 6,000
        expect(imageProcessingUtils.calculateAreaFromPoints).toHaveBeenCalledWith(mockPageData.corners)
        expect(console.warn).toHaveBeenCalledWith(
          `[useCornerValidation] Watcher: corners area for page test-page-1 is too small (${smallArea} < ${areaThreshold}). Resetting to default. Image: Low-res (400x300)`
        )
        expect(mockPageManager.updatePageData).toHaveBeenCalledWith('test-page-1', {
          corners: mockTransformedCorners
        })
      })

      it('should handle small area with rotated image dimensions', async () => {
        // For 90° rotation, width and height are swapped
        const rotatedImageArea = 300 * 400 // Same area but dimensions swapped
        const smallArea = rotatedImageArea * 0.03
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(smallArea)

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          currentRotation: 90
        }

        await nextTick()

        // Should use swapped dimensions for area calculation
        const areaThreshold = rotatedImageArea * 0.05
        expect(console.warn).toHaveBeenCalledWith(
          `[useCornerValidation] Watcher: corners area for page test-page-1 is too small (${smallArea} < ${areaThreshold}). Resetting to default. Image: Low-res (300x400)`
        )
      })

      it('should not reset corners when area is acceptable', async () => {
        // Mock acceptable area (more than 5% of image area)
        const imageArea = 400 * 300
        const acceptableArea = imageArea * 0.1 // 10%
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(acceptableArea)

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = mockPageData

        await nextTick()

        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
        expect(console.warn).not.toHaveBeenCalled()
        expect(console.log).not.toHaveBeenCalled()
      })
    })

    describe('rotation handling', () => {
      it('should handle 90° rotation dimensions correctly', async () => {
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(1000) // Small area

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          currentRotation: 90
        }

        await nextTick()

        // For 90° rotation: currentViewWidth = originalHeight, currentViewHeight = originalWidth
        const expectedArea = 300 * 400 // Swapped dimensions
        const expectedThreshold = expectedArea * 0.05

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(`${expectedThreshold}`)
        )
      })

      it('should handle 180° rotation dimensions correctly', async () => {
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(1000) // Small area

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          currentRotation: 180
        }

        await nextTick()

        // For 180° rotation: dimensions stay the same
        const expectedArea = 400 * 300
        const expectedThreshold = expectedArea * 0.05

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(`${expectedThreshold}`)
        )
      })

      it('should handle 270° rotation dimensions correctly', async () => {
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(1000) // Small area

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          currentRotation: 270
        }

        await nextTick()

        // For 270° rotation: currentViewWidth = originalHeight, currentViewHeight = originalWidth
        const expectedArea = 300 * 400 // Swapped dimensions
        const expectedThreshold = expectedArea * 0.05

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(`${expectedThreshold}`)
        )
      })
    })

    describe('mode filtering', () => {
      it('should not validate corners in preview mode', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          mode: 'preview',
          corners: null
        }

        await nextTick()

        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
        expect(console.log).not.toHaveBeenCalled()
      })

      it('should only validate corners in edit mode', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          mode: 'edit',
          corners: null
        }

        await nextTick()

        expect(mockPageManager.updatePageData).toHaveBeenCalled()
      })
    })

    describe('page manager synchronization', () => {
      it('should not update when current page ID does not match', async () => {
        mockPageManager.currentPage.value = { id: 'different-page' }

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          corners: null
        }

        await nextTick()

        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
      })

      it('should not update when current page is null', async () => {
        mockPageManager.currentPage.value = null

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          corners: null
        }

        await nextTick()

        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
      })

      it('should update when current page ID matches', async () => {
        mockPageManager.currentPage.value = { id: 'test-page-1' }

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          corners: null
        }

        await nextTick()

        expect(mockPageManager.updatePageData).toHaveBeenCalledWith('test-page-1', {
          corners: mockTransformedCorners
        })
      })
    })

    describe('edge cases', () => {
      it('should handle null page data', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = null

        await nextTick()

        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
      })

      it('should handle page data without ID', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          id: '',
          corners: null
        }

        await nextTick()

        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()
      })

      it('should handle zero area corners', async () => {
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(0)

        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = mockPageData

        await nextTick()

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('corners area for page test-page-1 is too small (0 <')
        )
        expect(mockPageManager.updatePageData).toHaveBeenCalled()
      })

      it('should handle very small image dimensions', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        currentDisplayPage.value = {
          ...mockPageData,
          originalWidth: 10,
          originalHeight: 10,
          corners: null
        }

        await nextTick()

        expect(imageProcessingUtils.generateDefaultCornersPx).toHaveBeenCalledWith(10, 10, 32)
        expect(mockPageManager.updatePageData).toHaveBeenCalled()
      })
    })

    describe('watcher reactivity', () => {
      it('should react to page data changes', async () => {
        useCornerValidation({
          currentDisplayPage,
          pageManager: mockPageManager
        })

        // Set initial valid state - no update needed
        currentDisplayPage.value = mockPageData
        await nextTick()
        expect(mockPageManager.updatePageData).not.toHaveBeenCalled()

        // Change to null corners - should trigger update
        currentDisplayPage.value = {
          ...mockPageData,
          corners: null
        }

        await nextTick()
        expect(mockPageManager.updatePageData).toHaveBeenCalledTimes(1)

        // Change back to valid corners - should not trigger update
        vi.mocked(imageProcessingUtils.calculateAreaFromPoints).mockReturnValue(20000) // Valid area
        currentDisplayPage.value = {
          ...mockPageData,
          corners: mockDefaultCorners
        }

        await nextTick()
        expect(mockPageManager.updatePageData).toHaveBeenCalledTimes(1) // Still only 1 call
      })
    })
  })
}) 