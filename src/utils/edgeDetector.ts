/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point, Stroke } from '../types';

/**
 * Perform Sobel Edge Detection on an HTMLCanvasElement or HTMLVideoElement
 * and return connected vector strokes.
 */
export function extractContoursFromSource(
  source: HTMLVideoElement | HTMLCanvasElement,
  threshold: number = 40,
  maxPoints: number = 150
): Stroke[] {
  // Create offscreen canvas for processing
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Downsample for performance and smoother outlines
  const width = 160;
  const height = 120;
  canvas.width = width;
  canvas.height = height;

  // Draw source
  ctx.drawImage(source, 0, 0, width, height);

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // 1. Grayscale
    const gray = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // 2. Sobel Filtering
    const edges = new Float32Array(width * height);
    const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let cy = -1; cy <= 1; cy++) {
          for (let cx = -1; cx <= 1; cx++) {
            const pixelVal = gray[(y + cy) * width + (x + cx)];
            const kIdx = (cy + 1) * 3 + (cx + 1);
            gx += pixelVal * kx[kIdx];
            gy += pixelVal * ky[kIdx];
          }
        }

        const mag = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = mag;
      }
    }

    // 3. Find high-intensity edge pixels
    const edgePoints: { x: number; y: number; visited: boolean }[] = [];
    for (let y = 2; y < height - 2; y += 2) {
      for (let x = 2; x < width - 2; x += 2) {
        if (edges[y * width + x] > threshold) {
          // Normalize coordinates to 0 - 100
          edgePoints.push({
            x: (x / width) * 100,
            y: (y / height) * 100,
            visited: false,
          });
        }
      }
    }

    // 4. Trace outlines using nearest neighbor clustering
    const strokes: Stroke[] = [];
    const searchRadius = 12; // In normalized percentage units
    let totalPointsAdded = 0;

    for (let i = 0; i < edgePoints.length; i++) {
      if (edgePoints[i].visited || totalPointsAdded >= maxPoints) continue;

      const currentStrokePoints: Point[] = [];
      let current = edgePoints[i];
      current.visited = true;
      currentStrokePoints.push({ x: current.x, y: current.y });
      totalPointsAdded++;

      let tracing = true;
      while (tracing && totalPointsAdded < maxPoints) {
        let nearest: typeof current | null = null;
        let minDist = searchRadius;

        for (let j = 0; j < edgePoints.length; j++) {
          if (edgePoints[j].visited) continue;

          const dx = edgePoints[j].x - current.x;
          const dy = edgePoints[j].y - current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDist) {
            minDist = dist;
            nearest = edgePoints[j];
          }
        }

        if (nearest) {
          nearest.visited = true;
          currentStrokePoints.push({ x: nearest.x, y: nearest.y });
          current = nearest;
          totalPointsAdded++;
        } else {
          tracing = false;
        }
      }

      // Add stroke if it has enough points to look like a line
      if (currentStrokePoints.length >= 3) {
        // Smooth stroke points slightly (rolling average)
        const smoothedPoints: Point[] = [];
        for (let k = 0; k < currentStrokePoints.length; k++) {
          if (k === 0 || k === currentStrokePoints.length - 1) {
            smoothedPoints.push(currentStrokePoints[k]);
          } else {
            const prev = currentStrokePoints[k - 1];
            const curr = currentStrokePoints[k];
            const next = currentStrokePoints[k + 1];
            smoothedPoints.push({
              x: (prev.x + curr.x + next.x) / 3,
              y: (prev.y + curr.y + next.y) / 3,
            });
          }
        }

        strokes.push({
          id: `sobel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          points: smoothedPoints,
          color: '#00f0ff', // Cyber Teal default
          width: 2.5,
          glowColor: 'rgba(0, 240, 255, 0.6)',
          glowWidth: 10,
          isClosed: false,
          style: 'neon',
        });
      }
    }

    return strokes;
  } catch (error) {
    console.error('Error extracting edge contours:', error);
    return [];
  }
}
