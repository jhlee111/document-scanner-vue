import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePageManager } from '../../../src/composables/usePageManager';
import { samplePages, sampleCorners, createSampleFile } from '../../setup/fixtures';
import type { Page, PageUpdate } from '../../../src/types';

describe('usePageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock OpenCV as available
    (global as any).cv = {
      Mat: vi.fn(),
      imread: vi.fn(),
      cvtColor: vi.fn(),
      findContours: vi.fn(),
      approxPolyDP: vi.fn(),
    };
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { pages, currentPage, totalPages } = usePageManager();
      
      expect(pages.value).toEqual([]);
      expect(currentPage.value).toBeNull();
      expect(totalPages.value).toBe(0);
    });
  });

  describe('addFileAsPageWithProgress', () => {
    it('should add a new page from file with progress tracking', async () => {
      const { addFileAsPageWithProgress, pages, selectPage, currentPage } = usePageManager();
      const file = createSampleFile('test.jpg', 'image/jpeg');
      
      // Mock URL.createObjectURL
      const mockObjectURL = 'blob:mock-url';
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockObjectURL);
      global.URL.revokeObjectURL = vi.fn();
      
      // Mock Image loading
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock OpenCV functions
      const mockDetectDocumentCorners = vi.fn().mockResolvedValue([
        { x: 10, y: 10 },
        { x: 790, y: 10 },
        { x: 790, y: 590 },
        { x: 10, y: 590 },
      ]);
      
      const mockRotateImageDataURL = vi.fn().mockResolvedValue('rotated-data-url');
      
      // Mock the utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: mockDetectDocumentCorners,
        rotateImageDataURL: mockRotateImageDataURL,
      }));
      
      const progressCallback = vi.fn();
      const addPromise = addFileAsPageWithProgress(file, progressCallback);
      
      // Simulate Image loading
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);
      
      const pageId = await addPromise;
      
      expect(pages.value).toHaveLength(1);
      expect(progressCallback).toHaveBeenCalledWith('Complete!', 100);
      expect(pageId).toBeDefined();
      
      // Select the page to make it current
      selectPage(pageId);
      expect(currentPage.value).not.toBeNull();
      expect(currentPage.value?.originalFileName).toBe('test.jpg');
      expect(currentPage.value?.originalWidth).toBe(800);
      expect(currentPage.value?.originalHeight).toBe(600);
      expect(currentPage.value?.mode).toBe('edit');
    });

    it('should handle OpenCV not loaded error', async () => {
      // Remove OpenCV
      delete (global as any).cv;
      
      const { addFileAsPageWithProgress } = usePageManager();
      const file = createSampleFile('test.jpg', 'image/jpeg');
      const progressCallback = vi.fn();
      
      await expect(addFileAsPageWithProgress(file, progressCallback)).rejects.toThrow('OpenCV is not loaded yet');
    });

    it('should handle image loading errors', async () => {
      const { addFileAsPageWithProgress } = usePageManager();
      const file = createSampleFile('test.jpg', 'image/jpeg');
      
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as ((event: any) => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      const progressCallback = vi.fn();
      const addPromise = addFileAsPageWithProgress(file, progressCallback);
      
      // Simulate Image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Image load error'));
        }
      }, 0);
      
      await expect(addPromise).rejects.toThrow();
    });
  });

  describe('deletePage', () => {
    it('should remove a page by id', async () => {
      const { addFileAsPageWithProgress, deletePage, pages, selectPage, currentPage } = usePageManager();
      const file = createSampleFile('test.jpg', 'image/jpeg');
      
      // Setup mocks for adding page
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: vi.fn().mockResolvedValue(null),
        rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
      }));
      
      // Add a page
      const progressCallback = vi.fn();
      const addPromise = addFileAsPageWithProgress(file, progressCallback);
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);
      
      const pageId = await addPromise;
      selectPage(pageId);
      
      expect(pages.value).toHaveLength(1);
      expect(currentPage.value).not.toBeNull();
      
      // Remove the page
      deletePage(pageId);
      
      expect(pages.value).toHaveLength(0);
      expect(currentPage.value).toBeNull();
    });

    it('should handle removing non-existent page', () => {
      const { deletePage, pages } = usePageManager();
      
      // Try to remove non-existent page
      deletePage('non-existent-id');
      
      expect(pages.value).toHaveLength(0);
    });
  });

  describe('selectPage', () => {
    it('should set current page by id', async () => {
      const { addFileAsPageWithProgress, selectPage, currentPage, pageCountDisplay } = usePageManager();
      
      // Add two pages
      const file1 = createSampleFile('test1.jpg', 'image/jpeg');
      const file2 = createSampleFile('test2.jpg', 'image/jpeg');
      
      // Setup mocks
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: vi.fn().mockResolvedValue(null),
        rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
      }));
      
      const progressCallback = vi.fn();
      
      // Add pages
      const pageIds: string[] = [];
      for (const file of [file1, file2]) {
        const addPromise = addFileAsPageWithProgress(file, progressCallback);
        setTimeout(() => {
          if (mockImage.onload) {
            mockImage.onload();
          }
        }, 0);
        const pageId = await addPromise;
        pageIds.push(pageId);
      }
      
      // Select first page
      selectPage(pageIds[0]);
      expect(currentPage.value?.originalFileName).toBe('test1.jpg');
      expect(pageCountDisplay.value).toBe('1/2');
      
      // Select second page
      selectPage(pageIds[1]);
      expect(currentPage.value?.originalFileName).toBe('test2.jpg');
      expect(pageCountDisplay.value).toBe('2/2');
    });

    it('should handle selecting non-existent page', () => {
      const { selectPage, currentPage } = usePageManager();
      
      // Try to select non-existent page
      selectPage('non-existent-id');
      
      expect(currentPage.value).toBeNull();
    });
  });

  describe('updatePageData', () => {
    it('should update page data', async () => {
      const { addFileAsPageWithProgress, updatePageData, selectPage, currentPage } = usePageManager();
      const file = createSampleFile('test.jpg', 'image/jpeg');
      
      // Setup mocks and add page
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: vi.fn().mockResolvedValue(null),
        rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
      }));
      
      const progressCallback = vi.fn();
      const addPromise = addFileAsPageWithProgress(file, progressCallback);
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);
      
      const pageId = await addPromise;
      selectPage(pageId);
      
      // Update page data
      const updateData: PageUpdate = {
        corners: sampleCorners.default,
        currentRotation: 90,
        mode: 'preview',
      };
      
      updatePageData(pageId, updateData);
      
      expect(currentPage.value?.corners).toEqual(sampleCorners.default);
      expect(currentPage.value?.currentRotation).toBe(90);
      expect(currentPage.value?.mode).toBe('preview');
    });

    it('should handle updating non-existent page', () => {
      const { updatePageData } = usePageManager();
      
      const updateData: PageUpdate = {
        corners: sampleCorners.default,
      };
      
      // Should not throw error
      expect(() => {
        updatePageData('non-existent-id', updateData);
      }).not.toThrow();
    });
  });

  describe('clearAllPages', () => {
    it('should clear all pages', async () => {
      const { addFileAsPageWithProgress, clearAllPages, pages, currentPage } = usePageManager();
      const file = createSampleFile('test.jpg', 'image/jpeg');
      
      // Setup mocks and add page
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: vi.fn().mockResolvedValue(null),
        rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
      }));
      
      const progressCallback = vi.fn();
      const addPromise = addFileAsPageWithProgress(file, progressCallback);
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);
      
      await addPromise;
      expect(pages.value).toHaveLength(1);
      
      // Clear all pages
      clearAllPages();
      
      expect(pages.value).toHaveLength(0);
      expect(currentPage.value).toBeNull();
    });
  });

  describe('computed properties', () => {
    it('should calculate totalPages correctly', async () => {
      const { addFileAsPageWithProgress, totalPages } = usePageManager();
      
      expect(totalPages.value).toBe(0);
      
      // Add a page
      const file = createSampleFile('test.jpg', 'image/jpeg');
      
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: vi.fn().mockResolvedValue(null),
        rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
      }));
      
      const progressCallback = vi.fn();
      const addPromise = addFileAsPageWithProgress(file, progressCallback);
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);
      
      await addPromise;
      expect(totalPages.value).toBe(1);
    });
  });

  describe('navigation', () => {
    async function setupMultiplePages(pageManager: ReturnType<typeof usePageManager>) {
      const { addFileAsPageWithProgress } = pageManager;
      
      // Setup mocks
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        naturalWidth: 800,
        naturalHeight: 600,
      };
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      // Mock utils
      vi.doMock('../../../src/utils/opencvUtils', () => ({
        detectDocumentCorners: vi.fn().mockResolvedValue(null),
        rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
      }));
      
      const progressCallback = vi.fn();
      const pageIds: string[] = [];
      
      // Add 3 pages for testing
      for (let i = 1; i <= 3; i++) {
        const file = createSampleFile(`test${i}.jpg`, 'image/jpeg');
        const addPromise = addFileAsPageWithProgress(file, progressCallback);
        
        setTimeout(() => {
          if (mockImage.onload) {
            mockImage.onload();
          }
        }, 0);
        
        const pageId = await addPromise;
        pageIds.push(pageId);
      }
      
      return pageIds;
    }

    describe('moveToNextPage', () => {
      it('should move to next page when not at last page', async () => {
        const pageManager = usePageManager();
        const { selectPage, moveToNextPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // Start at first page
        selectPage(pageIds[0]);
        expect(currentPage.value?.originalFileName).toBe('test1.jpg');
        expect(pageCountDisplay.value).toBe('1/3');
        
        // Move to next page
        moveToNextPage();
        expect(currentPage.value?.originalFileName).toBe('test2.jpg');
        expect(pageCountDisplay.value).toBe('2/3');
        
        // Move to next page again
        moveToNextPage();
        expect(currentPage.value?.originalFileName).toBe('test3.jpg');
        expect(pageCountDisplay.value).toBe('3/3');
      });

      it('should stay at last page when trying to go beyond', async () => {
        const pageManager = usePageManager();
        const { selectPage, moveToNextPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // Start at last page
        selectPage(pageIds[2]);
        expect(currentPage.value?.originalFileName).toBe('test3.jpg');
        expect(pageCountDisplay.value).toBe('3/3');
        
        // Try to move beyond last page
        moveToNextPage();
        expect(currentPage.value?.originalFileName).toBe('test3.jpg');
        expect(pageCountDisplay.value).toBe('3/3');
      });

      it('should select first page when no active page', async () => {
        const pageManager = usePageManager();
        const { moveToNextPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // No active page initially
        expect(currentPage.value).toBeNull();
        
        // Move to next page should select first page
        moveToNextPage();
        expect(currentPage.value?.originalFileName).toBe('test1.jpg');
        expect(pageCountDisplay.value).toBe('1/3');
      });

      it('should handle empty pages array', () => {
        const { moveToNextPage, currentPage } = usePageManager();
        
        // No pages exist
        moveToNextPage();
        expect(currentPage.value).toBeNull();
      });
    });

    describe('moveToPrevPage', () => {
      it('should move to previous page when not at first page', async () => {
        const pageManager = usePageManager();
        const { selectPage, moveToPrevPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // Start at last page
        selectPage(pageIds[2]);
        expect(currentPage.value?.originalFileName).toBe('test3.jpg');
        expect(pageCountDisplay.value).toBe('3/3');
        
        // Move to previous page
        moveToPrevPage();
        expect(currentPage.value?.originalFileName).toBe('test2.jpg');
        expect(pageCountDisplay.value).toBe('2/3');
        
        // Move to previous page again
        moveToPrevPage();
        expect(currentPage.value?.originalFileName).toBe('test1.jpg');
        expect(pageCountDisplay.value).toBe('1/3');
      });

      it('should stay at first page when trying to go before', async () => {
        const pageManager = usePageManager();
        const { selectPage, moveToPrevPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // Start at first page
        selectPage(pageIds[0]);
        expect(currentPage.value?.originalFileName).toBe('test1.jpg');
        expect(pageCountDisplay.value).toBe('1/3');
        
        // Try to move before first page
        moveToPrevPage();
        expect(currentPage.value?.originalFileName).toBe('test1.jpg');
        expect(pageCountDisplay.value).toBe('1/3');
      });

      it('should select first page when no active page', async () => {
        const pageManager = usePageManager();
        const { moveToPrevPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // No active page initially
        expect(currentPage.value).toBeNull();
        
        // Move to previous page should select first page
        moveToPrevPage();
        expect(currentPage.value?.originalFileName).toBe('test1.jpg');
        expect(pageCountDisplay.value).toBe('1/3');
      });

      it('should handle empty pages array', () => {
        const { moveToPrevPage, currentPage } = usePageManager();
        
        // No pages exist
        moveToPrevPage();
        expect(currentPage.value).toBeNull();
      });
    });

    describe('combined navigation', () => {
      it('should navigate back and forth correctly', async () => {
        const pageManager = usePageManager();
        const { selectPage, moveToNextPage, moveToPrevPage, currentPage, pageCountDisplay } = pageManager;
        const pageIds = await setupMultiplePages(pageManager);
        
        // Start at first page
        selectPage(pageIds[0]);
        expect(pageCountDisplay.value).toBe('1/3');
        
        // Navigate: 1 -> 2 -> 3 -> 2 -> 1
        moveToNextPage();
        expect(pageCountDisplay.value).toBe('2/3');
        
        moveToNextPage();
        expect(pageCountDisplay.value).toBe('3/3');
        
        moveToPrevPage();
        expect(pageCountDisplay.value).toBe('2/3');
        
        moveToPrevPage();
        expect(pageCountDisplay.value).toBe('1/3');
      });

      it('should handle single page navigation', async () => {
        const { addFileAsPageWithProgress, selectPage, moveToNextPage, moveToPrevPage, currentPage, pageCountDisplay } = usePageManager();
        
        // Setup mocks for single page
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
        
        const mockImage = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          src: '',
          naturalWidth: 800,
          naturalHeight: 600,
        };
        global.Image = vi.fn().mockImplementation(() => mockImage);
        
        vi.doMock('../../../src/utils/opencvUtils', () => ({
          detectDocumentCorners: vi.fn().mockResolvedValue(null),
          rotateImageDataURL: vi.fn().mockResolvedValue('rotated-data-url'),
        }));
        
        // Add single page
        const file = createSampleFile('single.jpg', 'image/jpeg');
        const progressCallback = vi.fn();
        const addPromise = addFileAsPageWithProgress(file, progressCallback);
        
        setTimeout(() => {
          if (mockImage.onload) {
            mockImage.onload();
          }
        }, 0);
        
        const pageId = await addPromise;
        selectPage(pageId);
        
        expect(pageCountDisplay.value).toBe('1/1');
        
        // Both navigation methods should keep it on the same page
        moveToNextPage();
        expect(pageCountDisplay.value).toBe('1/1');
        expect(currentPage.value?.originalFileName).toBe('single.jpg');
        
        moveToPrevPage();
        expect(pageCountDisplay.value).toBe('1/1');
        expect(currentPage.value?.originalFileName).toBe('single.jpg');
      });
    });
  });
}); 