import { ref, type ComputedRef, type DeepReadonly } from 'vue'
import type { Page } from '@/types'

export interface DocumentProcessingOptions {
  pageManager: {
    pages: ComputedRef<DeepReadonly<Page[]>>
    addFileAsPageWithProgress: (file: File, progressCallback: (status: string, progress: number) => void) => Promise<string>
    selectPage: (pageId: string | null) => void
  }
}

export function useDocumentProcessing(options: DocumentProcessingOptions) {
  // Processing state
  const isLoading = ref(false)
  const processingStatus = ref<string>('')
  const processingProgress = ref<number>(0)

  const handleFilesSelected = async (newFiles: File[]) => {
    console.log('[useDocumentProcessing] handleFilesSelected with files:', newFiles.length)
    if (newFiles.length === 0) return
    
    console.log('[useDocumentProcessing] Proceeding with file processing...')
    console.log('[useDocumentProcessing] Setting loading state...')
    isLoading.value = true
    processingStatus.value = 'Processing images...'
    processingProgress.value = 0

    try {
      console.log('[useDocumentProcessing] Getting current page count...')
      // Get current page count before adding new files
      const currentPageCount = options.pageManager.pages.value.length
      console.log('[useDocumentProcessing] Current page count:', currentPageCount)

      // Phase 1: Quick image preview (optimistic UI)
      console.log('[useDocumentProcessing] Phase 1: Setting initial status...')
      processingStatus.value = 'Loading images...'
      processingProgress.value = 20
      
      // Add files with progressive feedback
      const totalFiles = newFiles.length
      console.log('[useDocumentProcessing] Starting to process', totalFiles, 'files...')
      
      for (let i = 0; i < totalFiles; i++) {
        const file = newFiles[i]
        console.log(`[useDocumentProcessing] Processing file ${i + 1}/${totalFiles}:`, file.name, 'size:', file.size, 'type:', file.type)
        processingStatus.value = `Processing image ${i + 1} of ${totalFiles}...`
        processingProgress.value = 20 + (i / totalFiles) * 60 // 20-80% for processing
        
        try {
          console.log(`[useDocumentProcessing] Calling addFileAsPageWithProgress for file ${i + 1}...`)
          // Add individual file with progress tracking
          await options.pageManager.addFileAsPageWithProgress(file, (status: string, progress: number) => {
            console.log(`[useDocumentProcessing] Progress callback - Status: ${status}, Progress: ${progress}`)
            processingStatus.value = status
            processingProgress.value = 20 + (i / totalFiles) * 60 + (progress / totalFiles) * 60
          })
          console.log(`[useDocumentProcessing] Successfully processed file ${i + 1}:`, file.name)
        } catch (fileError) {
          console.error(`[useDocumentProcessing] Error processing file ${i + 1} (${file.name}):`, fileError)
          throw fileError // Re-throw to be caught by outer try-catch
        }
      }

      console.log('[useDocumentProcessing] All files processed, finalizing...')
      // Phase 3: Finalization
      processingStatus.value = 'Finalizing...'
      processingProgress.value = 90

      // Select the first newly added page
      const newPages = options.pageManager.pages.value
      console.log('[useDocumentProcessing] New pages count:', newPages.length, 'vs previous:', currentPageCount)
      if (newPages.length > currentPageCount) {
        const firstNewPageId = newPages[currentPageCount].id
        console.log('[useDocumentProcessing] Selecting newly added page:', firstNewPageId)
        options.pageManager.selectPage(firstNewPageId)
      }

      processingProgress.value = 100
      processingStatus.value = 'Complete!'
      console.log('[useDocumentProcessing] Processing complete!')
      
      // Clear status after a brief delay
      setTimeout(() => {
        console.log('[useDocumentProcessing] Clearing processing status...')
        processingStatus.value = ''
        processingProgress.value = 0
      }, 500)

    } catch (error) {
      console.error('[useDocumentProcessing] Error processing files:', error)
      console.error('[useDocumentProcessing] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      processingStatus.value = 'Error processing images'
      setTimeout(() => {
        processingStatus.value = ''
        processingProgress.value = 0
      }, 2000)
    } finally {
      console.log('[useDocumentProcessing] Setting loading to false...')
      isLoading.value = false
    }
  }

  return {
    // State
    isLoading,
    processingStatus,
    processingProgress,
    
    // Methods
    handleFilesSelected
  }
} 