import { ref, computed, readonly, DeepReadonly, Ref } from 'vue';
import { nanoid as uuidv4 } from 'nanoid';
import { Page, PageUpdate, Point, Corners } from '../types';
import { revokeObjectURL } from '../utils/fileHelpers';
import { detectDocumentCorners, rotateImageDataURL } from '../utils/opencvUtils';
import { generateDefaultCornersPx, transformCornersForRotation, transformDisplayCornersToBase } from '../utils/imageProcessing';

export function usePageManager() {
  const pages = ref<Page[]>([]);
  const activePageId = ref<string | null>(null);

  const currentPage = computed<Page | null>(() => {
    if (!activePageId.value) return null;
    return pages.value.find(p => p.id === activePageId.value) || null;
  });

  const getPageById = (pageId: string): Page | undefined => {
    return pages.value.find(p => p.id === pageId);
  };

  const pagesForThumbnailStrip = computed(() => readonly(pages.value));

  const pageCountDisplay = computed(() => {
    const activeIdx = activePageId.value ? pages.value.findIndex(p => p.id === activePageId.value) : -1;
    const currentNum = activeIdx !== -1 ? activeIdx + 1 : pages.value.length > 0 ? 1 : 0;
    const totalNum = pages.value.length;
    return `${currentNum}/${totalNum}`;
  });

  const totalPages = computed(() => pages.value.length);

  const addFileAsPageWithProgress = async (
    file: File, 
    progressCallback: (status: string, progress: number) => void
  ): Promise<string> => {
    let originalImageDataURL: string | null = null;
    
    // Check if OpenCV is available before processing
    if (typeof window !== 'undefined' && !(window as any).cv) {
      throw new Error('OpenCV is not loaded yet. Please wait for the scanner to initialize.');
    }
    
    try {
      progressCallback('Loading image...', 0);
      
      originalImageDataURL = URL.createObjectURL(file);
      const img = new Image();
      
      const pageId = await new Promise<string>(async (resolve, reject) => {
        img.onload = async () => {
          try {
            console.log(`[usePageManager] Image loaded successfully for ${file.name}, dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
            progressCallback('Analyzing document...', 20);
            
            // Corner detection with progress feedback
            console.log(`[usePageManager] Starting corner detection for ${file.name}...`);
            const detectedCvCorners: Point[] | null = await detectDocumentCorners(originalImageDataURL!);
            console.log(`[usePageManager] Corner detection completed for ${file.name}, found:`, detectedCvCorners?.length || 0, 'corners');
            
            progressCallback('Processing corners...', 40);
            
            let initialBaseCorners: Corners;
            if (detectedCvCorners && detectedCvCorners.length === 4) {
              initialBaseCorners = [
                detectedCvCorners[0],
                detectedCvCorners[1],
                detectedCvCorners[2],
                detectedCvCorners[3],
              ] as Corners; 
            } else {
              console.warn(`[usePageManager] Corners not detected or invalid for ${file.name}, using fallback.`);
              initialBaseCorners = generateDefaultCornersPx(img.naturalWidth, img.naturalHeight, 32);
            }

            progressCallback('Auto-processing document...', 60);

            const newPageId = uuidv4();
            
            // Create the page first
            const newPage: Page = {
              id: newPageId,
              originalFile: file,
              originalFileName: file.name,
              originalImageDataURL: originalImageDataURL!,
              originalWidth: img.naturalWidth,
              originalHeight: img.naturalHeight,
              
              corners: initialBaseCorners, 
              currentRotation: 0,

              processedImageDataURL: null,
              processedWidth: null,
              processedHeight: null,
              timestampProcessed: null,
              mode: 'preview', // Start in preview mode since we'll auto-process
              timestampAdded: Date.now(),
              
              // Add default output format
              outputFormat: {
                name: 'Letter Portrait',
                ratio: 8.5 / 11,
                dimensions: '8.5" × 11"',
                category: 'standard' as const
              }
            };
            
            pages.value.push(newPage);
            
            // Auto-process the image immediately
            try {
              progressCallback('Processing document...', 80);
              
              // Import the proper perspective transform function that handles formats
              const { useImageProcessing } = await import('../composables/useImageProcessing');
              const { ref } = await import('vue');
              
              // Create a temporary ref for OpenCV ready state
              const isOpenCVReady = ref(true); // We already checked OpenCV is available above
              
              // Get the processing function
              const { performPerspectiveTransform } = useImageProcessing(isOpenCVReady);
              
              const result = await performPerspectiveTransform(
                originalImageDataURL!,
                initialBaseCorners,
                newPage.outputFormat // Pass the paper format for proper sizing
              );
              
              if (result && result.imageDataURL) {
                // Update the page with processed image
                const pageIndex = pages.value.findIndex(p => p.id === newPageId);
                if (pageIndex !== -1) {
                  pages.value[pageIndex] = {
                    ...pages.value[pageIndex],
                    processedImageDataURL: result.imageDataURL,
                    processedWidth: result.processedWidth,
                    processedHeight: result.processedHeight,
                    timestampProcessed: Date.now(),
                    mode: 'preview'
                  };
                }
                console.log(`[usePageManager] Auto-processed page ${newPageId} successfully`);
              } else {
                console.warn(`[usePageManager] Auto-processing failed for ${newPageId}, keeping in edit mode`);
                // Update to edit mode if processing failed
                const pageIndex = pages.value.findIndex(p => p.id === newPageId);
                if (pageIndex !== -1) {
                  pages.value[pageIndex] = {
                    ...pages.value[pageIndex],
                    mode: 'edit'
                  };
                }
              }
            } catch (processingError) {
              console.warn(`[usePageManager] Auto-processing error for ${newPageId}:`, processingError);
              // Keep in edit mode if auto-processing fails
              const pageIndex = pages.value.findIndex(p => p.id === newPageId);
              if (pageIndex !== -1) {
                pages.value[pageIndex] = {
                  ...pages.value[pageIndex],
                  mode: 'edit'
                };
              }
            }
            
            progressCallback('Complete!', 100);
            resolve(newPageId);
            
          } catch (processingError) {
            console.error(`[usePageManager] Error processing image ${file.name} after load:`, processingError);
            if (originalImageDataURL) {
              revokeObjectURL(originalImageDataURL);
            }
            reject(processingError);
          }
        };
        
        img.onerror = (errorEvent) => {
          console.error(`[usePageManager] Error loading image ${file.name} (img.onerror):`, errorEvent);
          if (originalImageDataURL) {
            revokeObjectURL(originalImageDataURL);
          }
          reject(new Error(`Failed to load image: ${file.name}`));
        };
        
        // Set the src AFTER the event handlers are attached to avoid race condition
        if (originalImageDataURL) {
          img.src = originalImageDataURL;
        } else {
          reject(new Error('Failed to create object URL for image'));
        }
      });

      return pageId;

    } catch (error) {
      console.error(`[usePageManager] Failed to process file ${file.name} into a Page object:`, error);
      if (originalImageDataURL) {
        revokeObjectURL(originalImageDataURL);
      }
      throw error;
    }
  };

  const addFilesAsPages = async (files: File[]): Promise<string[]> => {
    const newPageIds: string[] = [];
    for (const file of files) {
      let originalImageDataURL: string | null = null;
      try {
        originalImageDataURL = URL.createObjectURL(file);
        const img = new Image();
        
        const loadPromise = new Promise<void>(async (resolve, reject) => {
          img.onload = async () => {
            try {
              const detectedCvCorners: Point[] | null = await detectDocumentCorners(originalImageDataURL!);
              
              let initialBaseCorners: Corners;
              if (detectedCvCorners && detectedCvCorners.length === 4) {
                initialBaseCorners = [
                    detectedCvCorners[0],
                    detectedCvCorners[1],
                    detectedCvCorners[2],
                    detectedCvCorners[3],
                ] as Corners; 
              } else {
                console.warn(`[usePageManager] Corners not detected or invalid for ${file.name}, using fallback.`);
                initialBaseCorners = generateDefaultCornersPx(img.naturalWidth, img.naturalHeight, 32);
              }

              const newPage: Page = {
                id: uuidv4(),
                originalFile: file,
                originalFileName: file.name,
                originalImageDataURL: originalImageDataURL!,
                originalWidth: img.naturalWidth,
                originalHeight: img.naturalHeight,
                
                corners: initialBaseCorners, 
                currentRotation: 0,

                processedImageDataURL: null,
                processedWidth: null,
                processedHeight: null,
                timestampProcessed: null,
                mode: 'edit', 
                timestampAdded: Date.now(),
                
                // Add default output format
                outputFormat: {
                  name: 'Letter Portrait',
                  ratio: 8.5 / 11,
                  dimensions: '8.5" × 11"',
                  category: 'standard' as const
                }
              };
              pages.value.push(newPage);
              newPageIds.push(newPage.id);
              resolve();
            } catch (processingError) {
              console.error(`[usePageManager] Error processing image ${file.name} after load:`, processingError);
              if (originalImageDataURL) {
                revokeObjectURL(originalImageDataURL);
              }
              reject(processingError);
            }
          };
          img.onerror = (errorEvent) => {
            console.error(`[usePageManager] Error loading image ${file.name} (img.onerror):`, errorEvent);
            if (originalImageDataURL) {
              revokeObjectURL(originalImageDataURL);
            }
            reject(new Error(`Failed to load image: ${file.name}`));
          };
        });

        img.src = originalImageDataURL;
        await loadPromise;

      } catch (error) {
        console.error(`[usePageManager] Failed to process file ${file.name} into a Page object:`, error);
        if (originalImageDataURL) {
            revokeObjectURL(originalImageDataURL);
        }
        throw error;
      }
    }

    if (newPageIds.length > 0 && !activePageId.value) {
      selectPage(newPageIds[0]);
    } else if (newPageIds.length > 0 && activePageId.value) {
        // No-op for now, keep current active page
    }
    
    return newPageIds;
  };

  const selectPage = (pageId: string | null) => {
    console.log('[usePageManager] Selecting page:', pageId);
    if (pageId === null) {
        activePageId.value = null;
        return;
    }
    const pageExists = pages.value.some(p => p.id === pageId);
    if (pageExists) {
      activePageId.value = pageId;
    } else {
      console.warn(`[usePageManager] Attempted to select non-existent page: ${pageId}`);
      if (pages.value.length > 0) {
        activePageId.value = pages.value[0].id;
      } else {
        activePageId.value = null;
      }
    }
  };

  const updatePageData = (pageId: string, data: PageUpdate) => {
    const pageIndex = pages.value.findIndex(p => p.id === pageId);
    if (pageIndex !== -1) {
      const currentPageObject = pages.value[pageIndex];
      let updatedPage: Page = { ...currentPageObject }; 
      let resetProcessedImage = false;

      // Capture the state of corners *before* any modifications in this update cycle.
      // These are relative to currentPageObject.currentRotation.
      const cornersBeforeThisUpdate = currentPageObject.corners ? [...currentPageObject.corners] : null;

      // 1. Handle rotation change
      if (data.currentRotation !== undefined && data.currentRotation !== updatedPage.currentRotation) {
        console.log(`[usePageManager] Updating rotation from ${updatedPage.currentRotation} to ${data.currentRotation} for page ${pageId}`);
        updatedPage.currentRotation = data.currentRotation;
        resetProcessedImage = true;

        if (cornersBeforeThisUpdate) { // If there were corners on the page before this update started
          const newRotatedCorners = transformCornersForRotation(
            cornersBeforeThisUpdate,      // Corners relative to the *old* rotation
            updatedPage.currentRotation,    // The new target rotation
            updatedPage.originalWidth,
            updatedPage.originalHeight
          );
          if (newRotatedCorners) {
            updatedPage.corners = newRotatedCorners; // These corners are now relative to the new rotation
            console.log('[usePageManager] Corners transformed due to rotation change:', updatedPage.corners);
          } else {
            console.warn(`[usePageManager] Corner transformation returned null for rotation ${updatedPage.currentRotation}. Setting corners to null.`);
            updatedPage.corners = null; 
          }
        } else {
          updatedPage.corners = null; // No previous corners to transform, so still null
        }
      }

      // 2. Handle explicit corner update (e.g., from user interaction via ImagePreview)
      // These `data.corners` are assumed to be ALREADY RELATIVE to `updatedPage.currentRotation`
      // (which might have just been updated above, or was the page's existing rotation).
      // This will overwrite any corners that might have been set by the rotation logic block.
      if (data.corners !== undefined) {
        console.log(`[usePageManager] Explicitly updating corners for page ${pageId} to:`, data.corners, `(rotation: ${updatedPage.currentRotation})`);
        updatedPage.corners = data.corners ? [...data.corners] : null; // Accept new corners directly
        if (!resetProcessedImage) { // Only set if rotation didn't already set it
            resetProcessedImage = true;
        }
      }
      
      // Reset processed image if necessary (either rotation or explicit corners changed)
      if (resetProcessedImage) {
        console.log(`[usePageManager] Resetting processed image for page ${pageId} due to rotation or corner change.`);
        updatedPage.processedImageDataURL = null;
        updatedPage.processedWidth = null;
        updatedPage.processedHeight = null;
        updatedPage.timestampProcessed = null;
        if (updatedPage.mode === 'preview') { // Only revert to 'edit' if it was 'preview'
            updatedPage.mode = 'edit';
        }
      }

      // Apply other direct updates from data if they exist
      // This allows setting processed image data if it wasn't reset, or setting mode independently.
      if (data.processedImageDataURL !== undefined && !resetProcessedImage) {
        updatedPage.processedImageDataURL = data.processedImageDataURL;
        updatedPage.processedWidth = data.processedWidth !== undefined ? data.processedWidth : null;
        updatedPage.processedHeight = data.processedHeight !== undefined ? data.processedHeight : null;
        if (data.processedImageDataURL) { // Only set timestamp and mode if URL is set
            updatedPage.timestampProcessed = Date.now(); 
            updatedPage.mode = data.mode !== undefined ? data.mode : 'preview'; 
        } else { // If URL is explicitly set to null here, ensure processed state is cleared
            updatedPage.timestampProcessed = null;
            updatedPage.mode = 'edit';
        }
      }
      
      if (data.mode !== undefined && data.mode !== updatedPage.mode) {
          updatedPage.mode = data.mode;
      }
      
      // Handle outputFormat updates
      if (data.outputFormat !== undefined) {
        updatedPage.outputFormat = data.outputFormat;
        console.log(`[usePageManager] Updated outputFormat for page ${pageId}:`, data.outputFormat);
      }
      
      pages.value.splice(pageIndex, 1, updatedPage);
      console.log('[usePageManager] Updated page data for:', pageId, JSON.parse(JSON.stringify(data)), 'Resulting page:', JSON.parse(JSON.stringify(updatedPage)));
    } else {
      console.warn(`[usePageManager] Cannot update page data: Page with ID ${pageId} not found.`);
    }
  };

  const deletePage = (pageId: string) => {
    const pageIndex = pages.value.findIndex(p => p.id === pageId);
    if (pageIndex !== -1) {
      const pageToDelete = pages.value[pageIndex];
      
      if (pageToDelete.originalImageDataURL?.startsWith('blob:')) {
        revokeObjectURL(pageToDelete.originalImageDataURL);
      }
      if (pageToDelete.processedImageDataURL?.startsWith('blob:')) {
        revokeObjectURL(pageToDelete.processedImageDataURL);
      }

      pages.value.splice(pageIndex, 1);
      console.log(`[usePageManager] Deleted page: ${pageId}`);

      if (activePageId.value === pageId) {
        if (pages.value.length > 0) {
          const nextPageIndex = Math.min(pageIndex, pages.value.length - 1);
          selectPage(pages.value[nextPageIndex].id);
        } else {
          selectPage(null);
        }
      }
    } else {
      console.warn(`[usePageManager] Cannot delete page: Page with ID ${pageId} not found.`);
    }
  };
  
  const clearAllPages = () => {
    pages.value.forEach(page => {
      if (page.originalImageDataURL?.startsWith('blob:')) {
        revokeObjectURL(page.originalImageDataURL);
      }
      if (page.processedImageDataURL?.startsWith('blob:')) {
        revokeObjectURL(page.processedImageDataURL);
      }
    });
    pages.value = [];
    activePageId.value = null;
    console.log('[usePageManager] All pages cleared.');
  };

  const reorderPages = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= pages.value.length || toIndex < 0 || toIndex >= pages.value.length) {
      console.warn(`[usePageManager] Invalid reorder indices: from ${fromIndex} to ${toIndex}`);
      return;
    }
    
    if (fromIndex === toIndex) {
      return; // No change needed
    }
    
    const newPages = [...pages.value];
    const [movedPage] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, movedPage);
    
    pages.value = newPages;
    console.log(`[usePageManager] Reordered page from index ${fromIndex} to ${toIndex}`);
  };

  const moveToNextPage = () => {
    if (pages.value.length === 0) {
      console.warn('[usePageManager] No pages available to navigate');
      return;
    }
    
    const currentIndex = activePageId.value 
      ? pages.value.findIndex(p => p.id === activePageId.value) 
      : -1;
    
    if (currentIndex === -1) {
      // No active page, select first page
      selectPage(pages.value[0].id);
      return;
    }
    
    // Move to next page, but don't go beyond last page
    const nextIndex = Math.min(currentIndex + 1, pages.value.length - 1);
    
    if (nextIndex !== currentIndex) {
      selectPage(pages.value[nextIndex].id);
      console.log(`[usePageManager] Moved to next page: index ${nextIndex}`);
    } else {
      console.log(`[usePageManager] Already at last page`);
    }
  };

  const moveToPrevPage = () => {
    if (pages.value.length === 0) {
      console.warn('[usePageManager] No pages available to navigate');
      return;
    }
    
    const currentIndex = activePageId.value 
      ? pages.value.findIndex(p => p.id === activePageId.value) 
      : -1;
    
    if (currentIndex === -1) {
      // No active page, select first page
      selectPage(pages.value[0].id);
      return;
    }
    
    // Move to previous page, but don't go before first page
    const prevIndex = Math.max(currentIndex - 1, 0);
    
    if (prevIndex !== currentIndex) {
      selectPage(pages.value[prevIndex].id);
      console.log(`[usePageManager] Moved to previous page: index ${prevIndex}`);
    } else {
      console.log(`[usePageManager] Already at first page`);
    }
  };

  const cleanupAllObjectURLs = () => {
     pages.value.forEach(page => {
      if (page.originalImageDataURL?.startsWith('blob:')) {
        try { revokeObjectURL(page.originalImageDataURL); } catch (e) { console.warn('Error revoking original URL', e); }
      }
      if (page.processedImageDataURL?.startsWith('blob:')) {
         try { revokeObjectURL(page.processedImageDataURL); } catch (e) { console.warn('Error revoking processed URL', e); }
      }
    });
  };

  return {
    pages: pagesForThumbnailStrip,
    activePageId: readonly(activePageId),
    currentPage,
    pageCountDisplay,
    totalPages,
    addFilesAsPages,
    addFileAsPageWithProgress,
    selectPage,
    updatePageData,
    deletePage,
    getPageById,
    clearAllPages,
    reorderPages,
    moveToNextPage,
    moveToPrevPage,
    cleanupAllObjectURLs,
  };
} 