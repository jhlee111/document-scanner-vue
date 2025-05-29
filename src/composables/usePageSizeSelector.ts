import { ref, computed } from 'vue';
import { PaperFormat } from '../types';

// Standard paper formats
const STANDARD_FORMATS: PaperFormat[] = [
  {
    name: 'Letter Portrait',
    ratio: 8.5 / 11, // ~0.7727
    dimensions: '8.5" × 11"',
    category: 'standard'
  },
  {
    name: 'Letter Landscape', 
    ratio: 11 / 8.5, // ~1.2941
    dimensions: '11" × 8.5"',
    category: 'standard'
  },
  {
    name: 'A4 Portrait',
    ratio: 1 / Math.sqrt(2), // ~0.7071
    dimensions: '210 × 297mm',
    category: 'standard'
  },
  {
    name: 'A4 Landscape',
    ratio: Math.sqrt(2), // ~1.4142
    dimensions: '297 × 210mm', 
    category: 'standard'
  },
  {
    name: 'Legal Portrait',
    ratio: 8.5 / 14, // ~0.6071
    dimensions: '8.5" × 14"',
    category: 'standard'
  },
  {
    name: 'Legal Landscape',
    ratio: 14 / 8.5, // ~1.6471
    dimensions: '14" × 8.5"',
    category: 'standard'
  },
  {
    name: 'Square',
    ratio: 1.0,
    dimensions: '1:1',
    category: 'standard'
  }
];

export function usePageSizeSelector() {
  // State
  const isVisible = ref(false);
  
  // Computed
  const shouldShow = computed(() => isVisible.value);
  
  // Methods
  const setVisible = (visible: boolean) => {
    isVisible.value = visible;
  };
  
  const hide = () => {
    setVisible(false);
  };
  
  const show = () => {
    setVisible(true);
  };
  
  // Get format for a specific page
  const getPageFormat = (page: any): PaperFormat => {
    return page?.outputFormat || STANDARD_FORMATS[0]; // Default to Letter Portrait
  };
  
  // Set format for a specific page (this will be handled by the page manager)
  const setPageFormat = (pageId: string, format: PaperFormat, updatePageData: (id: string, data: any) => void) => {
    updatePageData(pageId, { outputFormat: format });
  };
  
  return {
    // State (readonly)
    isVisible: computed(() => isVisible.value),
    shouldShow,
    availableFormats: computed(() => STANDARD_FORMATS),
    
    // Methods
    setVisible,
    hide,
    show,
    getPageFormat,
    setPageFormat,
  };
} 