import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useImageProcessing } from '../../../src/composables/useImageProcessing';
import { sampleCorners, sampleImageDataURL } from '../../setup/fixtures';
import { mockOpenCV } from '../../setup/mocks';

// Mock the opencvUtils module
vi.mock('../../../src/utils/opencvUtils', () => ({
  detectDocumentCorners: vi.fn(),
  applyPerspectiveTransform: vi.fn(),
  rotateImageDataURL: vi.fn(),
}));

describe('useImageProcessing', () => {
  let isOpenCVReady: any;
  let mockDetectDocumentCorners: any;
  let mockApplyPerspectiveTransform: any;
  let mockRotateImageDataURL: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Mock OpenCV as available
    (global as any).cv = mockOpenCV;
    isOpenCVReady = ref(true);
    
    // Get the mocked functions
    const { detectDocumentCorners, applyPerspectiveTransform, rotateImageDataURL } = await import('../../../src/utils/opencvUtils');
    mockDetectDocumentCorners = detectDocumentCorners as any;
    mockApplyPerspectiveTransform = applyPerspectiveTransform as any;
    mockRotateImageDataURL = rotateImageDataURL as any;
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { isProcessing, detectedCorners, adjustedCorners, currentRotation } = useImageProcessing(isOpenCVReady);
      
      expect(isProcessing.value).toBe(false);
      expect(detectedCorners.value).toBeNull();
      expect(adjustedCorners.value).toBeNull();
      expect(currentRotation.value).toBe(0);
    });
  });

  describe('detectEdges', () => {
    it('should detect edges and set corners', async () => {
      const { detectEdges, detectedCorners, adjustedCorners, isProcessing } = useImageProcessing(isOpenCVReady);
      
      const mockDetectedCorners = [
        { x: 10, y: 10 },
        { x: 790, y: 10 },
        { x: 790, y: 590 },
        { x: 10, y: 590 },
      ];
      
      mockDetectDocumentCorners.mockResolvedValue(mockDetectedCorners);
      
      const result = await detectEdges(sampleImageDataURL);
      
      expect(result).toEqual(mockDetectedCorners);
      expect(detectedCorners.value).toEqual(mockDetectedCorners);
      expect(adjustedCorners.value).toEqual(mockDetectedCorners);
      expect(isProcessing.value).toBe(false);
    });

    it('should handle OpenCV not ready', async () => {
      isOpenCVReady.value = false;
      const { detectEdges } = useImageProcessing(isOpenCVReady);
      
      const result = await detectEdges(sampleImageDataURL);
      
      expect(result).toBeNull();
    });

    it('should handle detection errors', async () => {
      const { detectEdges, detectedCorners } = useImageProcessing(isOpenCVReady);
      
      mockDetectDocumentCorners.mockRejectedValue(new Error('Detection failed'));
      
      const result = await detectEdges(sampleImageDataURL);
      
      expect(result).toBeNull();
      expect(detectedCorners.value).toBeNull();
    });

    it('should handle invalid corner count', async () => {
      const { detectEdges, detectedCorners } = useImageProcessing(isOpenCVReady);
      
      mockDetectDocumentCorners.mockResolvedValue([{ x: 10, y: 10 }]); // Only 1 corner
      
      const result = await detectEdges(sampleImageDataURL);
      
      expect(result).toBeNull();
      expect(detectedCorners.value).toBeNull();
    });
  });

  describe('performPerspectiveTransform', () => {
    it('should perform perspective transform with valid corners', async () => {
      const { performPerspectiveTransform } = useImageProcessing(isOpenCVReady);
      
      const mockResult = {
        imageDataURL: 'data:image/png;base64,processed-image',
        processedWidth: 800,
        processedHeight: 600,
      };
      
      mockApplyPerspectiveTransform.mockResolvedValue(mockResult);
      
      const result = await performPerspectiveTransform(sampleImageDataURL, sampleCorners.default);
      
      expect(result).toEqual(mockResult);
    });

    it('should handle OpenCV not ready', async () => {
      isOpenCVReady.value = false;
      const { performPerspectiveTransform } = useImageProcessing(isOpenCVReady);
      
      const result = await performPerspectiveTransform(sampleImageDataURL, sampleCorners.default);
      
      expect(result).toBeNull();
    });

    it('should handle invalid corners', async () => {
      const { performPerspectiveTransform } = useImageProcessing(isOpenCVReady);
      
      const result = await performPerspectiveTransform(sampleImageDataURL, [{ x: 10, y: 10 }]); // Only 1 corner
      
      expect(result).toBeNull();
    });

    it('should handle transform errors', async () => {
      const { performPerspectiveTransform } = useImageProcessing(isOpenCVReady);
      
      mockApplyPerspectiveTransform.mockRejectedValue(new Error('Transform failed'));
      
      const result = await performPerspectiveTransform(sampleImageDataURL, sampleCorners.default);
      
      expect(result).toBeNull();
    });
  });

  describe('setAdjustedCorners', () => {
    it('should set adjusted corners', () => {
      const { setAdjustedCorners, adjustedCorners } = useImageProcessing(isOpenCVReady);
      
      setAdjustedCorners(sampleCorners.default);
      
      expect(adjustedCorners.value).toEqual(sampleCorners.default);
    });

    it('should handle null corners', () => {
      const { setAdjustedCorners, adjustedCorners } = useImageProcessing(isOpenCVReady);
      
      setAdjustedCorners(null);
      
      expect(adjustedCorners.value).toBeNull();
    });

    it('should handle invalid corner count', () => {
      const { setAdjustedCorners, adjustedCorners } = useImageProcessing(isOpenCVReady);
      
      // Set initial valid corners
      setAdjustedCorners(sampleCorners.default);
      expect(adjustedCorners.value).toEqual(sampleCorners.default);
      
      // Try to set invalid corners
      setAdjustedCorners([{ x: 10, y: 10 }]); // Only 1 corner
      
      // Should remain unchanged
      expect(adjustedCorners.value).toEqual(sampleCorners.default);
    });
  });

  describe('resetActiveImageState', () => {
    it('should reset all state', () => {
      const { resetActiveImageState, detectedCorners, adjustedCorners, currentRotation, isProcessing } = useImageProcessing(isOpenCVReady);
      
      // Set some initial state
      const { setAdjustedCorners } = useImageProcessing(isOpenCVReady);
      setAdjustedCorners(sampleCorners.default);
      
      resetActiveImageState();
      
      expect(detectedCorners.value).toBeNull();
      expect(adjustedCorners.value).toBeNull();
      expect(currentRotation.value).toBe(0);
      expect(isProcessing.value).toBe(false);
    });
  });

  describe('setRotation', () => {
    it('should set rotation value', () => {
      const { setRotation, currentRotation } = useImageProcessing(isOpenCVReady);
      
      setRotation(90);
      
      expect(currentRotation.value).toBe(90);
    });
  });

  describe('rotateImageData', () => {
    it('should rotate image data', async () => {
      const { rotateImageData } = useImageProcessing(isOpenCVReady);
      
      mockRotateImageDataURL.mockResolvedValue('data:image/png;base64,rotated-image');
      
      const result = await rotateImageData(sampleImageDataURL, 90);
      
      expect(result).toBe('data:image/png;base64,rotated-image');
    });
  });

  describe('transformCornersForRotationIncrement', () => {
    it('should transform corners for rotation', () => {
      const { transformCornersForRotationIncrement } = useImageProcessing(isOpenCVReady);
      
      const result = transformCornersForRotationIncrement(sampleCorners.default, 90, 800, 600);
      
      expect(result).toBeDefined();
      expect(result).toHaveLength(4);
    });

    it('should handle null corners', () => {
      const { transformCornersForRotationIncrement } = useImageProcessing(isOpenCVReady);
      
      const result = transformCornersForRotationIncrement(null, 90, 800, 600);
      
      expect(result).toBeNull();
    });
  });
}); 