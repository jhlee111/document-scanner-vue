import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateAreaFromPoints, 
  generateDefaultCornersPx, 
  transformCornersForRotation
} from '../../../src/utils/imageProcessing';
import { sampleCorners, createSampleFile } from '../../setup/fixtures';
import type { Corners } from '../../../src/types';

describe('imageProcessing utils', () => {
  describe('calculateAreaFromPoints', () => {
    it('should calculate area for rectangular corners', () => {
      const corners: Corners = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      
      const area = calculateAreaFromPoints(corners);
      expect(area).toBe(10000); // 100 * 100
    });

    it('should calculate area for irregular quadrilateral', () => {
      const area = calculateAreaFromPoints(sampleCorners.rotated);
      expect(area).toBeGreaterThan(0);
      expect(typeof area).toBe('number');
    });

    it('should return 0 for degenerate corners', () => {
      const area = calculateAreaFromPoints(sampleCorners.invalid);
      expect(area).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const corners: Corners = [
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 50, y: 50 },
        { x: -50, y: 50 },
      ];
      
      const area = calculateAreaFromPoints(corners);
      expect(area).toBe(10000); // 100 * 100
    });
  });

  describe('generateDefaultCornersPx', () => {
    it('should generate corners with default margin', () => {
      const corners = generateDefaultCornersPx(200, 150, 20);
      
      expect(corners).toHaveLength(4);
      expect(corners[0]).toEqual({ x: 20, y: 20 }); // topLeft
      expect(corners[1]).toEqual({ x: 180, y: 20 }); // topRight
      expect(corners[2]).toEqual({ x: 180, y: 130 }); // bottomRight
      expect(corners[3]).toEqual({ x: 20, y: 130 }); // bottomLeft
    });

    it('should generate corners with custom margin', () => {
      const corners = generateDefaultCornersPx(200, 150, 50);
      
      expect(corners[0]).toEqual({ x: 50, y: 50 }); // topLeft
      expect(corners[1]).toEqual({ x: 150, y: 50 }); // topRight
      expect(corners[2]).toEqual({ x: 150, y: 100 }); // bottomRight
      expect(corners[3]).toEqual({ x: 50, y: 100 }); // bottomLeft
    });

    it('should handle small images', () => {
      const corners = generateDefaultCornersPx(50, 50, 10);
      
      expect(corners[0]).toEqual({ x: 10, y: 10 });
      expect(corners[1]).toEqual({ x: 40, y: 10 });
      expect(corners[2]).toEqual({ x: 40, y: 40 });
      expect(corners[3]).toEqual({ x: 10, y: 40 });
    });

    it('should clamp margin to image bounds', () => {
      const corners = generateDefaultCornersPx(100, 100, 60); // Margin > half size
      
      // Should still generate valid corners within bounds
      expect(corners[0].x).toBeGreaterThanOrEqual(0);
      expect(corners[0].y).toBeGreaterThanOrEqual(0);
      expect(corners[2].x).toBeLessThanOrEqual(100);
      expect(corners[2].y).toBeLessThanOrEqual(100);
    });
  });

  describe('transformCornersForRotation', () => {
    const originalCorners: Corners = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];

    it('should not transform corners for 0 degree rotation', () => {
      const transformed = transformCornersForRotation(originalCorners, 0, 100, 100);
      expect(transformed).toEqual(originalCorners);
    });

    it('should transform corners for 90 degree rotation', () => {
      const transformed = transformCornersForRotation(originalCorners, 90, 100, 100);
      
      // After 90° rotation, coordinates should be transformed
      expect(transformed).not.toBeNull();
      if (transformed) {
        expect(transformed).toHaveLength(4);
        expect(transformed[0].x).toBeGreaterThanOrEqual(0);
        expect(transformed[0].y).toBeGreaterThanOrEqual(0);
      }
    });

    it('should transform corners for 180 degree rotation', () => {
      const transformed = transformCornersForRotation(originalCorners, 180, 100, 100);
      
      expect(transformed).not.toBeNull();
      if (transformed) {
        expect(transformed).toHaveLength(4);
        // 180° rotation should flip coordinates
        expect(transformed[0].x).toBeLessThanOrEqual(100);
        expect(transformed[0].y).toBeLessThanOrEqual(100);
      }
    });

    it('should transform corners for 270 degree rotation', () => {
      const transformed = transformCornersForRotation(originalCorners, 270, 100, 100);
      
      expect(transformed).not.toBeNull();
      if (transformed) {
        expect(transformed).toHaveLength(4);
        expect(transformed[0].x).toBeGreaterThanOrEqual(0);
        expect(transformed[0].y).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle different image dimensions', () => {
      const transformed = transformCornersForRotation(originalCorners, 90, 200, 150);
      
      expect(transformed).not.toBeNull();
      if (transformed) {
        expect(transformed).toHaveLength(4);
        // Verify coordinates are within new bounds
        transformed.forEach(corner => {
          expect(corner.x).toBeGreaterThanOrEqual(0);
          expect(corner.y).toBeGreaterThanOrEqual(0);
          expect(corner.x).toBeLessThanOrEqual(150); // Height becomes width after 90° rotation
          expect(corner.y).toBeLessThanOrEqual(200); // Width becomes height after 90° rotation
        });
      }
    });
  });
}); 