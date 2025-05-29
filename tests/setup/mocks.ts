import { vi } from 'vitest';

// Mock OpenCV.js
export const mockOpenCV = {
  Mat: vi.fn().mockImplementation(() => ({
    delete: vi.fn(),
    rows: 100,
    cols: 100,
    channels: vi.fn().mockReturnValue(3),
    type: vi.fn().mockReturnValue(16),
    data: new Uint8Array(100 * 100 * 3),
  })),
  imread: vi.fn(),
  imshow: vi.fn(),
  cvtColor: vi.fn(),
  findContours: vi.fn(),
  approxPolyDP: vi.fn(),
  getPerspectiveTransform: vi.fn(),
  warpPerspective: vi.fn(),
  resize: vi.fn(),
  rotate: vi.fn(),
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 2,
  COLOR_RGBA2GRAY: 11,
  COLOR_GRAY2RGBA: 2,
  ROTATE_90_CLOCKWISE: 0,
  ROTATE_180: 1,
  ROTATE_90_COUNTERCLOCKWISE: 2,
  MatVector: vi.fn().mockImplementation(() => ({
    size: vi.fn().mockReturnValue(1),
    get: vi.fn().mockReturnValue({
      total: vi.fn().mockReturnValue(4),
      data32S: new Int32Array([10, 10, 90, 10, 90, 90, 10, 90]),
    }),
    delete: vi.fn(),
  })),
  Point: vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
  Size: vi.fn().mockImplementation((width: number, height: number) => ({ width, height })),
  Scalar: vi.fn().mockImplementation((r: number, g: number, b: number, a: number) => ({ val: [r, g, b, a] })),
};

// Mock File API
export const createMockFile = (
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock FileReader
export const mockFileReader = {
  readAsDataURL: vi.fn(),
  result: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
  onload: null as ((event: any) => void) | null,
  onerror: null as ((event: any) => void) | null,
};

// Mock Canvas API
export const mockCanvas = {
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(100 * 100 * 4),
      width: 100,
      height: 100,
    }),
    putImageData: vi.fn(),
    canvas: {
      width: 100,
      height: 100,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock-data'),
      toBlob: vi.fn().mockImplementation((callback) => {
        callback(new Blob(['mock-blob'], { type: 'image/png' }));
      }),
    },
  }),
  width: 100,
  height: 100,
  toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock-data'),
  toBlob: vi.fn().mockImplementation((callback) => {
    callback(new Blob(['mock-blob'], { type: 'image/png' }));
  }),
};

// Mock HTMLImageElement
export const mockImage = {
  src: '',
  width: 100,
  height: 100,
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  naturalWidth: 100,
  naturalHeight: 100,
};

// Mock MediaDevices API
export const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: vi.fn().mockReturnValue([
      {
        stop: vi.fn(),
        getSettings: vi.fn().mockReturnValue({
          width: 1920,
          height: 1080,
          facingMode: 'environment',
        }),
      },
    ]),
  }),
  enumerateDevices: vi.fn().mockResolvedValue([
    {
      deviceId: 'camera1',
      kind: 'videoinput',
      label: 'Back Camera',
    },
  ]),
};

// Mock URL API
export const mockURL = {
  createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: vi.fn(),
};

// Mock IntersectionObserver
export const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
export const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Setup global mocks
export const setupGlobalMocks = () => {
  // OpenCV.js global
  (global as any).cv = mockOpenCV;
  
  // DOM APIs
  (global as any).FileReader = vi.fn().mockImplementation(() => mockFileReader);
  (global as any).HTMLCanvasElement = vi.fn().mockImplementation(() => mockCanvas);
  (global as any).HTMLImageElement = vi.fn().mockImplementation(() => mockImage);
  (global as any).URL = { ...global.URL, ...mockURL };
  (global as any).IntersectionObserver = mockIntersectionObserver;
  (global as any).ResizeObserver = mockResizeObserver;
  
  // Navigator APIs
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: mockMediaDevices,
    writable: true,
  });
  
  Object.defineProperty(global.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    writable: true,
  });
  
  // Document methods - create proper DOM elements
  const originalCreateElement = global.document.createElement;
  global.document.createElement = vi.fn().mockImplementation((tagName: string) => {
    if (tagName === 'canvas') return mockCanvas;
    if (tagName === 'img') return mockImage;
    if (tagName === 'script') {
      // Create a proper script element mock
      const scriptElement = originalCreateElement.call(document, 'script');
      Object.defineProperty(scriptElement, 'onload', {
        set: vi.fn(),
        get: vi.fn(),
        configurable: true,
      });
      Object.defineProperty(scriptElement, 'onerror', {
        set: vi.fn(),
        get: vi.fn(),
        configurable: true,
      });
      return scriptElement;
    }
    if (tagName === 'input') return {
      type: '',
      accept: '',
      capture: '',
      click: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      files: [],
    };
    return originalCreateElement.call(document, tagName);
  });
}; 