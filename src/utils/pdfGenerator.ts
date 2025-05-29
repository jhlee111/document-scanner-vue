import jsPDF from 'jspdf';

export interface ProcessedPageData {
  imageDataURL: string;
  width: number; // Processed width of the image
  height: number; // Processed height of the image
}

/**
 * Generates a PDF document from an array of processed page images.
 * Each image is placed on a new page in the PDF, fitting the page
 * while maintaining its aspect ratio.
 *
 * @param pages An array of objects, each containing the processed image data URL,
 *              its width, and its height.
 * @returns A Promise that resolves to a Blob containing the PDF data, or null if generation fails.
 */
export async function generatePdfFromProcessedPages(
  pages: ProcessedPageData[]
): Promise<Blob | null> {
  if (!pages || pages.length === 0) {
    console.error('[pdfGenerator] No pages provided for PDF generation.');
    return null;
  }

  try {
    // Default to portrait, letter size. Units are in points (pt).
    // Letter dimensions: 8.5in x 11in. 1 inch = 72 points.
    // So, Letter width = 8.5 * 72 = 612 pt
    // Letter height = 11 * 72 = 792 pt
    const pdf = new jsPDF({
      orientation: 'p', // portrait
      unit: 'pt',
      format: 'letter' // Letter page size
    });

    const letterWidth = 612;
    const letterHeight = 792;
    const margin = 0; // No margin

    const contentWidth = letterWidth - 2 * margin;
    const contentHeight = letterHeight - 2 * margin;

    for (let i = 0; i < pages.length; i++) {
      const pageData = pages[i];
      if (i > 0) {
        pdf.addPage();
      }

      const imgWidth = pageData.width;
      const imgHeight = pageData.height;
      const aspectRatio = imgWidth / imgHeight;

      let pdfImgWidth, pdfImgHeight;

      if (aspectRatio > (contentWidth / contentHeight)) {
        // Image is wider or less tall than content area, fit to width
        pdfImgWidth = contentWidth;
        pdfImgHeight = contentWidth / aspectRatio;
      } else {
        // Image is taller or less wide, fit to height
        pdfImgHeight = contentHeight;
        pdfImgWidth = contentHeight * aspectRatio;
      }

      // Center the image on the page
      const x = margin + (contentWidth - pdfImgWidth) / 2;
      const y = margin + (contentHeight - pdfImgHeight) / 2;

      pdf.addImage(pageData.imageDataURL, 'JPEG', x, y, pdfImgWidth, pdfImgHeight);
    }

    return pdf.output('blob');
  } catch (error) {
    console.error('[pdfGenerator] Error generating PDF:', error);
    return null;
  }
} 