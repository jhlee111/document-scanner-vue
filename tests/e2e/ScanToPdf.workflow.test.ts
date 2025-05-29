import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test data paths
const TEST_IMAGES = {
  singleDocument: path.join(__dirname, '../fixtures/test-document.jpg'),
  multipleDocuments: [
    path.join(__dirname, '../fixtures/test-document-1.jpg'),
    path.join(__dirname, '../fixtures/test-document-2.jpg'),
    path.join(__dirname, '../fixtures/test-document-3.jpg')
  ],
  lowQuality: path.join(__dirname, '../fixtures/low-quality-document.jpg'),
  highResolution: path.join(__dirname, '../fixtures/high-res-document.jpg')
};

// Helper functions
async function waitForOpenCVReady(page: Page) {
  // Wait for OpenCV to load and the scan button to appear
  await expect(page.getByRole('button', { name: /scan document/i })).toBeVisible({ timeout: 30000 });
}

async function uploadImageFile(page: Page, imagePath: string, inputType: 'camera' | 'gallery' = 'gallery') {
  // Find the appropriate file input
  const inputSelector = inputType === 'camera' 
    ? 'input[type="file"][capture="environment"]'
    : 'input[type="file"][multiple]';
  
  const fileInput = page.locator(inputSelector);
  await fileInput.setInputFiles(imagePath);
}

async function uploadMultipleImageFiles(page: Page, imagePaths: string[]) {
  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles(imagePaths);
}

async function waitForImageProcessing(page: Page) {
  // Wait for any processing indicators to disappear
  await expect(page.getByText(/processing/i)).toBeHidden({ timeout: 30000 });
  await expect(page.getByText(/loading/i)).toBeHidden({ timeout: 30000 });
}

async function waitForPdfGeneration(page: Page) {
  // Wait for PDF generation to complete
  await expect(page.getByText(/generating pdf/i)).toBeHidden({ timeout: 30000 });
}

test.describe('Document Scanner - Complete Scan-to-PDF Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the document scanner
    await page.goto('/');
    
    // Wait for OpenCV to be ready
    await waitForOpenCVReady(page);
  });

  test.describe('Single Document Workflow', () => {
    test('should complete full scan-to-PDF workflow with single document', async ({ page }) => {
      // Step 1: Initial state verification
      await expect(page.getByRole('button', { name: /scan document/i })).toBeVisible();
      await expect(page.getByText(/loading scanner/i)).toBeHidden();
      
      // Step 2: Open scanner
      await page.getByRole('button', { name: /scan document/i }).click();
      
      // Step 3: Wait for fullscreen scanner to open
      await expect(page.locator('[data-testid="fullscreen-scanner"]')).toBeVisible({ timeout: 10000 });
      
      // Step 4: Upload a document image
      await uploadImageFile(page, TEST_IMAGES.singleDocument);
      
      // Step 5: Wait for image processing
      await waitForImageProcessing(page);
      
      // Step 6: Verify image preview is visible
      await expect(page.locator('[data-testid="image-preview"]')).toBeVisible({ timeout: 15000 });
      
      // Step 7: Verify corner detection and adjustment
      await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();
      
      // Verify canvas is interactive for corner adjustment
      const imagePreview = page.locator('[data-testid="image-preview"]');
      const canvas = imagePreview.locator('canvas');
      await expect(canvas).toBeVisible();
      
      // Test corner adjustment by clicking on canvas (simulates corner dragging)
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        // Click near corners to test interaction
        await canvas.click({ position: { x: 50, y: 50 } }); // Top-left area
        await canvas.click({ position: { x: canvasBox.width - 50, y: 50 } }); // Top-right area
      }
      
      // Step 8: Process the image (crop)
      await page.getByRole('button', { name: /crop/i }).click();
      
      // Step 9: Wait for processing to complete
      await waitForImageProcessing(page);
      
      // Step 10: Verify processed image is shown
      await expect(page.locator('[data-testid="processed-image"]')).toBeVisible({ timeout: 15000 });
      
      // Step 11: Generate PDF
      await page.getByRole('button', { name: /save/i }).click();
      
      // Step 12: Wait for PDF generation
      await waitForPdfGeneration(page);
      
      // Step 13: Verify PDF download
    //   const downloadPromise = page.waitForEvent('download');
    //   const download = await downloadPromise;
      
    //   expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      
      // Step 14: Verify scanner closes (if configured)
      // This depends on the closeAfterPdfCreated prop
    });

    test('should handle image rotation during workflow', async ({ page }) => {
      // Open scanner and upload image
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadImageFile(page, TEST_IMAGES.singleDocument);
      await waitForImageProcessing(page);
      
      // Rotate image right
      await page.getByRole('button', { name: /rotate right/i }).click();
      await waitForImageProcessing(page);
      
      // Verify rotation applied
      await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();
      
      // Rotate image left
      await page.getByRole('button', { name: /rotate left/i }).click();
      await waitForImageProcessing(page);
      
      // Process and generate PDF
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      // Verify PDF download
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });

    test('should handle corner adjustment workflow', async ({ page }) => {
      // Open scanner and upload image
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadImageFile(page, TEST_IMAGES.singleDocument);
      await waitForImageProcessing(page);
      
      // Verify corners are adjustable
      const imagePreview = page.locator('[data-testid="image-preview"]');
      const canvas = imagePreview.locator('canvas');
      await expect(canvas).toBeVisible();
      
      // Simulate corner adjustment by clicking on canvas
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        // Click and drag to simulate corner adjustment
        await canvas.click({ position: { x: 50, y: 50 } });
        await page.mouse.down();
        await page.mouse.move(100, 100);
        await page.mouse.up();
      }
      
      // Reset corners
      await page.getByRole('button', { name: /reset corners/i }).click();
      
      // Verify corners are reset
      await expect(canvas).toBeVisible();
      
      // Process and generate PDF
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });
  });

  test.describe('Multi-Page Document Workflow', () => {
    test('should handle multiple document pages in single PDF', async ({ page }) => {
      // Open scanner
      await page.getByRole('button', { name: /scan document/i }).click();
      
      // Upload multiple documents
      await uploadMultipleImageFiles(page, TEST_IMAGES.multipleDocuments);
      await waitForImageProcessing(page);
      
      // Verify multiple pages are loaded
      await expect(page.locator('[data-testid="page-thumbnail"]')).toHaveCount(3, { timeout: 15000 });
      
      // Process each page
      for (let i = 0; i < 3; i++) {
        // Select page
        await page.locator('[data-testid="page-thumbnail"]').nth(i).click();
        await waitForImageProcessing(page);
        
        // Process the page
        await page.getByRole('button', { name: /crop/i }).click();
        await waitForImageProcessing(page);
      }
      
      // Generate PDF with all pages
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      // Verify PDF download
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });

    test('should handle adding pages incrementally', async ({ page }) => {
      // Open scanner and add first page
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadImageFile(page, TEST_IMAGES.multipleDocuments[0]);
      await waitForImageProcessing(page);
      
      // Process first page
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      // Add second page
      await page.getByRole('button', { name: /add pages/i }).click();
      await uploadImageFile(page, TEST_IMAGES.multipleDocuments[1], 'camera');
      await waitForImageProcessing(page);
      
      // Verify two pages exist
      await expect(page.locator('[data-testid="page-thumbnail"]')).toHaveCount(2);
      
      // Process second page
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      // Generate PDF
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });

    test('should handle page deletion workflow', async ({ page }) => {
      // Open scanner and upload multiple pages
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadMultipleImageFiles(page, TEST_IMAGES.multipleDocuments);
      await waitForImageProcessing(page);
      
      // Verify all pages loaded
      await expect(page.locator('[data-testid="page-thumbnail"]')).toHaveCount(3);
      
      // Delete middle page
      await page.locator('[data-testid="page-thumbnail"]').nth(1).click();
      await page.getByRole('button', { name: /delete page/i }).click();
      
      // Verify page count reduced
      await expect(page.locator('[data-testid="page-thumbnail"]')).toHaveCount(2);
      
      // Process remaining pages and generate PDF
      await page.locator('[data-testid="page-thumbnail"]').first().click();
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.locator('[data-testid="page-thumbnail"]').last().click();
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle invalid file uploads gracefully', async ({ page }) => {
      // Open scanner
      await page.getByRole('button', { name: /scan document/i }).click();
      
      // Try to upload non-image file
      const textFile = path.join(__dirname, '../fixtures/test-document.txt');
      await uploadImageFile(page, textFile);
      
      // Should show error message
      await expect(page.getByText(/please select valid image files/i)).toBeVisible({ timeout: 5000 });
      
      // Scanner should remain functional
      await expect(page.locator('[data-testid="fullscreen-scanner"]')).toBeVisible();
    });

    test('should handle network interruption during processing', async ({ page }) => {
      // Open scanner and upload image
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadImageFile(page, TEST_IMAGES.singleDocument);
      await waitForImageProcessing(page);
      
      // Simulate network interruption
      await page.context().setOffline(true);
      
      // Try to process image
      await page.getByRole('button', { name: /crop/i }).click();
      
      // Should handle gracefully (may show error or retry)
      // Restore network
      await page.context().setOffline(false);
      
      // Should be able to continue
      await waitForImageProcessing(page);
    });

    test('should handle large image files', async ({ page }) => {
      // Open scanner
      await page.getByRole('button', { name: /scan document/i }).click();
      
      // Upload high resolution image
      await uploadImageFile(page, TEST_IMAGES.highResolution);
      
      // Should handle processing (may take longer)
      await waitForImageProcessing(page);
      
      // Verify image is processed
      await expect(page.locator('[data-testid="image-preview"]')).toBeVisible({ timeout: 30000 });
      
      // Complete workflow
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });

    test('should handle low quality images', async ({ page }) => {
      // Open scanner
      await page.getByRole('button', { name: /scan document/i }).click();
      
      // Upload low quality image
      await uploadImageFile(page, TEST_IMAGES.lowQuality);
      await waitForImageProcessing(page);
      
      // Should still detect corners (canvas should be interactive)
      const imagePreview = page.locator('[data-testid="image-preview"]');
      const canvas = imagePreview.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });
      
      // Complete workflow
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('should complete workflow within reasonable time limits', async ({ page }) => {
      const startTime = Date.now();
      
      // Complete full workflow
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadImageFile(page, TEST_IMAGES.singleDocument);
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /crop/i }).click();
      await waitForImageProcessing(page);
      
      await page.getByRole('button', { name: /save pdf/i }).click();
      await waitForPdfGeneration(page);
      
      const downloadPromise = page.waitForEvent('download');
      await downloadPromise;
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within 60 seconds
      expect(totalTime).toBeLessThan(60000);
    });

    test('should remain responsive during processing', async ({ page }) => {
      // Open scanner and upload image
      await page.getByRole('button', { name: /scan document/i }).click();
      await uploadImageFile(page, TEST_IMAGES.singleDocument);
      
      // During processing, UI should remain responsive
      await expect(page.getByRole('button', { name: /close/i })).toBeEnabled();
      await expect(page.getByRole('button', { name: /rotate left/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /rotate right/i })).toBeVisible();
      
      await waitForImageProcessing(page);
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Navigate to scanner using keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Should open scanner
      await expect(page.locator('[data-testid="fullscreen-scanner"]')).toBeVisible();
      
      // Should be able to navigate with keyboard
      await page.keyboard.press('Escape');
      
      // Should close scanner
      await expect(page.locator('[data-testid="fullscreen-scanner"]')).toBeHidden();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Check main scan button
      const scanButton = page.getByRole('button', { name: /scan document/i });
      await expect(scanButton).toHaveAttribute('title');
      
      // Open scanner and check accessibility
      await scanButton.click();
      
      // Check for proper roles and labels
      await expect(page.getByRole('button', { name: /crop/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /close/i })).toBeVisible();
    });
  });
}); 