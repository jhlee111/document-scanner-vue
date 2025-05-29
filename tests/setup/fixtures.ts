import type { Point, Corners, Page } from '../../src/types';

// Sample image data URLs for testing
export const sampleImages = {
  // Small test image (100x100 pixels)
  small: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  
  // Document-like image data
  document: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A',
  
  // Invalid image data
  invalid: 'data:text/plain;base64,aW52YWxpZCBkYXRh',
};

// Sample image data URL for testing
export const sampleImageDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

// Sample corner coordinates
export const sampleCorners: Record<string, Corners> = {
  // Default corners for a 100x100 image (topLeft, topRight, bottomRight, bottomLeft)
  default: [
    { x: 10, y: 10 },   // topLeft
    { x: 90, y: 10 },   // topRight
    { x: 90, y: 90 },   // bottomRight
    { x: 10, y: 90 },   // bottomLeft
  ],
  
  // Rotated document corners
  rotated: [
    { x: 20, y: 15 },   // topLeft
    { x: 85, y: 5 },    // topRight
    { x: 95, y: 85 },   // bottomRight
    { x: 15, y: 95 },   // bottomLeft
  ],
  
  // Very small area (should trigger validation)
  tooSmall: [
    { x: 45, y: 45 },   // topLeft
    { x: 55, y: 45 },   // topRight
    { x: 55, y: 55 },   // bottomRight
    { x: 45, y: 55 },   // bottomLeft
  ],
  
  // Invalid corners (overlapping)
  invalid: [
    { x: 50, y: 50 },   // topLeft
    { x: 50, y: 50 },   // topRight
    { x: 50, y: 50 },   // bottomRight
    { x: 50, y: 50 },   // bottomLeft
  ],
};

// Sample page data
export const samplePages: Record<string, Partial<Page>> = {
  basic: {
    id: 'page-1',
    originalImageDataURL: sampleImages.document,
    originalWidth: 100,
    originalHeight: 100,
    currentRotation: 0,
    corners: sampleCorners.default,
    mode: 'edit',
  },
  
  rotated90: {
    id: 'page-2',
    originalImageDataURL: sampleImages.document,
    originalWidth: 100,
    originalHeight: 100,
    currentRotation: 90,
    corners: sampleCorners.rotated,
    mode: 'edit',
  },
  
  processed: {
    id: 'page-3',
    originalImageDataURL: sampleImages.document,
    processedImageDataURL: sampleImages.document,
    originalWidth: 100,
    originalHeight: 100,
    currentRotation: 0,
    corners: sampleCorners.default,
    mode: 'preview',
  },
};

// Sample file objects
export const createSampleFile = (
  name: string = 'test-document.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
): File => {
  const content = atob(sampleImages.document.split(',')[1]);
  const bytes = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i++) {
    bytes[i] = content.charCodeAt(i);
  }
  return new File([bytes], name, { type });
};

// Sample error scenarios
export const errorScenarios = {
  openCvLoadFailed: {
    message: 'Failed to load OpenCV.js',
    code: 'OPENCV_LOAD_ERROR',
  },
  
  invalidImageFormat: {
    message: 'Invalid image format',
    code: 'INVALID_FORMAT',
  },
  
  processingFailed: {
    message: 'Image processing failed',
    code: 'PROCESSING_ERROR',
  },
  
  pdfGenerationFailed: {
    message: 'PDF generation failed',
    code: 'PDF_ERROR',
  },
};

// Mobile device user agents for testing
export const userAgents = {
  iosPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  iosTablet: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Performance test data
export const performanceTestData = {
  smallImage: { width: 100, height: 100 },
  mediumImage: { width: 800, height: 600 },
  largeImage: { width: 1920, height: 1080 },
  veryLargeImage: { width: 4000, height: 3000 },
};

// Test utilities
export const createMockImageData = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill with a simple pattern
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // Red
    data[i + 1] = 255; // Green
    data[i + 2] = 255; // Blue
    data[i + 3] = 255; // Alpha
  }
  return new ImageData(data, width, height);
};

export const createMockCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}; 