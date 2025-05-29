// src/utils/imageProcessing.ts
import { Point, Corners } from '../types'; // Import defined Point and Corners type

/**
 * Sorts corners to ensure consistent order: top-left, top-right, bottom-right, bottom-left
 * This prevents unexpected rotations/flips when user adjusts corners manually
 * @param {Point[]} corners - Array of 4 corner points in any order
 * @returns {Point[]} - Sorted corners in consistent order
 */
export function sortCornersForConsistentOrientation(corners: Point[]): Point[] {
    if (!corners || corners.length !== 4) {
        console.warn("sortCornersForConsistentOrientation: Invalid corners provided.");
        return corners;
    }

    // Create a copy to avoid mutating the original
    const sortedCorners = [...corners];

    // Find top-left corner (smallest x + y sum)
    const topLeft = sortedCorners.reduce((min, corner) => 
        (corner.x + corner.y) < (min.x + min.y) ? corner : min
    );

    // Find bottom-right corner (largest x + y sum)
    const bottomRight = sortedCorners.reduce((max, corner) => 
        (corner.x + corner.y) > (max.x + max.y) ? corner : max
    );

    // Of the remaining two corners, determine top-right and bottom-left
    const remaining = sortedCorners.filter(corner => 
        corner !== topLeft && corner !== bottomRight
    );

    // Top-right has smaller y coordinate than bottom-left
    // (or if y is similar, larger x coordinate)
    const topRight = remaining[0].y < remaining[1].y ? remaining[0] : 
                     remaining[0].y > remaining[1].y ? remaining[1] :
                     remaining[0].x > remaining[1].x ? remaining[0] : remaining[1];
    
    const bottomLeft = remaining.find(corner => corner !== topRight)!;

    const result = [topLeft, topRight, bottomRight, bottomLeft];
    
    console.log('[IP] Sorted corners for consistent orientation:', {
        original: corners,
        sorted: result
    });

    return result;
}

/**
 * Transforms corner coordinates to match a rotated image's coordinate system.
 * @param {ReadonlyArray<Point>} corners - Original corner coordinates (should be a readonly array of 4 points)
 * @param {number} rotationAngle - Rotation angle in degrees (90, 180, 270)
 * @param {number} originalWidth - Width of the original image
 * @param {number} originalHeight - Height of the original image
 * @returns {Corners | null} - Transformed corner coordinates for the rotated image as a Corners type, or null if input is invalid.
 */
export function transformCornersForRotation(
    corners: ReadonlyArray<Point>, 
    rotationAngle: number, 
    originalWidth: number, 
    originalHeight: number
): Corners | null {
    if (!corners || corners.length !== 4) {
        console.warn("transformCornersForRotation: Invalid corners provided.");
        return null;
    }

    const normalizedAngle = ((rotationAngle % 360) + 360) % 360;
    
    const rotatedCoords = corners.map(corner => {
        switch (normalizedAngle) {
            case 0:
                return { x: corner.x, y: corner.y };
            case 90:
                return { x: originalHeight - corner.y, y: corner.x };
            case 180:
                return { x: originalWidth - corner.x, y: originalHeight - corner.y };
            case 270:
                return { x: corner.y, y: originalWidth - corner.x };
            default:
                console.warn(`transformCornersForRotation: Unsupported rotation angle ${rotationAngle}`);
                return { x: corner.x, y: corner.y };
        }
    });

    if (rotatedCoords.length === 4) {
        return [rotatedCoords[0], rotatedCoords[1], rotatedCoords[2], rotatedCoords[3]] as const;
    }
    console.error("transformCornersForRotation: Failed to produce 4 rotated coordinates.");
    return null;
}

/**
 * Transforms display corner coordinates (relative to a rotated image) back to base coordinates (relative to 0-degree image).
 * This is the inverse of transformCornersForRotation.
 * @param {ReadonlyArray<Point>} displayCorners - Corner coordinates relative to the currently rotated image view.
 * @param {number} currentRotation - The rotation angle of the current view (0, 90, 180, 270 degrees).
 * @param {number} originalWidth - Width of the original (0-degree) image.
 * @param {number} originalHeight - Height of the original (0-degree) image.
 * @returns {Corners | null} - Transformed base corner coordinates, or null if input is invalid.
 */
export function transformDisplayCornersToBase(
    displayCorners: ReadonlyArray<Point>,
    currentRotation: number,
    originalWidth: number,
    originalHeight: number
): Corners | null {
    if (!displayCorners || displayCorners.length !== 4) {
        console.warn("transformDisplayCornersToBase: Invalid displayCorners provided.");
        return null;
    }

    const normalizedAngle = ((currentRotation % 360) + 360) % 360;
    let newWidthForInverse: number, newHeightForInverse: number;

    // Determine the dimensions of the *rotated* image, which are used as the frame of reference for displayCorners.
    if (normalizedAngle === 90 || normalizedAngle === 270) {
        newWidthForInverse = originalHeight; // Width of rotated image is original height
        newHeightForInverse = originalWidth;  // Height of rotated image is original width
    } else {
        newWidthForInverse = originalWidth;
        newHeightForInverse = originalHeight;
    }

    const baseCoords = displayCorners.map(corner => {
        switch (normalizedAngle) {
            case 0:
                // No rotation, display corners are already base corners
                return { x: corner.x, y: corner.y };
            case 90: // Display corners are on an image rotated 90 deg CW. Original was (w,h), rotated is (h,w).
                     // Display (x,y) -> Original (y, h_original - x)
                return { x: corner.y, y: newWidthForInverse - corner.x }; // newWidthForInverse is originalHeight
            case 180: // Display corners are on an image rotated 180 deg. Original (w,h), rotated is (w,h).
                      // Display (x,y) -> Original (w_original - x, h_original - y)
                return { x: newWidthForInverse - corner.x, y: newHeightForInverse - corner.y };
            case 270: // Display corners are on an image rotated 270 deg CW. Original was (w,h), rotated is (h,w).
                      // Display (x,y) -> Original (w_rotated_view - y, x) = (h_original - y, x)
                return { x: newHeightForInverse - corner.y, y: corner.x }; // newHeightForInverse is originalWidth
            default:
                console.warn(`transformDisplayCornersToBase: Unsupported rotation angle ${currentRotation}`);
                return { x: corner.x, y: corner.y }; // Should not happen with normalizedAngle
        }
    });

    if (baseCoords.length === 4) {
        return [baseCoords[0], baseCoords[1], baseCoords[2], baseCoords[3]] as const;
    }
    console.error("transformDisplayCornersToBase: Failed to produce 4 base coordinates.");
    return null;
}

/**
 * Calculates the area of a quadrilateral defined by four points using the Shoelace formula.
 * Assumes points are ordered (e.g., TL, TR, BR, BL).
 * @param {ReadonlyArray<Point>} points - Array of 4 corner points.
 * @returns {number} - The area of the quadrilateral.
 */
export function calculateAreaFromPoints(points: ReadonlyArray<Point>): number {
    if (!points || points.length !== 4) {
        return 0;
    }
    const p = points; // Shorthand
    const area = 0.5 * Math.abs(
        p[0].x * p[1].y + p[1].x * p[2].y + p[2].x * p[3].y + p[3].x * p[0].y -
        (p[1].x * p[0].y + p[2].x * p[1].y + p[3].x * p[2].y + p[0].x * p[3].y)
    );
    return area;
}

/**
 * Generates default square corners for an image with a specific pixel inset.
 * @param {number} imageWidth - The width of the image.
 * @param {number} imageHeight - The height of the image.
 * @param {number} insetPixels - The inset in pixels from each edge.
 * @returns {Corners} - An array of 4 Point objects representing the corners (TL, TR, BR, BL).
 */
export function generateDefaultCornersPx(
    imageWidth: number,
    imageHeight: number,
    insetPixels: number
): Corners {
    return [
        { x: insetPixels, y: insetPixels },
        { x: imageWidth - insetPixels, y: insetPixels },
        { x: imageWidth - insetPixels, y: imageHeight - insetPixels },
        { x: insetPixels, y: imageHeight - insetPixels },
    ] as const;
}
