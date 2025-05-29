<template>
  <div class="page-size-selector-compact">
    <label for="page-format-select" class="format-label">Page Size:</label>
    <select 
      id="page-format-select"
      v-model="selectedFormat" 
      @change="handleFormatChange"
      class="format-select-compact"
    >
      <option 
        v-for="format in availableFormats" 
        :key="format.name"
        :value="format"
      >
        {{ format.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { PaperFormat } from '../types';

interface Props {
  availableFormats: PaperFormat[];
  currentFormat?: PaperFormat | null;
}

interface Emits {
  (e: 'apply', format: PaperFormat): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedFormat = ref<PaperFormat | null>(props.currentFormat || props.availableFormats[0]);

// Update selected format when current format changes
watch(() => props.currentFormat, (newFormat) => {
  if (newFormat) {
    selectedFormat.value = newFormat;
  }
}, { immediate: true });

// Emit initial format if no current format is set
watch(() => props.availableFormats, (formats) => {
  if (formats.length > 0 && !props.currentFormat) {
    const defaultFormat = formats[0];
    selectedFormat.value = defaultFormat;
    // Emit the default format immediately
    emit('apply', defaultFormat);
  }
}, { immediate: true });

function handleFormatChange() {
  if (selectedFormat.value) {
    emit('apply', selectedFormat.value);
  }
}
</script>

<style scoped>
.page-size-selector-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.format-label {
  color: white;
  font-weight: 500;
  margin: 0;
  white-space: nowrap;
}

.format-select-compact {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  min-width: 140px;
  backdrop-filter: blur(10px);
}

.format-select-compact:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.15);
}

.format-select-compact option {
  background: #2d3748;
  color: white;
}
</style> 