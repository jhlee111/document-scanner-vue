import { onKeyStroke } from '@vueuse/core'
import type { Ref, ComputedRef } from 'vue'

export interface KeyboardNavigationOptions {
  showFullscreenScanner: Ref<boolean>
  isProcessingPdf: Ref<boolean>
  currentDisplayPage: Ref<any>
  pageManager: {
    currentPage: Ref<any>
    pages: ComputedRef<readonly any[]>
    selectPage: (pageId: string) => void
  }
  onCloseScanner: () => void
  onDiscardProcessedImage: () => void
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    showFullscreenScanner,
    isProcessingPdf,
    currentDisplayPage,
    pageManager,
    onCloseScanner,
    onDiscardProcessedImage
  } = options

  // Handle Escape key
  onKeyStroke('Escape', (event) => {
    event.preventDefault()
    
    if (isProcessingPdf.value) {
      if (currentDisplayPage.value?.mode === 'preview') {
        onDiscardProcessedImage()
      } else {
        onCloseScanner()
      }
    } else if (showFullscreenScanner.value) {
      onCloseScanner()
    }
  })

  // Handle Arrow Left (previous page)
  onKeyStroke('ArrowLeft', (event) => {
    if (!isProcessingPdf.value) return
    
    event.preventDefault()
    
    if (pageManager.currentPage.value && pageManager.pages.value.length > 1) {
      const currentIndex = pageManager.pages.value.findIndex(
        p => p.id === pageManager.currentPage.value!.id
      )
      if (currentIndex > 0) {
        pageManager.selectPage(pageManager.pages.value[currentIndex - 1].id)
      }
    }
  })

  // Handle Arrow Right (next page)
  onKeyStroke('ArrowRight', (event) => {
    if (!isProcessingPdf.value) return
    
    event.preventDefault()
    
    if (pageManager.currentPage.value && pageManager.pages.value.length > 1) {
      const currentIndex = pageManager.pages.value.findIndex(
        p => p.id === pageManager.currentPage.value!.id
      )
      if (currentIndex < pageManager.pages.value.length - 1) {
        pageManager.selectPage(pageManager.pages.value[currentIndex + 1].id)
      }
    }
  })

  return {
    // No return values needed - the composable sets up the keyboard listeners
  }
} 