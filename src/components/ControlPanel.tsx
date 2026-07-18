/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Stroke, FrameData } from '../types';
import { EasingType } from '../utils/interpolation';
import {
  Upload,
  MousePointerClick,
  Plus,
  Minus,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  ChevronDown,
  Check,
  FileJson,
  Image as ImageIcon,
  FileCode,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ChevronsUpDown,
  Brush,
  Slash,
  Pentagon,
  Film,
  Video,
} from 'lucide-react';

interface ControlPanelProps {
  currentFrameIndex: number;
  totalFrames: number;
  isPlaying: boolean;
  onSetIsPlaying: (playing: boolean) => void;
  onSetFrameIndex: (idx: number) => void;
  frames: FrameData[];
  onUpdateFrameStrokes: (strokes: Stroke[]) => void;

  selectedColor: string;
  onSetSelectedColor: (color: string) => void;
  selectedWidth: number;
  onSetSelectedWidth: (width: number) => void;
  selectedStyle: Stroke['style'];
  onSetSelectedStyle: (style: Stroke['style']) => void;
  selectedTool: 'brush' | 'line' | 'polygon' | 'eraser' | 'point' | 'magic';
  onSetSelectedTool: (tool: 'brush' | 'line' | 'polygon' | 'eraser' | 'point' | 'magic') => void;

  showOnionSkin: boolean;
  onSetShowOnionSkin: (show: boolean) => void;
  onionSkinRange: number;
  onSetOnionSkinRange: (range: number) => void;

  zSpacing: number;
  onSetZSpacing: (spacing: number) => void;

  onClearFrame: () => void;
  onResetAllMasks: () => void;
  onExportAnimation: () => void;
  onExportFormat?: (format: 'mp4' | 'gif') => void;

  // Point editing and history
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onTrackMask: (direction: 'forward' | 'backward' | 'both') => void;
  onInterpolateTimeline: (options: {
    easing: EasingType;
    sampleDensity: number;
    smoothingFactor: number;
    scope: 'all' | 'empty-only';
  }) => void;
  pointEditMode: 'add' | 'remove';
  onSetPointEditMode: (mode: 'add' | 'remove') => void;
  selectedStrokeId: string | null;
  onSetSelectedStrokeId: (id: string | null) => void;
  onVideoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  magicMaskMode?: 'add' | 'remove';
  onSetMagicMaskMode?: (mode: 'add' | 'remove') => void;
  onSetTotalFrames?: (frames: number) => void;
}

export default function ControlPanel({
  currentFrameIndex,
  totalFrames,
  isPlaying,
  onSetIsPlaying,
  onSetFrameIndex,
  frames,
  onUpdateFrameStrokes,

  selectedColor,
  onSetSelectedColor,
  selectedWidth,
  onSetSelectedWidth,
  selectedStyle,
  onSetSelectedStyle,
  selectedTool,
  onSetSelectedTool,

  showOnionSkin,
  onSetShowOnionSkin,
  onionSkinRange,
  onSetOnionSkinRange,

  zSpacing,
  onSetZSpacing,
  onClearFrame,
  onResetAllMasks,
  onExportAnimation,
  onExportFormat,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onTrackMask,
  onInterpolateTimeline,
  pointEditMode,
  onSetPointEditMode,
  selectedStrokeId,
  onSetSelectedStrokeId,
  onVideoUpload,
  magicMaskMode = 'add',
  onSetMagicMaskMode,
  onSetTotalFrames,
}: ControlPanelProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  // AI Interpolation configuration states
  const [easingType, setEasingType] = useState<EasingType>('easeInOut');
  const [sampleDensity, setSampleDensity] = useState<number>(60);
  const [smoothingFactor, setSmoothingFactor] = useState<number>(1);
  const [interpolationScope, setInterpolationScope] = useState<'all' | 'empty-only'>('all');

  // 1. Export static SVG for current active frame
  const handleExportSVG = () => {
    const currentFrame = frames.find((f) => f.frameIndex === currentFrameIndex);
    if (!currentFrame || currentFrame.strokes.length === 0) {
      alert("No paths drawn on the current frame to export as SVG.");
      return;
    }
    
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" style="background:#000;">\n`;
    currentFrame.strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      
      const pointsStr = stroke.points.map((pt) => {
        const x = ((pt.x / 100) * 640).toFixed(1);
        const y = ((pt.y / 100) * 360).toFixed(1);
        return `${x},${y}`;
      }).join(' ');
      
      const isClosed = stroke.isClosed;
      const color = stroke.color;
      const width = stroke.width;
      
      if (isClosed) {
        svgContent += `  <polygon points="${pointsStr}" fill="none" stroke="${color}" stroke-width="${width}" />\n`;
      } else {
        svgContent += `  <polyline points="${pointsStr}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />\n`;
      }
    });
    svgContent += `</svg>`;
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roto3d-frame-${currentFrameIndex + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // 2. Export compound composite SVG sequence
  const handleExportCompositeSVG = () => {
    const framesWithStrokes = frames.filter((f) => f.strokes.length > 0);
    if (framesWithStrokes.length === 0) {
      alert("No paths drawn on any frames to export composite SVG sequence.");
      return;
    }
    
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" style="background:#000;">\n`;
    svgContent += `  <!-- Rotoscope Multi-Frame Stack Composite -->\n`;
    
    framesWithStrokes.forEach((f) => {
      svgContent += `  <g id="frame-${f.frameIndex + 1}" opacity="${(1.0 - (f.frameIndex / totalFrames) * 0.4).toFixed(2)}">\n`;
      f.strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        const pointsStr = stroke.points.map((pt) => {
          const x = ((pt.x / 100) * 640).toFixed(1);
          const y = ((pt.y / 100) * 360).toFixed(1);
          return `${x},${y}`;
        }).join(' ');
        
        const color = stroke.color;
        const width = stroke.width;
        if (stroke.isClosed) {
          svgContent += `    <polygon points="${pointsStr}" fill="none" stroke="${color}" stroke-width="${width}" />\n`;
        } else {
          svgContent += `    <polyline points="${pointsStr}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        }
      });
      svgContent += `  </g>\n`;
    });
    svgContent += `</svg>`;
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roto3d-sequence-composite.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // 3. Export PNG high-contrast mask silhouette
  const handleExportPNG = () => {
    const currentFrame = frames.find((f) => f.frameIndex === currentFrameIndex);
    if (!currentFrame || currentFrame.strokes.length === 0) {
      alert("No paths drawn on this frame to export as PNG silhouette.");
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill high contrast matte black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1280, 720);

    // Render strokes scaled up
    currentFrame.strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      stroke.points.forEach((pt, idx) => {
        const x = (pt.x / 100) * 1280;
        const y = (pt.y / 100) * 720;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      if (stroke.isClosed) {
        ctx.closePath();
      }

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * 2; // scale width
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `roto3d-mask-silhouette-${currentFrameIndex + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportMenu(false);
  };

  // 4. Export CSS @keyframes
  const handleExportCSS = () => {
    let cssContent = `/* Roto3D Cybernetic CSS Motion Keyframe Exports */\n\n`;
    cssContent += `@keyframes mask-sequence {\n`;
    
    frames.forEach((f, idx) => {
      const percentage = ((idx / (frames.length - 1)) * 100).toFixed(1);
      const firstStroke = f.strokes[0];
      
      if (firstStroke && firstStroke.points.length > 0) {
        const pointsStr = firstStroke.points.map((pt) => `${pt.x}% ${pt.y}%`).join(', ');
        cssContent += `  ${percentage}% {\n    clip-path: polygon(${pointsStr});\n  }\n`;
      } else {
        cssContent += `  ${percentage}% {\n    clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);\n  }\n`;
      }
    });
    
    cssContent += `}\n\n`;
    cssContent += `.roto-animated-mask {\n  animation: mask-sequence 3s infinite linear;\n}\n`;

    const blob = new Blob([cssContent], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roto3d-css-motion.css`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div
      id="timeline-controls-panel"
      className="bg-[#0a0a0a] border border-white/10 rounded-none p-6 flex flex-col gap-6 shadow-2xl select-none text-left"
    >
      {/* 1. MEDIA UPLOAD DIVISION & TIMELINE LENGTH CONFIG */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 block">
            Source Media
          </span>
          <label className="flex items-center justify-center gap-2 border border-dashed border-white/20 hover:border-white/50 bg-white/5 hover:bg-white/10 transition px-4 py-3 cursor-pointer text-[10px] font-mono font-bold uppercase text-white tracking-wider">
            <Upload className="w-3.5 h-3.5 text-white/70" />
            <span>Upload Video</span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={onVideoUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Dynamic Sequence Frame Count Adjuster */}
        <div className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 p-3">
          <div className="flex justify-between items-center text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-white/40">
            <span>Sequence Length</span>
            <span className="text-cyan-400 font-extrabold font-mono text-[10px]">
              {totalFrames} FRAMES
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              onClick={() => onSetTotalFrames?.(Math.max(5, totalFrames - 4))}
              className="px-2.5 py-1 border border-white/10 bg-[#111111] hover:bg-white/5 hover:border-white/20 text-[10px] font-mono font-bold text-white transition-all cursor-pointer select-none active:scale-95"
              title="Decrease Timeline Length (-4 frames)"
            >
              -4F
            </button>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={totalFrames}
              onChange={(e) => onSetTotalFrames?.(Number(e.target.value))}
              className="flex-1 accent-cyan-400 bg-white/10 h-1 rounded-none cursor-pointer"
            />
            <button
              onClick={() => onSetTotalFrames?.(Math.min(100, totalFrames + 4))}
              className="px-2.5 py-1 border border-white/10 bg-[#111111] hover:bg-white/5 hover:border-white/20 text-[10px] font-mono font-bold text-white transition-all cursor-pointer select-none active:scale-95"
              title="Increase Timeline Length (+4 frames)"
            >
              +4F
            </button>
          </div>
          <p className="text-[8px] font-mono text-white/35 leading-normal">
            Dynamic sequence resizing. Preserves existing mask keyframes while extending or cropping timeline instantly. (5 to 100 frames)
          </p>
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* 2. ROTOSCOPE TOOLBOX (BRUSH, LINE, POLYGON, NODES, ERASER) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 block">
            Rotoscope Toolbox
          </span>
        </div>

        {/* DRAW DIVISION */}
        <div className="flex flex-col gap-1.5 text-left">
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/30">
            Vector Draw
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {/* Brush Tool */}
            <button
              onClick={() => onSetSelectedTool('brush')}
              className={`py-2.5 px-1 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 justify-center ${
                selectedTool === 'brush'
                  ? 'bg-white text-black border-white'
                  : 'bg-[#111111] border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
              title="Brush Tool: Draw organic freehand vector lines"
            >
              <Brush className="w-3.5 h-3.5" />
              <span>Brush</span>
            </button>

            {/* Line Tool */}
            <button
              onClick={() => onSetSelectedTool('line')}
              className={`py-2.5 px-1 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 justify-center ${
                selectedTool === 'line'
                  ? 'bg-white text-black border-white'
                  : 'bg-[#111111] border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
              title="Line Tool: Click and drag to draw straight lines"
            >
              <Slash className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>

            {/* Polygon Tool */}
            <button
              onClick={() => onSetSelectedTool('polygon')}
              className={`py-2.5 px-1 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 justify-center ${
                selectedTool === 'polygon'
                  ? 'bg-white text-black border-white'
                  : 'bg-[#111111] border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
              title="Polygon Tool: Click vertices to draw a closed vector shape"
            >
              <Pentagon className="w-3.5 h-3.5" />
              <span>Polygon</span>
            </button>
          </div>
        </div>

        {/* EDIT DIVISION */}
        <div className="flex flex-col gap-1.5 text-left mt-0.5">
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/30">
            Vector Edit
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Selection/Nodes Tool */}
            <button
              onClick={() => {
                onSetSelectedTool('point');
                onSetPointEditMode('add'); // default to edit/add nodes
              }}
              className={`py-2.5 px-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 justify-center ${
                selectedTool === 'point'
                  ? 'bg-white text-black border-white font-black'
                  : 'bg-[#111111] border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
              title="Nodes Tool: Click any path on the canvas to select it, then drag or click nodes to edit"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>Nodes Tool</span>
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => onSetSelectedTool('eraser')}
              className={`py-2.5 px-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 justify-center ${
                selectedTool === 'eraser'
                  ? 'bg-white text-black border-white font-black'
                  : 'bg-[#111111] border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
              title="Eraser Tool: Erase drawn keyframe vector strokes"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>
          </div>
        </div>

        {/* AI MAGIC MASK DIVISION */}
        <div className="flex flex-col gap-1.5 text-left mt-0.5">
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/30">
            AI Magic Cutout
          </span>
          <button
            onClick={() => onSetSelectedTool('magic')}
            className={`w-full py-3 px-3 border text-[10px] font-mono font-bold uppercase tracking-widest transition-all flex items-center gap-2.5 justify-center relative overflow-hidden group ${
              selectedTool === 'magic'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black border-cyan-400 font-extrabold shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                : 'bg-[#111111] border-white/10 text-white/60 hover:text-white hover:border-white/20'
            }`}
            title="MAGIC MASK Tool: Isolate subject (background removing) or click-to-mask any custom object with AI"
          >
            <Sparkles className={`w-4 h-4 ${selectedTool === 'magic' ? 'text-black' : 'text-cyan-400 group-hover:animate-spin'}`} />
            <span>MAGIC MASK</span>
            {selectedTool === 'magic' && (
              <span className="absolute top-0 right-0 bg-black text-white text-[7px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wide">
                ACTIVE
              </span>
            )}
          </button>
        </div>

        {/* Sub-configurator for Point Mask Tool (REMOVE and ADD) */}
        {selectedTool === 'point' && (
          <div className="p-3 bg-white/5 border border-white/10 mt-0.5 flex flex-col gap-2 text-left">
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/40 block border-b border-white/5 pb-1">
              Node configuration
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => onSetPointEditMode('add')}
                className={`flex-1 py-1.5 px-1.5 border text-[9px] font-mono font-bold transition flex items-center justify-center gap-1 ${
                  pointEditMode === 'add'
                    ? 'bg-white text-black border-white'
                    : 'bg-black border-white/10 text-white/60 hover:text-white hover:border-white/25'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>Add Node</span>
              </button>
              <button
                onClick={() => onSetPointEditMode('remove')}
                className={`flex-1 py-1.5 px-1.5 border text-[9px] font-mono font-bold transition flex items-center justify-center gap-1 ${
                  pointEditMode === 'remove'
                    ? 'bg-white text-black border-white'
                    : 'bg-black border-white/10 text-white/60 hover:text-white hover:border-white/25'
                }`}
              >
                <Minus className="w-3 h-3" />
                <span>Remove Node</span>
              </button>
            </div>
            
            <p className="text-[9px] text-white/40 font-mono leading-relaxed mt-0.5">
              {pointEditMode === 'add'
                ? 'Click path segment to insert a control node, or drag to reposition.'
                : 'Click an active circular node vertex to delete it.'}
            </p>

            {selectedStrokeId && (
              <button
                onClick={() => onSetSelectedStrokeId(null)}
                className="w-full mt-1 py-1.5 px-2 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 font-mono text-[9px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                title="Deselect active path to clear selection nodes"
              >
                <span>Deselect Active Path</span>
              </button>
            )}
          </div>
        )}

        {/* Sub-configurator for MAGIC MASK */}
        {selectedTool === 'magic' && (
          <div className="p-4 bg-white/5 border border-white/10 mt-0.5 flex flex-col gap-3 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none rounded-full blur-xl" />
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-cyan-400 block border-b border-white/5 pb-1 font-bold">
              AI Magic Mask Parameters
            </span>
            
            <p className="text-[10px] text-white/70 font-mono leading-relaxed">
              Isolate any visual subject from its background instantly using generative intelligence.
            </p>

            {/* ADD vs REMOVE mask Mode Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-white/40 font-bold">Magic Mask Mode</span>
              <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-black/40 border border-white/10 rounded-none">
                <button
                  onClick={() => onSetMagicMaskMode?.('add')}
                  className={`py-1.5 px-2 text-[9px] font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                    magicMaskMode === 'add'
                      ? 'bg-cyan-500 text-black font-extrabold shadow-[0_0_10px_rgba(6,182,212,0.35)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="ADD Mask Mode: Newly generated boundaries will add positive mask areas"
                >
                  <Plus className="w-3 h-3" />
                  <span>ADD MASK</span>
                </button>
                <button
                  onClick={() => onSetMagicMaskMode?.('remove')}
                  className={`py-1.5 px-2 text-[9px] font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                    magicMaskMode === 'remove'
                      ? 'bg-red-500 text-white font-extrabold shadow-[0_0_10px_rgba(239,68,68,0.35)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="REMOVE Mask Mode: Generates a red subtractive cutout mask zone to exclude details"
                >
                  <Minus className="w-3 h-3" />
                  <span>REMOVE MASK</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5 my-0.5" />

            <div className="flex flex-col gap-2">
              <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-white/40 font-bold">Auto Cutout (BG Removing)</span>
              <button
                onClick={() => {
                  const event = new CustomEvent('trigger-magic-subject-mask');
                  window.dispatchEvent(event);
                }}
                className="w-full py-2.5 px-3 border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-400 hover:text-cyan-300 text-[9px] font-mono font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 active:scale-[0.98]"
                title="Isolate Subject: Automatically detect and mask the main subject to remove background"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Isolate Foreground Subject</span>
              </button>
            </div>

            <div className="h-px bg-white/5 my-0.5" />

            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-white/40 font-bold">Interactive Click Mode</span>
              <div className="flex items-start gap-2 bg-black/40 border border-white/5 p-2">
                <span className="text-cyan-400 text-xs mt-0.5">💡</span>
                <p className="text-[9px] text-white/50 font-mono leading-normal">
                  Click anywhere on the video frame player on the left. The AI will isolate the specific clicked object and generate a closed vector mask boundary!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-white/5" />

      {/* 3. MASK TRACKING / PROPAGATION */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 block">
          Mask Tracking / Propagation
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onTrackMask('backward')}
            className="py-2.5 px-1 border border-white/10 bg-[#111111] hover:bg-white/5 hover:border-white/30 text-white text-[9px] font-mono font-bold uppercase tracking-wide transition flex flex-col items-center justify-center gap-1.5"
            title="Track Backward: Copy active mask to previous frame and step backward"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Track Back</span>
          </button>
          
          <button
            onClick={() => onTrackMask('both')}
            className="py-2.5 px-1 border border-white/10 bg-[#111111] hover:bg-white/5 hover:border-white/30 text-white text-[9px] font-mono font-bold uppercase tracking-wide transition flex flex-col items-center justify-center gap-1.5"
            title="Track Both: Copy active mask to both previous and next frames"
          >
            <ChevronsUpDown className="w-4 h-4 text-cyan-400" />
            <span>Track Both</span>
          </button>

          <button
            onClick={() => onTrackMask('forward')}
            className="py-2.5 px-1 border border-white/10 bg-[#111111] hover:bg-white/5 hover:border-white/30 text-white text-[9px] font-mono font-bold uppercase tracking-wide transition flex flex-col items-center justify-center gap-1.5"
            title="Track Forward: Copy active mask to next frame and step forward"
          >
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <span>Track Fwd</span>
          </button>
        </div>
        <p className="text-[9px] text-white/30 font-mono leading-relaxed">
          Copy active vector paths to adjacent keyframes for fluid, step-by-step frame propagation.
        </p>
      </div>

      <div className="h-px bg-white/5" />

      {/* AI KEYFRAME INTERPOLATION SECTION */}
      <div className="flex flex-col gap-3 p-3.5 bg-white/5 border border-white/10 rounded-none relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        </div>
        
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/80 block">
            AI Keyframe Interpolation
          </span>
          <p className="text-[9px] text-white/40 font-mono leading-tight">
            Synthesize intermediate frame vectors with smart motion morphing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-left">
          {/* Easing Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Speed Curve</label>
            <select
              value={easingType}
              onChange={(e) => setEasingType(e.target.value as EasingType)}
              className="bg-black border border-white/10 text-white font-mono text-[10px] py-1.5 px-2 rounded-none outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              <option value="linear">Linear Morph</option>
              <option value="easeInOut">Smooth Ease</option>
              <option value="easeIn">Accelerate</option>
              <option value="easeOut">Decelerate</option>
              <option value="elastic">Elastic Bounce</option>
            </select>
          </div>

          {/* Scope Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-mono text-white/50 uppercase tracking-wider">Overwrite Mode</label>
            <select
              value={interpolationScope}
              onChange={(e) => setInterpolationScope(e.target.value as 'all' | 'empty-only')}
              className="bg-black border border-white/10 text-white font-mono text-[10px] py-1.5 px-2 rounded-none outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              <option value="all">Overwrite All</option>
              <option value="empty-only">Empty Gaps Only</option>
            </select>
          </div>
        </div>

        {/* Sliders in layout */}
        <div className="flex flex-col gap-2 text-left">
          {/* Sample Density Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-mono text-white/50 uppercase">
              <span>Vertex density</span>
              <span className="text-cyan-400 font-bold">{sampleDensity} pts</span>
            </div>
            <input
              type="range"
              min="20"
              max="120"
              step="10"
              value={sampleDensity}
              onChange={(e) => setSampleDensity(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-black/50 rounded-none cursor-pointer outline-none border border-white/5"
            />
          </div>

          {/* Smoothing Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-mono text-white/50 uppercase">
              <span>Path Smoothing</span>
              <span className="text-emerald-400 font-bold">
                {smoothingFactor === 0 ? 'Disabled' : `Factor ${smoothingFactor}`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={smoothingFactor}
              onChange={(e) => setSmoothingFactor(Number(e.target.value))}
              className="w-full accent-emerald-400 h-1 bg-black/50 rounded-none cursor-pointer outline-none border border-white/5"
            />
          </div>
        </div>

        <button
          onClick={() => onInterpolateTimeline({
            easing: easingType,
            sampleDensity,
            smoothingFactor,
            scope: interpolationScope
          })}
          className="w-full mt-1.5 py-2.5 px-3 bg-white hover:bg-cyan-400 text-black font-mono font-bold text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2 border border-white hover:border-cyan-400 active:scale-[0.98]"
          title="Interpolate Timeline: Automatically tween and morph drawings across the timeline"
        >
          <Sparkles className="w-3.5 h-3.5 text-black" />
          <span>Run AI Interpolation</span>
        </button>
      </div>

      <div className="h-px bg-white/5" />

      {/* 4. RESTORE & RESET ACTIONS */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 block">
          Restore & Reset Actions
        </span>
        
        {/* Undo/Redo Action Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="py-2.5 px-2 border border-white/10 bg-[#111111]/70 hover:bg-white/5 hover:border-white/30 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 active:scale-[0.98]"
            title="Undo last action"
          >
            <Undo2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Undo</span>
          </button>
          
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="py-2.5 px-2 border border-white/10 bg-[#111111]/70 hover:bg-white/5 hover:border-white/30 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 active:scale-[0.98]"
            title="Redo undone action"
          >
            <Redo2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Redo</span>
          </button>
        </div>

        {/* Reset Mask Action Buttons */}
        <div className="flex flex-col gap-1.5">
          {/* Reset Frame Mask Button */}
          <button
            onClick={onClearFrame}
            className="w-full py-2.5 px-3 border border-red-500/25 hover:border-red-500/50 bg-red-950/15 hover:bg-red-950/30 text-red-400 text-[10px] font-mono font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 active:scale-[0.98]"
            title="Reset Frame Mask: Clears all vector paths from the current frame"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>Reset Current Frame Mask</span>
          </button>

          {/* Reset All Frames Mask Button */}
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to reset all masks across the entire timeline? This action can be undone.")) {
                onResetAllMasks();
              }
            }}
            className="w-full py-2 px-3 border border-red-500/10 hover:border-red-500/25 bg-red-950/5 hover:bg-red-950/15 text-red-400/65 hover:text-red-400 text-[9px] font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 active:scale-[0.98]"
            title="Reset All Frames: Clears all vector paths from all timeline keyframes"
          >
            <Trash2 className="w-3 h-3 text-red-400/50" />
            <span>Reset All Timeline Masks</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* 4. EXPORT MENU DIVISION WITH MULTIPLE EXPORT OPTIONS */}
      <div className="relative flex flex-col gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 block">
          Export Matrix
        </span>
        
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="w-full bg-white hover:bg-white/95 text-black border border-white text-[10px] font-mono font-bold tracking-[0.15em] py-3 px-4 rounded-none flex items-center justify-between transition shadow-sm uppercase"
        >
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5" />
            <span>Export Sequence</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
        </button>

        {showExportMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#0d0d0d] border border-white/10 shadow-2xl z-50 flex flex-col p-1.5 animate-fadeIn">
            <div className="px-3.5 py-2 text-[8px] font-mono uppercase tracking-widest text-white/30 border-b border-white/5 mb-1.5 flex justify-between items-center">
              <span>Choose Export Output Format</span>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            </div>

            {/* Option A: Vector JSON Sequence */}
            <button
              onClick={() => {
                onExportAnimation();
                setShowExportMenu(false);
              }}
              className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              <div className="flex flex-col">
                <span className="font-bold">JSON Keyframe Sequence</span>
                <span className="text-[8px] text-white/40 mt-0.5">Full multi-frame vector path sequence</span>
              </div>
            </button>

            {/* Option MP4: Video Export */}
            {onExportFormat && (
              <button
                onClick={() => {
                  onExportFormat('mp4');
                  setShowExportMenu(false);
                }}
                className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5 border-t border-white/5"
              >
                <Video className="w-3.5 h-3.5 text-red-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Render MP4 Video Sequence</span>
                  <span className="text-[8px] text-white/40 mt-0.5">Export high-definition MP4 clip with vector glow</span>
                </div>
              </button>
            )}

            {/* Option GIF: Animated GIF Export */}
            {onExportFormat && (
              <button
                onClick={() => {
                  onExportFormat('gif');
                  setShowExportMenu(false);
                }}
                className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5 border-t border-white/5"
              >
                <Film className="w-3.5 h-3.5 text-indigo-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Generate Animated GIF</span>
                  <span className="text-[8px] text-white/40 mt-0.5">Export lightweight looping animated GIF</span>
                </div>
              </button>
            )}

            {/* Option B: SVG Current Frame */}
            <button
              onClick={handleExportSVG}
              className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5 border-t border-white/5"
            >
              <FileCode className="w-3.5 h-3.5 text-pink-400" />
              <div className="flex flex-col">
                <span className="font-bold">SVG Static Vector (Active Frame)</span>
                <span className="text-[8px] text-white/40 mt-0.5">Download current frame as scalable SVG</span>
              </div>
            </button>

            {/* Option C: SVG Composite Sequence */}
            <button
              onClick={handleExportCompositeSVG}
              className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5 border-t border-white/5"
            >
              <Sparkles className="w-3.5 h-3.5 text-green-400" />
              <div className="flex flex-col">
                <span className="font-bold">SVG Sequence Composite Stack</span>
                <span className="text-[8px] text-white/40 mt-0.5">Overlay all keyframes in a compound SVG stack</span>
              </div>
            </button>

            {/* Option D: PNG Mask Silhouette */}
            <button
              onClick={handleExportPNG}
              className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5 border-t border-white/5"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <div className="flex flex-col">
                <span className="font-bold">PNG Matte Silhouette Mask</span>
                <span className="text-[8px] text-white/40 mt-0.5">High-contrast alpha-matte PNG silhouette</span>
              </div>
            </button>

            {/* Option E: CSS Animation Keyframes */}
            <button
              onClick={handleExportCSS}
              className="px-3 py-2.5 text-left text-[10px] font-mono hover:bg-white/5 text-white/80 hover:text-white transition flex items-center gap-2.5 border-t border-white/5"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              <div className="flex flex-col">
                <span className="font-bold">CSS Motion Keyframes (.css)</span>
                <span className="text-[8px] text-white/40 mt-0.5">Export clip-path CSS @keyframes animation</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
