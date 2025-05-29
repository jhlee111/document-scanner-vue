<template>
  <div id="app">
    <div class="container-fluid py-4">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-10 col-xl-8">
          <!-- Header -->
          <div class="text-center mb-4">
            <h1 class="display-4 fw-bold text-primary">
              <Camera class="me-3" style="color: #0d6efd;" :size="48" />
              Document Scanner Vue
            </h1>
            <p class="lead text-muted">
              Component Development Playground
            </p>
            <div class="badge bg-success mb-3">
              <Code class="me-1" style="color: white;" :size="16" />
              Development Mode
            </div>
          </div>
          
          <!-- Component Demo -->
          <div class="card shadow-lg border-0">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0">
                <Play class="me-2" style="color: white;" :size="20" />
                DocumentScanner Component
              </h5>
            </div>
            <div class="card-body p-4">
              <DocumentScanner @pdf-created="handlePdfCreated" />
            </div>
          </div>
          
          <!-- Info -->
          <div class="text-center mt-4">
            <p class="text-muted small">
              <Info class="me-1" style="color: #6c757d;" :size="16" />
              This playground is for developing and testing the DocumentScanner component
            </p>
            <div class="d-flex justify-content-center gap-3 mt-3">
              <span class="badge bg-light text-dark">
                <Smartphone class="me-1" style="color: #212529;" :size="16" />
                Mobile Optimized
              </span>
              <span class="badge bg-light text-dark">
                <Eye class="me-1" style="color: #212529;" :size="16" />
                OpenCV.js
              </span>
              <span class="badge bg-light text-dark">
                <Folder class="me-1" style="color: #212529;" :size="16" />
                PDF Export
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DocumentScanner } from '../src'
import { Camera, Code, Play, Info, Smartphone, Eye, Folder } from 'lucide-vue-next'

function handlePdfCreated(pdfBlob: Blob) {
  console.log("PDF created:", pdfBlob);
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}
</script>

<style scoped>
.card {
  border-radius: 1rem;
}

.text-primary {
  color: #0d6efd !important;
}

.card-header {
  border-radius: 1rem 1rem 0 0 !important;
}

@media (max-width: 768px) {
  .display-4 {
    font-size: 2rem;
  }
  
  .card-body {
    padding: 1.5rem !important;
  }
}
</style> 