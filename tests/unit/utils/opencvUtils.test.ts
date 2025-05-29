import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  loadImageToCvMat, 
  matToImageDataURL, 
  detectDocumentCorners, 
  applyPerspectiveTransform, 
  rotateImageDataURL 
} from '@/utils/opencvUtils'

// Mock OpenCV global object
const mockCv = {
  imread: vi.fn(),
  imshow: vi.fn(),
  cvtColor: vi.fn(),
  GaussianBlur: vi.fn(),
  Canny: vi.fn(),
  findContours: vi.fn(),
  arcLength: vi.fn(),
  approxPolyDP: vi.fn(),
  isContourConvex: vi.fn(),
  contourArea: vi.fn(),
  boundingRect: vi.fn(),
  resize: vi.fn(),
  getPerspectiveTransform: vi.fn(),
  warpPerspective: vi.fn(),
  rotate: vi.fn(),
  matFromArray: vi.fn(),
  Mat: vi.fn(),
  MatVector: vi.fn(),
  Size: vi.fn(),
  Scalar: vi.fn(),
  CLAHE: vi.fn(),
  COLOR_RGBA2GRAY: 6,
  BORDER_DEFAULT: 4,
  INTER_LINEAR: 1,
  INTER_AREA: 3,
  BORDER_CONSTANT: 0,
  RETR_LIST: 1,
  CHAIN_APPROX_SIMPLE: 2,
  CV_32FC2: 13,
  ROTATE_90_CLOCKWISE: 0,
  ROTATE_180: 1,
  ROTATE_90_COUNTERCLOCKWISE: 2
}

describe('OpenCV Utils - Critical Behaviors', () => {
  let mockCanvas: any
  let mockImage: any
  let mockMat: any

  beforeEach(() => {
    // Create fresh mocks for each test
    mockCanvas = {
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockImageData'),
      getContext: vi.fn(() => ({})),
      width: 800,
      height: 600
    }

    mockImage = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
      naturalWidth: 800,
      naturalHeight: 600
    }

    mockMat = {
      delete: vi.fn(),
      copyTo: vi.fn(),
      cols: 800,
      rows: 600,
      data32S: [10, 10, 790, 10, 790, 590, 10, 590] // Mock corner data
    }

    // Setup global cv mock
    ;(global as any).cv = mockCv
    
    // Setup DOM mocks
    global.HTMLImageElement = vi.fn(() => mockImage) as any
    global.Image = vi.fn(() => mockImage) as any
    global.document = {
      createElement: vi.fn(() => mockCanvas),
      body: { innerHTML: '' }
    } as any
    
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup default mock implementations
    mockCv.Mat.mockImplementation(() => mockMat)
    mockCv.MatVector.mockImplementation(() => ({
      size: () => 1,
      get: () => mockMat,
      delete: vi.fn()
    }))
    mockCv.Size.mockImplementation(() => ({}))
    mockCv.Scalar.mockImplementation(() => ({}))
    mockCv.imread.mockReturnValue(mockMat)
    mockCv.matFromArray.mockReturnValue(mockMat)
    mockCv.getPerspectiveTransform.mockReturnValue(mockMat)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OpenCV Availability and Error Handling', () => {
    it('should handle OpenCV not being available', () => {
      ;(global as any).cv = undefined
      
      expect(() => {
        loadImageToCvMat(mockImage as any)
      }).toThrow('OpenCV (cv.imread) is not available.')
    })

    it('should handle missing OpenCV functions gracefully', () => {
      ;(global as any).cv = { ...mockCv, imread: undefined }
      
      expect(() => {
        loadImageToCvMat(mockImage as any)
      }).toThrow('OpenCV (cv.imread) is not available.')
    })

    it('should handle OpenCV initialization errors', async () => {
      mockCv.imread.mockImplementation(() => {
        throw new Error('OpenCV initialization failed')
      })

      // Mock image loading to succeed but OpenCV to fail
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,test')
      
      // Trigger image load
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      const result = await imagePromise
      expect(result).toBeNull()
    })
  })

  describe('Image Loading and Conversion', () => {
    it('should load image to OpenCV Mat successfully', () => {
      const result = loadImageToCvMat(mockImage as any)
      
      expect(mockCv.imread).toHaveBeenCalledWith(mockImage)
      expect(result).toBe(mockMat)
    })

    it('should convert Mat to image data URL successfully', () => {
      const result = matToImageDataURL(mockMat)
      
      expect(mockCv.imshow).toHaveBeenCalledWith(mockCanvas, mockMat)
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg')
      expect(result).toBe('data:image/jpeg;base64,mockImageData')
    })

    it('should handle image loading failures', async () => {
      const imagePromise = detectDocumentCorners('invalid-data-url')
      
      // Trigger image error
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror()
      }, 0)

      const result = await imagePromise
      expect(result).toBeNull()
    })
  })

  describe('Document Corner Detection Behaviors', () => {
    beforeEach(() => {
      // Mock successful OpenCV operations for corner detection
      mockCv.findContours.mockImplementation(() => {
        // Simulate finding contours
      })
      mockCv.arcLength.mockReturnValue(100)
      mockCv.approxPolyDP.mockImplementation((contour, approx) => {
        // Mock 4-point approximation
        approx.rows = 4
      })
      mockCv.isContourConvex.mockReturnValue(true)
      mockCv.contourArea.mockReturnValue(50000) // Large enough area
      mockCv.boundingRect.mockReturnValue({ width: 400, height: 300 })
    })

    it('should detect document corners in a clear image', async () => {
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,validImageData')
      
      // Trigger successful image loading
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      
      expect(result).toEqual([
        { x: 10, y: 10 },   // top-left
        { x: 790, y: 10 },  // top-right  
        { x: 790, y: 590 }, // bottom-right
        { x: 10, y: 590 }   // bottom-left
      ])
    })

    it('should handle images with no detectable document', async () => {
      // Mock no contours found
      const mockMatVector = {
        size: () => 0,
        delete: vi.fn()
      }
      mockCv.MatVector.mockReturnValue(mockMatVector)
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,noDocument')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      expect(result).toBeNull()
    })

    it('should handle corrupted or invalid images', async () => {
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,corrupted')
      
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror()
      }, 0)
      
      const result = await imagePromise
      expect(result).toBeNull()
    })

    it('should work with high-resolution mobile camera images', async () => {
      // Mock high-resolution image
      const highResMockMat = {
        ...mockMat,
        cols: 4000,
        rows: 3000
      }
      mockCv.imread.mockReturnValue(highResMockMat)
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,highRes')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      expect(result).not.toBeNull()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle small or low-quality images', async () => {
      // Mock low-resolution image
      const lowResMockMat = {
        ...mockMat,
        cols: 200,
        rows: 150
      }
      mockCv.imread.mockReturnValue(lowResMockMat)
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,lowRes')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      expect(result).not.toBeNull()
    })
  })

  describe('Perspective Transform Behaviors', () => {
    const validCorners = [
      { x: 10, y: 10 },   // top-left
      { x: 790, y: 10 },  // top-right
      { x: 790, y: 590 }, // bottom-right
      { x: 10, y: 590 }   // bottom-left
    ]

    it('should transform document perspective successfully', async () => {
      const transformPromise = applyPerspectiveTransform(
        'data:image/jpeg;base64,test',
        validCorners
      )
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await transformPromise
      
      expect(result).toEqual({
        imageDataURL: 'data:image/jpeg;base64,mockImageData',
        processedWidth: expect.any(Number),
        processedHeight: expect.any(Number)
      })
    })

    it('should handle custom output dimensions', async () => {
      const transformPromise = applyPerspectiveTransform(
        'data:image/jpeg;base64,test',
        validCorners,
        { outputWidth: 1000, outputHeight: 800 }
      )
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await transformPromise
      
      expect(result?.processedWidth).toBe(1000)
      expect(result?.processedHeight).toBe(800)
    })

    it('should handle perspective transform errors', async () => {
      mockCv.warpPerspective.mockImplementation(() => {
        throw new Error('Perspective transform failed')
      })
      
      const transformPromise = applyPerspectiveTransform('data:image/jpeg;base64,test', validCorners)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await expect(transformPromise).rejects.toThrow()
    })

    it('should handle image loading failures in transform', async () => {
      const transformPromise = applyPerspectiveTransform('invalid-url', validCorners)
      
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror()
      }, 0)
      
      await expect(transformPromise).rejects.toThrow('Image failed to load for processing.')
    })
  })

  describe('Image Rotation Behaviors', () => {
    it('should rotate image 90 degrees clockwise', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 90)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await rotatePromise
      
      expect(mockCv.rotate).toHaveBeenCalledWith(
        mockMat, 
        mockMat, 
        mockCv.ROTATE_90_CLOCKWISE
      )
      expect(result).toBe('data:image/jpeg;base64,mockImageData')
    })

    it('should rotate image 180 degrees', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 180)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await rotatePromise
      
      expect(mockCv.rotate).toHaveBeenCalledWith(
        mockMat, 
        mockMat, 
        mockCv.ROTATE_180
      )
      expect(result).toBe('data:image/jpeg;base64,mockImageData')
    })

    it('should rotate image 270 degrees (90 counter-clockwise)', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 270)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await rotatePromise
      
      expect(mockCv.rotate).toHaveBeenCalledWith(
        mockMat, 
        mockMat, 
        mockCv.ROTATE_90_COUNTERCLOCKWISE
      )
      expect(result).toBe('data:image/jpeg;base64,mockImageData')
    })

    it('should handle no rotation (0 degrees)', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 0)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await rotatePromise
      
      expect(mockMat.copyTo).toHaveBeenCalled()
      expect(result).toBe('data:image/jpeg;base64,mockImageData')
    })

    it('should normalize rotation angles', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 450)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await rotatePromise
      
      expect(mockCv.rotate).toHaveBeenCalledWith(
        mockMat, 
        mockMat, 
        mockCv.ROTATE_90_CLOCKWISE
      )
    })

    it('should handle negative rotation angles', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', -90)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await rotatePromise
      
      expect(mockCv.rotate).toHaveBeenCalledWith(
        mockMat, 
        mockMat, 
        mockCv.ROTATE_90_COUNTERCLOCKWISE
      )
    })

    it('should handle unsupported rotation angles', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 45)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await rotatePromise
      
      // Should fall back to no rotation
      expect(mockMat.copyTo).toHaveBeenCalled()
      expect(result).toBe('data:image/jpeg;base64,mockImageData')
    })

    it('should handle rotation when OpenCV is not available', async () => {
      ;(global as any).cv = { ...mockCv, rotate: undefined }
      
      const result = await rotateImageDataURL('data:image/jpeg;base64,test', 90)
      
      // Should return original image
      expect(result).toBe('data:image/jpeg;base64,test')
    })

    it('should handle rotation errors', async () => {
      mockCv.rotate.mockImplementation(() => {
        throw new Error('Rotation failed')
      })
      
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 90)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await expect(rotatePromise).rejects.toThrow('Rotation failed')
    })

    it('should handle image loading failures in rotation', async () => {
      const rotatePromise = rotateImageDataURL('invalid-url', 90)
      
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror()
      }, 0)
      
      await expect(rotatePromise).rejects.toThrow('Failed to load image for rotation')
    })
  })

  describe('Memory Management', () => {
    it('should clean up OpenCV matrices properly', async () => {
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,test')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await imagePromise
      
      // Verify cleanup methods are called
      expect(mockMat.delete).toHaveBeenCalled()
    })

    it('should clean up matrices even when errors occur', async () => {
      mockCv.cvtColor.mockImplementation(() => {
        throw new Error('Processing error')
      })
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,test')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await imagePromise
      
      // Cleanup should still happen
      expect(mockMat.delete).toHaveBeenCalled()
    })

    it('should handle memory cleanup in perspective transform', async () => {
      const transformPromise = applyPerspectiveTransform(
        'data:image/jpeg;base64,test',
        [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 100 }, { x: 10, y: 100 }]
      )
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await transformPromise
      
      expect(mockMat.delete).toHaveBeenCalled()
    })

    it('should handle memory cleanup in rotation', async () => {
      const rotatePromise = rotateImageDataURL('data:image/jpeg;base64,test', 90)
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      await rotatePromise
      
      expect(mockMat.delete).toHaveBeenCalled()
    })
  })

  describe('Performance and Large Image Handling', () => {
    it('should handle very large images without crashing', async () => {
      // Mock very large image
      const largeMockMat = {
        ...mockMat,
        cols: 8000,
        rows: 6000
      }
      mockCv.imread.mockReturnValue(largeMockMat)
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,largeImage')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      
      // Should handle large images (may downsample)
      expect(mockCv.resize).toHaveBeenCalled()
      expect(result).not.toBeNull()
    })

    it('should process multiple images sequentially', async () => {
      const results = []
      
      // Process images one by one to avoid timing issues
      for (let i = 0; i < 3; i++) {
        const imagePromise = detectDocumentCorners(`data:image/jpeg;base64,test${i}`)
        
        setTimeout(() => {
          if (mockImage.onload) mockImage.onload()
        }, 0)
        
        const result = await imagePromise
        results.push(result)
      }
      
      // All should process successfully
      results.forEach(result => {
        expect(result).not.toBeNull()
      })
      
      // Memory cleanup should be called multiple times
      expect(mockMat.delete).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('should handle empty or null image data', async () => {
      const result = await detectDocumentCorners('')
      expect(result).toBeNull()
    })

    it('should handle malformed data URLs', async () => {
      const result = await detectDocumentCorners('not-a-data-url')
      expect(result).toBeNull()
    })

    it('should handle images with extreme aspect ratios', async () => {
      // Mock very wide image
      const extremeMockMat = {
        ...mockMat,
        cols: 2000,
        rows: 100
      }
      mockCv.imread.mockReturnValue(extremeMockMat)
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,extremeAspect')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      
      // Should handle extreme aspect ratios gracefully
      expect(result).toBeDefined()
    })

    it('should recover from OpenCV function failures', async () => {
      // Mock one function failing, others working
      mockCv.GaussianBlur.mockImplementationOnce(() => {
        throw new Error('Blur failed')
      })
      
      const imagePromise = detectDocumentCorners('data:image/jpeg;base64,test')
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)
      
      const result = await imagePromise
      expect(result).toBeNull() // Should fail gracefully
    })
  })
}) 