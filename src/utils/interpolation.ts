/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Core mathematical engine for AI-assisted path morphing and keyframe interpolation.
 */

import { Point, Stroke, FrameData } from '../types';

const EASE_FUNCTIONS = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  elastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

export type EasingType = keyof typeof EASE_FUNCTIONS;

/**
 * Helper to parse HEX color to RGB channels
 */
function parseHex(hex: string) {
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Linear color interpolation (lerp)
 */
function lerpColor(color1: string, color2: string, t: number): string {
  try {
    const rgb1 = parseHex(color1.startsWith('#') ? color1 : '#00f0ff');
    const rgb2 = parseHex(color2.startsWith('#') ? color2 : '#ff007f');
    const r = Math.round(rgb1.r + t * (rgb2.r - rgb1.r));
    const g = Math.round(rgb1.g + t * (rgb2.g - rgb1.g));
    const b = Math.round(rgb1.b + t * (rgb2.b - rgb1.b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return color1;
  }
}

/**
 * Resamples a continuous set of points using chord-length parameterization 
 * to guarantee that matched vectors have identical vertex counts.
 */
export function resamplePoints(points: Point[], numPoints: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: numPoints }, () => ({ ...points[0] }));
  }
  
  const cumDistance: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cumDistance.push(cumDistance[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  
  const totalLength = cumDistance[cumDistance.length - 1];
  if (totalLength === 0) {
    return Array.from({ length: numPoints }, () => ({ ...points[0] }));
  }
  
  const resampled: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const targetDist = (i / (numPoints - 1)) * totalLength;
    
    let segmentIndex = 0;
    while (segmentIndex < cumDistance.length - 1 && cumDistance[segmentIndex + 1] < targetDist) {
      segmentIndex++;
    }
    
    const p0 = points[segmentIndex];
    const p1 = points[segmentIndex + 1];
    const dist0 = cumDistance[segmentIndex];
    const dist1 = cumDistance[segmentIndex + 1];
    
    const segmentLength = dist1 - dist0;
    const t = segmentLength === 0 ? 0 : (targetDist - dist0) / segmentLength;
    
    resampled.push({
      x: p0.x + t * (p1.x - p0.x),
      y: p0.y + t * (p1.y - p0.y),
      pressure: (p0.pressure !== undefined && p1.pressure !== undefined) 
        ? p0.pressure + t * (p1.pressure - p0.pressure) 
        : p0.pressure ?? p1.pressure
    });
  }
  
  return resampled;
}

/**
 * Smooths path points using a moving average window to eliminate hand jitter
 */
export function smoothPoints(points: Point[], factor: number): Point[] {
  if (factor <= 0 || points.length < 3) return points;
  
  const smoothed: Point[] = [];
  const len = points.length;
  
  for (let i = 0; i < len; i++) {
    let sumX = 0;
    let sumY = 0;
    let sumPressure = 0;
    let count = 0;
    
    for (let w = -factor; w <= factor; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < len) {
        sumX += points[idx].x;
        sumY += points[idx].y;
        if (points[idx].pressure !== undefined) {
          sumPressure += points[idx].pressure!;
        }
        count++;
      }
    }
    
    smoothed.push({
      ...points[i],
      x: sumX / count,
      y: sumY / count,
      pressure: count > 0 ? sumPressure / count : undefined
    });
  }
  
  return smoothed;
}

/**
 * Calculates the centroid of a path (used for collapsing unmatched paths)
 */
function getCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 50, y: 50 };
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  return { x: sumX / points.length, y: sumY / points.length };
}

/**
 * Interpolates two strokes on a progress t (from 0 to 1)
 */
export function interpolateStrokes(
  strokeA: Stroke,
  strokeB: Stroke,
  t: number,
  sampleDensity: number,
  smoothingFactor: number
): Stroke {
  const numPoints = Math.max(sampleDensity, Math.max(strokeA.points.length, strokeB.points.length));
  
  const pointsA = resamplePoints(strokeA.points, numPoints);
  const pointsB = resamplePoints(strokeB.points, numPoints);
  
  const interpolatedPoints: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    interpolatedPoints.push({
      x: pointsA[i].x + t * (pointsB[i].x - pointsA[i].x),
      y: pointsA[i].y + t * (pointsB[i].y - pointsA[i].y),
      pressure: (pointsA[i].pressure !== undefined && pointsB[i].pressure !== undefined)
        ? pointsA[i].pressure! + t * (pointsB[i].pressure! - pointsA[i].pressure!)
        : pointsA[i].pressure ?? pointsB[i].pressure
    });
  }
  
  const smoothed = smoothPoints(interpolatedPoints, smoothingFactor);
  
  return {
    id: `interpolated-${strokeA.id}-${strokeB.id}-${Math.random().toString(36).substring(2, 5)}`,
    points: smoothed,
    color: lerpColor(strokeA.color, strokeB.color, t),
    width: strokeA.width + t * (strokeB.width - strokeA.width),
    glowColor: lerpColor(strokeA.glowColor, strokeB.glowColor, t),
    glowWidth: strokeA.glowWidth + t * (strokeB.glowWidth - strokeA.glowWidth),
    isClosed: strokeA.isClosed,
    style: strokeA.style
  };
}

/**
 * Executes a full timeline keyframe interpolation run.
 * Automatically identifies keyframes (frames with strokes) and generates fluid 
 * in-between frames for all gaps.
 */
export function interpolateTimeline(
  frames: FrameData[],
  options: {
    easing: EasingType;
    sampleDensity: number;
    smoothingFactor: number;
    scope: 'all' | 'empty-only';
  }
): FrameData[] {
  const result = JSON.parse(JSON.stringify(frames)) as FrameData[];
  
  const keyframeIndices = result
    .filter((f) => f.strokes.length > 0)
    .map((f) => f.frameIndex)
    .sort((a, b) => a - b);
    
  if (keyframeIndices.length < 2) {
    return result; // Need at least 2 keyframes to interpolate
  }
  
  const easeFn = EASE_FUNCTIONS[options.easing] || EASE_FUNCTIONS.linear;
  
  // Interpolate gaps between consecutive keyframes
  for (let i = 0; i < keyframeIndices.length - 1; i++) {
    const idxStart = keyframeIndices[i];
    const idxEnd = keyframeIndices[i + 1];
    
    const strokesStart = result.find((f) => f.frameIndex === idxStart)!.strokes;
    const strokesEnd = result.find((f) => f.frameIndex === idxEnd)!.strokes;
    
    const gapSize = idxEnd - idxStart;
    if (gapSize <= 1) continue; // No in-betweens to generate
    
    for (let k = idxStart + 1; k < idxEnd; k++) {
      const targetFrame = result.find((f) => f.frameIndex === k)!;
      
      // If we are in empty-only mode, and the frame already has strokes, skip it
      if (options.scope === 'empty-only' && targetFrame.strokes.length > 0) {
        continue;
      }
      
      const tRaw = (k - idxStart) / gapSize;
      const t = easeFn(tRaw);
      
      const interpolatedStrokes: Stroke[] = [];
      
      const maxStrokes = Math.max(strokesStart.length, strokesEnd.length);
      
      for (let sIdx = 0; sIdx < maxStrokes; sIdx++) {
        const sA = strokesStart[sIdx];
        const sB = strokesEnd[sIdx];
        
        if (sA && sB) {
          // Normal pairing: interpolate both paths
          interpolatedStrokes.push(interpolateStrokes(sA, sB, t, options.sampleDensity, options.smoothingFactor));
        } else if (sA) {
          // Extra stroke on start frame: shrink and fade out towards its centroid
          const centroid = getCentroid(sA.points);
          const collapsedB: Stroke = {
            ...sA,
            id: `collapse-${sA.id}`,
            points: Array.from({ length: sA.points.length }, () => ({ ...centroid })),
            width: 0.1,
            glowWidth: 0.1
          };
          interpolatedStrokes.push(interpolateStrokes(sA, collapsedB, t, options.sampleDensity, options.smoothingFactor));
        } else if (sB) {
          // Extra stroke on end frame: grow and fade in from its centroid
          const centroid = getCentroid(sB.points);
          const collapsedA: Stroke = {
            ...sB,
            id: `collapse-${sB.id}`,
            points: Array.from({ length: sB.points.length }, () => ({ ...centroid })),
            width: 0.1,
            glowWidth: 0.1
          };
          interpolatedStrokes.push(interpolateStrokes(collapsedA, sB, t, options.sampleDensity, options.smoothingFactor));
        }
      }
      
      targetFrame.strokes = interpolatedStrokes;
    }
  }
  
  return result;
}
