import { beforeEach, vi } from 'vitest';
import { setupGlobalMocks } from './setup/mocks';
import '@testing-library/jest-dom'

// Setup global mocks before each test
beforeEach(() => {
  setupGlobalMocks();
  
  // Reset all mocks
  vi.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
  
  // Reset console methods
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Global test utilities
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Extend Vitest's expect with jest-dom matchers
import { expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers) 