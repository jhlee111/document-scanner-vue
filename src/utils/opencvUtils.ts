import { Point } from '../types';

// Declare the global cv variable from OpenCV.js
declare const cv: any;

// Helper to load an image element to an OpenCV Mat
export function loadImageToCvMat(imgElement: HTMLImageElement): any {
    if (!cv || !cv.imread) {
        console.error('OpenCV (cv.imread) is not available.');
        throw new Error('OpenCV (cv.imread) is not available.');
    }
    return cv.imread(imgElement);
}

// Helper to convert an OpenCV Mat to a data URL
export function matToImageDataURL(mat: any): string {
    if (!cv || !cv.imshow) {
        console.error('OpenCV (cv.imshow) is not available.');
        throw new Error('OpenCV (cv.imshow) is not available.');
    }
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    return canvas.toDataURL('image/jpeg'); // Or image/png
}

// Calculate document-specific score for contour ranking
function calculateDocumentScore(contour: any, area: number, aspectRatio: number, imageArea: number, isConvex: boolean): number {
    let score = 0;
    
    // Base score from area (larger is better for documents)
    const areaRatio = area / imageArea;
    score += areaRatio * 1000000; // Scale up for easier comparison
    
    // Bonus for document-like aspect ratios (closer to typical paper ratios)
    const idealAspectRatios = [0.707, 1.0, 1.414]; // A4 (√2), square, A4 rotated
    let aspectBonus = 0;
    for (const ideal of idealAspectRatios) {
        const diff = Math.abs(aspectRatio - ideal);
        if (diff < 0.3) { // Close to ideal ratio
            aspectBonus = Math.max(aspectBonus, (0.3 - diff) * 100000);
        }
    }
    score += aspectBonus;
    
    // Bonus for convex shapes (documents are typically convex)
    if (isConvex) {
        score += 50000;
    }
    
    // Bonus for larger contours (documents should be significant portion of image)
    if (areaRatio > 0.1) { // More than 10% of image
        score += 100000;
    }
    if (areaRatio > 0.2) { // More than 20% of image
        score += 200000;
    }
    
    // More lenient penalty for very thin or very wide shapes (mobile-friendly)
    if (aspectRatio < 0.05 || aspectRatio > 20.0) {
        score -= 150000;
    }
    
    // Mobile-friendly size bonus with much lower thresholds
    const rect = cv.boundingRect(contour);
    const minDimension = Math.min(rect.width, rect.height);
    const maxDimension = Math.max(rect.width, rect.height);
    
    // Much lower minimum size requirements for mobile
    if (minDimension > 10 && maxDimension > 20) { // Very low threshold for mobile
        score += 25000;
    }
    if (minDimension > 50 && maxDimension > 100) { // Medium size bonus
        score += 50000;
    }
    if (minDimension > 100 && maxDimension > 200) { // Original desktop threshold
        score += 75000;
    }
    
    // Additional bonus for any reasonable-sized contour on mobile
    if (area > 10) { // Even tiny contours get some bonus
        score += 10000;
    }
    
    return score;
}

// Actual edge detection logic
export async function detectDocumentCorners(
    imageDataURL: string
): Promise<Point[] | null> {
    if (!cv || !cv.Mat || !cv.cvtColor || !cv.GaussianBlur || !cv.Canny || !cv.findContours || !cv.arcLength || !cv.approxPolyDP || !cv.contourArea) {
        console.error("A required OpenCV function is not available in detectDocumentCorners.");
        return null;
    }
    let srcMat: any = null;
    let downsampledMat: any = null;
    let grayMat: any = null;
    let blurredMat: any = null;
    let bestContourMat: any = null;

    try {
        const img = new Image();
        img.src = imageDataURL;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (_e) => reject(new Error("Image load failed in detectDocumentCorners"));
        });

        srcMat = cv.imread(img);
        const originalWidth = srcMat.cols;
        const originalHeight = srcMat.rows;
        const totalImageArea = originalWidth * originalHeight;
        
        console.log(`[DEBUG] Original image dimensions: ${originalWidth}x${originalHeight}, Total area: ${totalImageArea}`);

        // Intelligent downsampling for large images
        let processingMat = srcMat;
        let downsampleFactor = 1.0;
        const targetMaxDimension = 1200; // Target max dimension for processing
        const maxDimension = Math.max(originalWidth, originalHeight);
        
        if (maxDimension > targetMaxDimension) {
            downsampleFactor = targetMaxDimension / maxDimension;
            const newWidth = Math.round(originalWidth * downsampleFactor);
            const newHeight = Math.round(originalHeight * downsampleFactor);
            
            downsampledMat = new cv.Mat();
            const newSize = new cv.Size(newWidth, newHeight);
            cv.resize(srcMat, downsampledMat, newSize, 0, 0, cv.INTER_AREA); // INTER_AREA is best for downsampling
            processingMat = downsampledMat;
            
            console.log(`[DEBUG] Downsampled to: ${newWidth}x${newHeight} (factor: ${downsampleFactor.toFixed(3)}) for processing`);
        } else {
            console.log(`[DEBUG] No downsampling needed, processing at original size`);
        }

        grayMat = new cv.Mat();
        cv.cvtColor(processingMat, grayMat, cv.COLOR_RGBA2GRAY, 0);

        blurredMat = new cv.Mat();
        cv.GaussianBlur(grayMat, blurredMat, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

        const processingImageArea = processingMat.cols * processingMat.rows;
        console.log(`[DEBUG] Processing dimensions: ${processingMat.cols}x${processingMat.rows}, Processing area: ${processingImageArea}`);

        // Calculate adaptive thresholds based on original image resolution (not downsampled)
        const isHighResolution = totalImageArea > 8000000; // 8MP+ (e.g., 3000x2667 or higher)
        const isMediumResolution = totalImageArea > 2000000; // 2MP+ (e.g., 1600x1200 or higher)
        
        console.log(`[DEBUG] Image classification: ${isHighResolution ? 'High-res (likely mobile camera)' : isMediumResolution ? 'Medium-res' : 'Low-res (likely compressed)'}`);

        // Adaptive area thresholds based on original resolution but applied to processing area
        const getAdaptiveAreaThreshold = (baseThreshold: number): number => {
            if (isHighResolution) {
                // For high-res images (mobile camera), use much lower thresholds
                return baseThreshold * 0.1; // 10x more lenient
            } else if (isMediumResolution) {
                // For medium-res images, use moderately lower thresholds
                return baseThreshold * 0.5; // 2x more lenient
            } else {
                // For low-res images (desktop/compressed), use original thresholds
                return baseThreshold;
            }
        };

        // Adaptive Canny parameters based on original resolution
        const getAdaptiveCannyParams = (baseLow: number, baseHigh: number): { low: number; high: number } => {
            if (isHighResolution) {
                // For high-res images, use lower Canny thresholds to detect more edges
                return { 
                    low: Math.max(1, Math.round(baseLow * 0.6)), // 40% lower
                    high: Math.max(5, Math.round(baseHigh * 0.7)) // 30% lower
                };
            } else if (isMediumResolution) {
                // For medium-res images, slightly lower thresholds
                return { 
                    low: Math.max(1, Math.round(baseLow * 0.8)), // 20% lower
                    high: Math.max(5, Math.round(baseHigh * 0.9)) // 10% lower
                };
            } else {
                // For low-res images, use original thresholds
                return { low: baseLow, high: baseHigh };
            }
        };

        // Try multiple detection strategies with progressive relaxation
        const strategies = [
            {
                name: "Standard",
                cannyLow: getAdaptiveCannyParams(50, 150).low,
                cannyHigh: getAdaptiveCannyParams(50, 150).high,
                areaThreshold: getAdaptiveAreaThreshold(0.05), // 5% -> adaptive
                minAspectRatio: 0.5,
                maxAspectRatio: 2.0,
                approxEpsilon: 0.015
            },
            {
                name: "Relaxed",
                cannyLow: getAdaptiveCannyParams(30, 100).low,
                cannyHigh: getAdaptiveCannyParams(30, 100).high,
                areaThreshold: getAdaptiveAreaThreshold(0.03), // 3% -> adaptive
                minAspectRatio: 0.3,
                maxAspectRatio: 3.0,
                approxEpsilon: 0.02
            },
            {
                name: "VeryRelaxed",
                cannyLow: getAdaptiveCannyParams(75, 200).low,
                cannyHigh: getAdaptiveCannyParams(75, 200).high,
                areaThreshold: getAdaptiveAreaThreshold(0.01), // 1% -> adaptive
                minAspectRatio: 0.2,
                maxAspectRatio: 4.0,
                approxEpsilon: 0.025
            },
            {
                name: "Aggressive",
                cannyLow: getAdaptiveCannyParams(20, 80).low,
                cannyHigh: getAdaptiveCannyParams(20, 80).high,
                areaThreshold: getAdaptiveAreaThreshold(0.005), // 0.5% -> adaptive
                minAspectRatio: 0.1,
                maxAspectRatio: 5.0,
                approxEpsilon: 0.03
            },
            {
                name: "DocumentFocused",
                cannyLow: getAdaptiveCannyParams(40, 120).low,
                cannyHigh: getAdaptiveCannyParams(40, 120).high,
                areaThreshold: getAdaptiveAreaThreshold(0.15), // 15% -> adaptive
                minAspectRatio: 0.4,
                maxAspectRatio: 2.5,
                approxEpsilon: 0.02,
                useDocumentHeuristics: true, // Enable document-specific scoring
                usePreprocessing: true
            },
            {
                name: "Enhanced",
                cannyLow: getAdaptiveCannyParams(25, 75).low,
                cannyHigh: getAdaptiveCannyParams(25, 75).high,
                areaThreshold: getAdaptiveAreaThreshold(0.08), // 8% -> adaptive
                minAspectRatio: 0.3,
                maxAspectRatio: 3.0,
                approxEpsilon: 0.025,
                useDocumentHeuristics: true,
                usePreprocessing: true
            }
        ];

        for (const strategy of strategies) {
            const minAreaThreshold = processingImageArea * strategy.areaThreshold;
            console.log(`[DEBUG] Trying ${strategy.name} strategy... (adaptive threshold: ${(strategy.areaThreshold * 100).toFixed(4)}%, min area: ${minAreaThreshold.toFixed(0)} pixels)`);
            
            let edgedMat: any = null;
            let contours: any = null;
            let hierarchy: any = null;

            try {
                edgedMat = new cv.Mat();
                
                // Apply preprocessing for strategies that need it
                let processedMat = blurredMat;
                if (strategy.usePreprocessing) {
                    console.log(`[DEBUG] ${strategy.name}: Applying preprocessing (CLAHE contrast enhancement)`);
                    processedMat = new cv.Mat();
                    
                    // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
                    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
                    clahe.apply(blurredMat, processedMat);
                    clahe.delete();
                }
                
                cv.Canny(processedMat, edgedMat, strategy.cannyLow, strategy.cannyHigh);

                contours = new cv.MatVector();
                hierarchy = new cv.Mat();
                cv.findContours(edgedMat, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

                console.log(`[DEBUG] ${strategy.name}: Found ${contours.size()} initial contours.`);

                if (contours.size() === 0) {
                    // Clean up preprocessing matrix if created
                    if (strategy.usePreprocessing && processedMat !== blurredMat) {
                        processedMat.delete();
                    }
                    continue;
                }

                let candidateCount = 0;
                let rejectionReasons = {
                    notFourSided: 0,
                    notConvex: 0,
                    tooSmall: 0,
                    badAspectRatio: 0,
                    passed: 0
                };
                let bestContourForStrategy: any = null;
                let bestScoreForStrategy = -1;

                for (let i = 0; i < contours.size(); ++i) {
                    const contour = contours.get(i);
                    const peri = cv.arcLength(contour, true);
                    const approx = new cv.Mat();
                    cv.approxPolyDP(contour, approx, strategy.approxEpsilon * peri, true);

                    if (approx.rows !== 4) {
                        rejectionReasons.notFourSided++;
                        approx.delete();
                        continue;
                    }

                    candidateCount++;
                    const isConvex = cv.isContourConvex(approx);
                    const area = cv.contourArea(approx);
                    const rect = cv.boundingRect(approx);
                    const aspectRatio = rect.width / rect.height;
                    
                    // All strategies require convex contours
                    if (!isConvex) {
                        rejectionReasons.notConvex++;
                        if (candidateCount <= 10) {
                            console.log(`[DEBUG] ${strategy.name} Contour ${i} (4-sided): REJECTED - Not convex. Area=${area.toFixed(0)}, AR=${aspectRatio.toFixed(2)}`);
                        }
                        approx.delete();
                        continue;
                    }

                    if (area < minAreaThreshold) {
                        rejectionReasons.tooSmall++;
                        if (candidateCount <= 10) {
                            console.log(`[DEBUG] ${strategy.name} Contour ${i} (4-sided): REJECTED - Too small. Area=${area.toFixed(0)} < ${minAreaThreshold.toFixed(0)}, AR=${aspectRatio.toFixed(2)}`);
                        }
                        approx.delete();
                        continue;
                    }

                    if (aspectRatio < strategy.minAspectRatio || aspectRatio > strategy.maxAspectRatio) {
                        rejectionReasons.badAspectRatio++;
                        if (candidateCount <= 10) {
                            console.log(`[DEBUG] ${strategy.name} Contour ${i} (4-sided): REJECTED - Bad aspect ratio. Area=${area.toFixed(0)}, AR=${aspectRatio.toFixed(2)} (Range: ${strategy.minAspectRatio}-${strategy.maxAspectRatio})`);
                        }
                        approx.delete();
                        continue;
                    }

                    // Calculate document score if heuristics are enabled
                    let documentScore = area; // Default scoring by area
                    if (strategy.useDocumentHeuristics) {
                        documentScore = calculateDocumentScore(approx, area, aspectRatio, processingImageArea, isConvex);
                    }

                    // If all checks passed
                    rejectionReasons.passed++;
                    const convexStatus = isConvex ? "CONVEX" : "NON-CONVEX";
                    const scoreInfo = strategy.useDocumentHeuristics ? `, Score=${documentScore.toFixed(0)}` : "";
                    console.log(`[DEBUG] ${strategy.name} Contour ${i} (4-sided): PASSED ALL FILTERS. Area=${area.toFixed(0)}, AR=${aspectRatio.toFixed(2)}, W=${rect.width}, H=${rect.height}, ${convexStatus}${scoreInfo}`);
                    
                    if (documentScore > bestScoreForStrategy) {
                        console.log(`[DEBUG] ${strategy.name} NEW BEST CONTOUR FOUND (Contour ${i}): Area=${area.toFixed(0)}, AR=${aspectRatio.toFixed(2)}, W=${rect.width}, H=${rect.height}, ${convexStatus}${scoreInfo}`);
                        bestScoreForStrategy = documentScore;
                        if (bestContourForStrategy) bestContourForStrategy.delete();
                        bestContourForStrategy = approx.clone();
                    }
                    approx.delete();
                }

                console.log(`[DEBUG] ${strategy.name} Summary: 4-sided candidates=${candidateCount}, Rejections: notConvex=${rejectionReasons.notConvex}, tooSmall=${rejectionReasons.tooSmall}, badAR=${rejectionReasons.badAspectRatio}, passed=${rejectionReasons.passed}`);
                
                // Clean up preprocessing matrix if created
                if (strategy.usePreprocessing && processedMat !== blurredMat) {
                    processedMat.delete();
                }
                
                // If we found a good contour for this strategy, use it
                if (bestContourForStrategy) {
                    console.log(`[DEBUG] ${strategy.name} strategy SUCCESS! Found suitable contour with score ${bestScoreForStrategy.toFixed(0)}.`);
                    if (bestContourMat) bestContourMat.delete();
                    bestContourMat = bestContourForStrategy;
                    break;
                } else {
                    console.log(`[DEBUG] ${strategy.name} strategy failed, trying next...`);
                }

            } finally {
                // Clean up strategy-specific matrices
                if (edgedMat) edgedMat.delete();
                if (contours) contours.delete();
                if (hierarchy) hierarchy.delete();
            }
        }
        
        if (!bestContourMat) {
            console.log("[DEBUG] All strategies failed - no suitable 4-point contour found.");
            return null;
        }

        // Extract points and scale back to original image size if needed
        const points: Point[] = [];
        for (let i = 0; i < bestContourMat.rows; ++i) {
            const x = bestContourMat.data32S[i * 2];
            const y = bestContourMat.data32S[i * 2 + 1];
            
            // Scale coordinates back to original image size
            const scaledX = downsampleFactor < 1.0 ? Math.round(x / downsampleFactor) : x;
            const scaledY = downsampleFactor < 1.0 ? Math.round(y / downsampleFactor) : y;
            
            points.push({ x: scaledX, y: scaledY });
        }
        
        console.log(`[DEBUG] Scaling coordinates back to original size (factor: ${(1/downsampleFactor).toFixed(3)})`);
        
        points.sort((a, b) => a.y - b.y); 
        const topPoints = points.slice(0, 2).sort((a,b) => a.x - b.x); 
        const bottomPoints = points.slice(2, 4).sort((a,b) => a.x - b.x); 
        
        const finalSortedPoints = [topPoints[0], topPoints[1], bottomPoints[1], bottomPoints[0]]; // tl, tr, br, bl

        return finalSortedPoints;

    } catch (error) {
        console.error("Error in detectDocumentCorners:", error);
        return null;
    } finally {
        // Clean up main matrices
        if (srcMat) srcMat.delete();
        if (downsampledMat) downsampledMat.delete();
        if (grayMat) grayMat.delete();
        if (blurredMat) blurredMat.delete();
        if (bestContourMat) bestContourMat.delete();
    }
}

// Actual perspective transform logic
export async function applyPerspectiveTransform(
    imageDataURL: string,
    corners: Point[],
    options?: { outputWidth?: number; outputHeight?: number } // Optional output dimensions
): Promise<{ imageDataURL: string; processedWidth: number; processedHeight: number } | null> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                console.log("[cvUtils] Image loaded for perspective transform. Input corners:", corners, "Options:", options);
                // The `corners` are now assumed to be pre-sorted by the caller (e.g., useImageProcessing)
                // to ensure a consistent order (TL, TR, BR, BL).
                const [tl, tr, br, bl] = corners; // Directly use the input corners

                // Calculate the width of the new image
                const widthTop = Math.sqrt(((tr.x - tl.x) ** 2) + ((tr.y - tl.y) ** 2));
                const widthBottom = Math.sqrt(((br.x - bl.x) ** 2) + ((br.y - bl.y) ** 2));
                let maxWidth = Math.max(Math.floor(widthTop), Math.floor(widthBottom));

                // Calculate the height of the new image
                const heightLeft = Math.sqrt(((bl.x - tl.x) ** 2) + ((bl.y - tl.y) ** 2));
                const heightRight = Math.sqrt(((br.x - tr.x) ** 2) + ((br.y - tr.y) ** 2));
                let maxHeight = Math.max(Math.floor(heightLeft), Math.floor(heightRight));

                // Use provided output dimensions if available and valid
                let outputWidth = (options?.outputWidth && options.outputWidth > 0) ? options.outputWidth : maxWidth;
                let outputHeight = (options?.outputHeight && options.outputHeight > 0) ? options.outputHeight : maxHeight;

                if (outputWidth <= 0 || outputHeight <= 0) {
                    console.warn("[cvUtils] Calculated or provided output dimensions are invalid, falling back to detected max dimensions.");
                    outputWidth = maxWidth;
                    outputHeight = maxHeight;
                    if (outputWidth <= 0 || outputHeight <= 0) {
                        console.error("[cvUtils] Fallback dimensions also invalid. Cannot process.");
                        reject(new Error("Invalid output dimensions for perspective transform."));
                        return;
                    }
                }

                console.log(`[cvUtils] Effective output dimensions for transform: ${outputWidth}x${outputHeight}`);

                // Create source and destination matrices for warpPerspective
                // Source points are the detected corners
                // opencv.js expects data in a flat array: [x1,y1, x2,y2, ...]
                const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    tl.x, tl.y,
                    tr.x, tr.y,
                    br.x, br.y,
                    bl.x, bl.y,
                ]);

                // Destination points define the corners of the output rectangle
                const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    0, 0,                        // Top-left
                    outputWidth - 1, 0,         // Top-right
                    outputWidth - 1, outputHeight - 1, // Bottom-right
                    0, outputHeight - 1,       // Bottom-left
                ]);

                const M = cv.getPerspectiveTransform(srcTri, dstTri);
                const srcMat = cv.imread(img);
                const dstMat = new cv.Mat();
                const dsize = new cv.Size(outputWidth, outputHeight);

                cv.warpPerspective(srcMat, dstMat, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

                // Convert the processed Mat to a data URL
                const outputCanvas = document.createElement('canvas');
                cv.imshow(outputCanvas, dstMat);
                const processedImageDataURL = outputCanvas.toDataURL('image/jpeg'); // Or 'image/png'

                // Clean up
                srcMat.delete();
                dstMat.delete();
                M.delete();
                srcTri.delete();
                dstTri.delete();

                resolve({ 
                    imageDataURL: processedImageDataURL, 
                    processedWidth: outputWidth, 
                    processedHeight: outputHeight 
                });

            } catch (error) {
                console.error("[cvUtils] Error in applyPerspectiveTransform:", error);
                reject(error);
            }
        };
        img.onerror = (err) => {
            console.error("[cvUtils] Failed to load image for perspective transform:", err);
            reject(new Error("Image failed to load for processing."));
        };
        img.src = imageDataURL;
    });
}

/**
 * Rotates an image dataURL by the specified angle and returns the rotated dataURL.
 * @param {string} imageDataURL - The original image as a data URL.
 * @param {number} rotationAngle - Rotation angle in degrees (0, 90, 180, 270).
 * @returns {Promise<string>} - Promise that resolves to the rotated image data URL.
 */
export async function rotateImageDataURL(imageDataURL: string, rotationAngle: number): Promise<string> {
    if (!cv || !cv.rotate) {
        console.error('OpenCV rotation functions not available');
        return imageDataURL; // Return original if rotation not available
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let src: any = null;
            let dst: any = null;
            
            try {
                // Load image into OpenCV Mat
                src = loadImageToCvMat(img);
                dst = new cv.Mat();
                
                // Normalize rotation angle to 0, 90, 180, 270
                const normalizedAngle = ((rotationAngle % 360) + 360) % 360;
                
                switch (normalizedAngle) {
                    case 0:
                        // No rotation needed
                        src.copyTo(dst);
                        break;
                    case 90:
                        // Rotate 90 degrees clockwise
                        cv.rotate(src, dst, cv.ROTATE_90_CLOCKWISE);
                        break;
                    case 180:
                        // Rotate 180 degrees
                        cv.rotate(src, dst, cv.ROTATE_180);
                        break;
                    case 270:
                        // Rotate 270 degrees clockwise (or 90 counter-clockwise)
                        cv.rotate(src, dst, cv.ROTATE_90_COUNTERCLOCKWISE);
                        break;
                    default:
                        console.warn(`Unsupported rotation angle ${rotationAngle}. Returning original image.`);
                        src.copyTo(dst);
                        break;
                }
                
                // Convert back to dataURL
                const rotatedDataURL = matToImageDataURL(dst);
                
                resolve(rotatedDataURL);
            } catch (error) {
                console.error('Error rotating image:', error);
                reject(error);
            } finally {
                // Clean up
                if (src) src.delete();
                if (dst) dst.delete();
            }
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for rotation'));
        };
        img.src = imageDataURL;
    });
} 