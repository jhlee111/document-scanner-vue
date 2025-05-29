<template>
    <div class="icon-wrapper">
        <Camera class="icon-base" :size="baseSize" :color="props.color" />
        <Plus class="icon-overlay" :size="overlaySize" :color="props.color" />
    </div>
</template>
<script setup lang="ts">
import { Camera, Plus } from 'lucide-vue-next';
import { computed } from 'vue';

interface Props {
    size: number;
    color: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: 24,
    color: 'black'
});

const baseSize = computed(() => props.size * 0.8);
const overlaySize = computed(() => props.size * 0.4);

// Computed properties for CSS binding
const wrapperSize = computed(() => `${props.size}px`);
</script>
<style scoped>
.icon-wrapper {
  position: relative;
  width: v-bind(wrapperSize);
  height: v-bind(wrapperSize);
}

.icon-base {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.icon-overlay {
  position: absolute;
  top: 0;
  right: 0;
}</style>