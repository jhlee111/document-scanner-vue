import { ref, type ComputedRef, type DeepReadonly, type Ref } from 'vue'
import type { Page } from '@/types'
import { generatePdfFromProcessedPages, type ProcessedPageData } from '@/utils/pdfGenerator'

export interface PdfGenerationOptions {
  pageManager: {
    pages: ComputedRef<DeepReadonly<Page[]>>
    getPageById: (pageId: string) => Page | undefined
  }
  imageOperations: {
    isLoading: Ref<boolean>
    applyPerspectiveTransformAndGetDataURL: (pageId: string) => Promise<string | null>
  }
  closeAfterPdfCreated: boolean
  onPdfCreated: (pdfBlob: Blob) => void
  onCloseScanner: () => void
}

export function usePdfGeneration(options: PdfGenerationOptions) {
  // Processing state
  const isProcessingPdf = ref(false)

  const createPdfFromAllPages = async () => {
    console.log('[usePdfGeneration] Starting PDF creation process...')
    
    if (options.pageManager.pages.value.length === 0) {
      console.warn('[usePdfGeneration] No pages available for PDF creation')
      alert('No pages to create PDF from.')
      return
    }

    console.log(`[usePdfGeneration] Processing ${options.pageManager.pages.value.length} pages...`)
    options.imageOperations.isLoading.value = true
    isProcessingPdf.value = true

    try {
      // Process all pages that don't have processed images yet
      const pagesToProcessInitially = [...options.pageManager.pages.value]
      console.log('[usePdfGeneration] Checking pages for processing...')
      
      for (const page of pagesToProcessInitially) {
        const currentVersionInManager = options.pageManager.getPageById(page.id)
        if (!currentVersionInManager) {
          console.warn(`[usePdfGeneration] Page ${page.id} was deleted before PDF creation loop, skipping.`)
          continue
        }
        
        if (!currentVersionInManager.processedImageDataURL) {
          console.log(`[usePdfGeneration] Processing page ${page.id} for PDF...`)
          await options.imageOperations.applyPerspectiveTransformAndGetDataURL(currentVersionInManager.id)
        } else {
          console.log(`[usePdfGeneration] Page ${page.id} already processed, skipping.`)
        }
      }

      // Collect processed page data for PDF generation
      const processedPageDataForPdf: ProcessedPageData[] = options.pageManager.pages.value
        .filter((p) => p.processedImageDataURL && p.processedWidth && p.processedHeight)
        .map((p) => ({
          imageDataURL: p.processedImageDataURL!,
          width: p.processedWidth!,
          height: p.processedHeight!
        }))

      console.log(`[usePdfGeneration] ${processedPageDataForPdf.length} pages ready for PDF generation`)

      if (processedPageDataForPdf.length > 0) {
        try {
          console.log('[usePdfGeneration] Generating PDF...')
          const pdfBlob = await generatePdfFromProcessedPages(processedPageDataForPdf)
          
          if (pdfBlob) {
            console.log('[usePdfGeneration] PDF generated successfully, size:', pdfBlob.size, 'bytes')
            options.onPdfCreated(pdfBlob)
            
            if (options.closeAfterPdfCreated) {
              console.log('[usePdfGeneration] Closing scanner after PDF creation')
              options.onCloseScanner()
            }
          } else {
            console.error('[usePdfGeneration] PDF generation returned null')
            alert("Failed to generate PDF blob. No content returned from generator.")
          }
        } catch (error) {
          console.error('[usePdfGeneration] Error generating PDF:', error)
          alert("Failed to generate PDF. Please try again.")
        }
      } else {
        console.warn('[usePdfGeneration] No pages could be successfully processed')
        alert("No pages could be successfully processed to create a PDF.")
      }
    } catch (error) {
      console.error('[usePdfGeneration] Error in PDF creation workflow:', error)
      alert("Failed to create PDF. Please try again.")
    } finally {
      console.log('[usePdfGeneration] PDF creation process completed')
      options.imageOperations.isLoading.value = false
      isProcessingPdf.value = false
    }
  }

  return {
    // State
    isProcessingPdf,
    
    // Methods
    createPdfFromAllPages
  }
} 