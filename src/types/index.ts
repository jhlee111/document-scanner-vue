export interface Point {
  x: number;
  y: number;
}

export type Corners = [Point, Point, Point, Point];

export interface PaperFormat {
  name: string;
  ratio: number;
  dimensions: string;
  category: 'standard' | 'custom';
}

export interface Page {
  id: string;
  originalFile: File;
  originalFileName: string;
  originalImageDataURL: string;
  originalWidth: number;
  originalHeight: number;
  corners: Corners | null;
  currentRotation: 0 | 90 | 180 | 270;
  processedImageDataURL?: string | null;
  processedWidth?: number | null;
  processedHeight?: number | null;
  timestampProcessed?: number | null;
  mode: 'edit' | 'preview';
  timestampAdded: number;
  outputFormat?: PaperFormat | null;
  detectedRatio?: number | null;
  detectedConfidence?: number | null;
}

export interface PageUpdate {
  corners?: Corners | null;
  currentRotation?: 0 | 90 | 180 | 270;
  processedImageDataURL?: string | null;
  processedWidth?: number | null;
  processedHeight?: number | null;
  mode?: 'edit' | 'preview';
  outputFormat?: PaperFormat | null;
  detectedRatio?: number | null;
  detectedConfidence?: number | null;
}

export interface ProcessedPageData {
  imageDataURL: string;
  width: number;
  height: number;
}

export interface OpenCVLoadingStatus {
  loading: boolean;
  error: string | null;
}

// OpenCV global types
declare global {
  interface Window {
    cv: any;
  }
  const cv: any;
}