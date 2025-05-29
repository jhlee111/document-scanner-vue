import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePdfFromProcessedPages, type ProcessedPageData } from '../../../src/utils/pdfGenerator';
import { samplePages, createSampleFile } from '../../setup/fixtures';

// Mock jsPDF
const mockJsPDF = {
  addImage: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
  output: vi.fn(),
};

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => mockJsPDF),
}));

describe('pdfGenerator utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations
    mockJsPDF.addImage.mockImplementation(() => {});
    mockJsPDF.addPage.mockImplementation(() => {});
    mockJsPDF.save.mockImplementation(() => {});
    // Ensure the output mock returns a proper blob when called with 'blob' parameter
    mockJsPDF.output.mockImplementation((type: string) => {
      if (type === 'blob') {
        return new Blob(['mock-pdf-data'], { type: 'application/pdf' });
      }
      return new Blob(['mock-pdf-data'], { type: 'application/pdf' });
    });
  });

  describe('generatePdfFromProcessedPages', () => {
    it('should generate PDF from multiple pages', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,page1',
          width: 800,
          height: 600,
        },
        {
          imageDataURL: 'data:image/jpeg;base64,page2',
          width: 800,
          height: 600,
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeInstanceOf(Blob);
      expect(result?.type).toBe('application/pdf');
      expect(mockJsPDF.addImage).toHaveBeenCalledTimes(2);
      expect(mockJsPDF.addPage).toHaveBeenCalledTimes(1); // One less than pages count
    });

    it('should generate PDF from single page', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,page1',
          width: 800,
          height: 600,
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeInstanceOf(Blob);
      expect(mockJsPDF.addImage).toHaveBeenCalledTimes(1);
      expect(mockJsPDF.addPage).not.toHaveBeenCalled();
    });

    it('should handle empty pages array', async () => {
      const result = await generatePdfFromProcessedPages([]);

      expect(result).toBeNull();
      expect(mockJsPDF.addImage).not.toHaveBeenCalled();
    });

    it('should handle null pages array', async () => {
      const result = await generatePdfFromProcessedPages(null as any);

      expect(result).toBeNull();
      expect(mockJsPDF.addImage).not.toHaveBeenCalled();
    });

    it('should center images on page', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,page1',
          width: 400, // Small image that needs centering
          height: 300,
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeInstanceOf(Blob);
      expect(mockJsPDF.addImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,page1',
        'JPEG',
        expect.any(Number), // x position (should be centered)
        expect.any(Number), // y position (should be centered)
        expect.any(Number), // width
        expect.any(Number)  // height
      );
    });

    it('should handle wide images (fit to width)', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,wide-page',
          width: 1200, // Wide image
          height: 400,
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeInstanceOf(Blob);
      expect(mockJsPDF.addImage).toHaveBeenCalled();
    });

    it('should handle tall images (fit to height)', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,tall-page',
          width: 400,
          height: 1200, // Tall image
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeInstanceOf(Blob);
      expect(mockJsPDF.addImage).toHaveBeenCalled();
    });

    it('should handle PDF generation errors', async () => {
      mockJsPDF.addImage.mockImplementation(() => {
        throw new Error('PDF generation failed');
      });

      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,page1',
          width: 800,
          height: 600,
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeNull();
    });

    it('should handle jsPDF output errors', async () => {
      mockJsPDF.output.mockImplementation(() => {
        throw new Error('PDF output failed');
      });

      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,page1',
          width: 800,
          height: 600,
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeNull();
    });

    it('should use letter size format', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,page1',
          width: 800,
          height: 600,
        },
      ];

      await generatePdfFromProcessedPages(pages);

      // Verify jsPDF was initialized with correct options
      const { default: jsPDF } = await import('jspdf');
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: 'p',
        unit: 'pt',
        format: 'letter',
      });
    });

    it('should handle different image sizes and scaling', async () => {
      const pages: ProcessedPageData[] = [
        {
          imageDataURL: 'data:image/jpeg;base64,test-page',
          width: 800,
          height: 800, // Square image
        },
      ];

      const result = await generatePdfFromProcessedPages(pages);

      expect(result).toBeInstanceOf(Blob);
      expect(result?.type).toBe('application/pdf');
      expect(mockJsPDF.addImage).toHaveBeenCalled();
    });
  });
}); 