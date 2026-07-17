/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number; // Normalized coordinate (0 to 100)
  y: number; // Normalized coordinate (0 to 100)
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string; // Hex or CSS color
  width: number; // Line width in pixels
  glowColor: string;
  glowWidth: number;
  isClosed: boolean;
  style: 'neon' | 'laser' | 'dotted' | 'dashed' | 'pulse';
}

export interface FrameData {
  frameIndex: number;
  timestamp: number;
  strokes: Stroke[];
}

export interface VideoSample {
  id: string;
  name: string;
  url: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Expert';
  description: string;
}

export interface Camera3D {
  rotationX: number; // in radians
  rotationY: number; // in radians
  zoom: number;
  panX: number;
  panY: number;
}

export interface AIAssistantState {
  isAnalyzing: boolean;
  analysisText: string;
  suggestedPaths: Stroke[];
  confidence: number;
}
