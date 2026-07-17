/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { FrameData, Stroke, VideoSample } from './types';
import RotoscopeCanvas from './components/RotoscopeCanvas';
import Viewport3D from './components/Viewport3D';
import ControlPanel from './components/ControlPanel';
import AIAssistant from './components/AIAssistant';
import { interpolateTimeline, EasingType } from './utils/interpolation';
import {
  Video,
  Upload,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  Activity,
  HeartHandshake,
} from 'lucide-react';

const PRESET_SAMPLES: VideoSample[] = [
  {
    id: 'cyber-dancer',
    name: 'Cyber Dancer',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-dancing-woman-in-the-neon-light-40435-large.mp4',
    category: 'Vibrant Motion',
    difficulty: 'Beginner',
    description: 'A dancer illuminated by neon light, performing slow fluid spins. Perfect for tracing torso lines.',
  },
  {
    id: 'neon-ribbons',
    name: 'Neon Acrobat',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-doing-gymnastic-exercises-with-neon-ribbons-40431-large.mp4',
    category: 'Acrobatic Sweep',
    difficulty: 'Intermediate',
    description: 'An acrobat doing sweeps with glowing neon ribbons. Great for practicing circular kinetic vectors.',
  },
  {
    id: 'cyber-street',
    name: 'Futuristic Cybercar',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-fast-driving-on-a-neon-night-street-43187-large.mp4',
    category: 'Speed Path',
    difficulty: 'Expert',
    description: 'High-speed street drive through futuristic city lights. Perfect for tracking perspective vector streams.',
  },
];

const TOTAL_FRAMES = 24;

export default function App() {
  const [activeTab, setActiveTab] = useState<'drawing' | '3d'>('drawing');
  const [activeSample, setActiveSample] = useState<VideoSample>(PRESET_SAMPLES[0]);
  const [videoUrl, setVideoUrl] = useState<string>(PRESET_SAMPLES[0].url);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Frame sequencer data states
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frames, setFrames] = useState<FrameData[]>(
    Array.from({ length: TOTAL_FRAMES }, (_, idx) => ({
      frameIndex: idx,
      timestamp: (idx / TOTAL_FRAMES) * 3, // mock timestamps
      strokes: [],
    }))
  );

  // Brush styling states
  const [selectedColor, setSelectedColor] = useState('#00f0ff');
  const [selectedWidth, setSelectedWidth] = useState(2.5);
  const [selectedStyle, setSelectedStyle] = useState<Stroke['style']>('neon');
  const [selectedTool, setSelectedTool] = useState<'brush' | 'line' | 'polygon' | 'eraser' | 'point'>('brush');

  // Point editing states
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [pointEditMode, setPointEditMode] = useState<'add' | 'remove'>('add');

  const handleSetSelectedTool = (tool: 'brush' | 'line' | 'polygon' | 'eraser' | 'point') => {
    setSelectedTool(tool);
    if (tool !== 'point') {
      setSelectedStrokeId(null);
    }
  };

  // History states
  const [undoStack, setUndoStack] = useState<FrameData[][]>([]);
  const [redoStack, setRedoStack] = useState<FrameData[][]>([]);

  const pushToUndo = (currentFrames: FrameData[]) => {
    const copy = JSON.parse(JSON.stringify(currentFrames));
    setUndoStack((prev) => [...prev, copy]);
    setRedoStack([]); // Clear redo
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    const currentCopy = JSON.parse(JSON.stringify(frames));
    setRedoStack((prev) => [...prev, currentCopy]);

    setFrames(previous);
    triggerToast('Undo successful');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    const currentCopy = JSON.parse(JSON.stringify(frames));
    setUndoStack((prev) => [...prev, currentCopy]);

    setFrames(next);
    triggerToast('Redo successful');
  };

  // Onion skin options
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [onionSkinRange, setOnionSkinRange] = useState(1);

  // 3D Spacing configuration
  const [zSpacing, setZSpacing] = useState(35);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronize playing states with HTML5 Video Element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Video time tracking sync (converts currentTime to frame index)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    const duration = video.duration || 1;
    const progress = video.currentTime / duration;
    // Cap to ensure frameIndex doesn't exceed total sequence limit
    const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.floor(progress * TOTAL_FRAMES));

    setCurrentFrameIndex(frameIdx);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Timeline Scrubbing: sets current video playtime directly matching scrubbed frame index
  const handleSetFrameIndex = (idx: number) => {
    setCurrentFrameIndex(idx);
    setIsPlaying(false);

    const video = videoRef.current;
    if (video && video.duration) {
      video.currentTime = (idx / TOTAL_FRAMES) * video.duration;
    }
  };

  const handleUpdateFrameStrokes = (strokes: Stroke[]) => {
    pushToUndo(frames);
    setFrames((prev) =>
      prev.map((f) => (f.frameIndex === currentFrameIndex ? { ...f, strokes } : f))
    );
  };

  const handleClearCurrentFrame = () => {
    pushToUndo(frames);
    setFrames((prev) =>
      prev.map((f) => (f.frameIndex === currentFrameIndex ? { ...f, strokes: [] } : f))
    );
    triggerToast('Frame strokes cleared');
  };

  const handleTrackMask = (direction: 'forward' | 'backward' | 'both') => {
    const currentStrokes = frames.find((f) => f.frameIndex === currentFrameIndex)?.strokes || [];
    if (currentStrokes.length === 0) {
      triggerToast('No masks on the current frame to track');
      return;
    }

    pushToUndo(frames);

    const cloneStrokes = () => JSON.parse(JSON.stringify(currentStrokes)).map((stroke: Stroke) => ({
      ...stroke,
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }));

    setFrames((prev) => {
      return prev.map((f) => {
        if (direction === 'forward' && f.frameIndex === currentFrameIndex + 1) {
          return { ...f, strokes: cloneStrokes() };
        }
        if (direction === 'backward' && f.frameIndex === currentFrameIndex - 1) {
          return { ...f, strokes: cloneStrokes() };
        }
        if (direction === 'both' && (f.frameIndex === currentFrameIndex - 1 || f.frameIndex === currentFrameIndex + 1)) {
          return { ...f, strokes: cloneStrokes() };
        }
        return f;
      });
    });

    if (direction === 'forward') {
      const nextFrameIndex = currentFrameIndex + 1;
      if (nextFrameIndex < TOTAL_FRAMES) {
        handleSetFrameIndex(nextFrameIndex);
        triggerToast('Mask tracked forward & advanced to next frame');
      } else {
        triggerToast('Mask tracked forward (already at last frame)');
      }
    } else if (direction === 'backward') {
      const prevFrameIndex = currentFrameIndex - 1;
      if (prevFrameIndex >= 0) {
        handleSetFrameIndex(prevFrameIndex);
        triggerToast('Mask tracked backward & moved to previous frame');
      } else {
        triggerToast('Mask tracked backward (already at first frame)');
      }
    } else {
      triggerToast('Mask tracked both forward and backward');
    }
  };

  const handleInterpolateTimeline = (options: {
    easing: EasingType;
    sampleDensity: number;
    smoothingFactor: number;
    scope: 'all' | 'empty-only';
  }) => {
    const keyframesCount = frames.filter((f) => f.strokes.length > 0).length;
    if (keyframesCount < 2) {
      triggerToast('Requires at least 2 frames with drawing keyframes to interpolate');
      return;
    }

    pushToUndo(frames);
    const updated = interpolateTimeline(frames, options);
    setFrames(updated);
    
    let filledCount = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].strokes.length === 0 && updated[i].strokes.length > 0) {
        filledCount++;
      }
    }
    
    if (filledCount > 0) {
      triggerToast(`AI Interpolated! Smoothed and generated ${filledCount} in-between frames.`);
    } else if (options.scope === 'empty-only') {
      triggerToast('AI Interpolation complete (no empty gaps to fill).');
    } else {
      triggerToast('AI Interpolation complete: Keyframe paths re-rendered.');
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Upload custom desktop video files
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setIsPlaying(false);
      setCurrentFrameIndex(0);
      setActiveSample({
        id: 'custom',
        name: file.name.substring(0, 18) + '...',
        url,
        category: 'Custom Video',
        difficulty: 'Intermediate',
        description: 'Your uploaded local workspace rotoscope file. Ready for tracing.',
      });
      triggerToast('Custom video loaded');
    }
  };

  // Export full multi-frame vector sequence as a clean JSON package
  const handleExportAnimation = () => {
    const exportData = {
      app: 'Roto3D Studio',
      timestamp: new Date().toISOString(),
      dimensions: { width: 1920, height: 1080 },
      framesCount: TOTAL_FRAMES,
      timeline: frames.map((f) => ({
        frame: f.frameIndex,
        strokes: f.strokes.map((s) => ({
          color: s.color,
          width: s.width,
          style: s.style,
          isClosed: s.isClosed,
          points: s.points,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roto3d-animation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Vector sequence exported');
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans flex flex-col relative overflow-x-hidden antialiased select-none">
      
      {/* GLOBAL NOTIFICATION TOAST */}
      {toastMessage && (
        <div id="global-toast-hud" className="fixed top-6 left-1/2 -translate-x-1/2 bg-white text-black font-mono text-[10px] uppercase tracking-widest px-6 py-3 border border-black shadow-2xl z-50 flex items-center gap-2 transition-all">
          <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION (EDITORIAL THEME: Minimalist, tracked spacing, crisp fine borders) */}
      <header id="app-header-nav" className="border-b border-white/10 bg-[#080808] sticky top-0 z-40 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-xs uppercase font-extrabold tracking-[0.3em] text-white">
            Rotoscope Pro v2.4
          </div>
          <div className="hidden sm:inline-block h-4 w-px bg-white/15" />
          <div className="hidden sm:block text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">
            Project: Shadow Runner
          </div>
        </div>

        {/* Global Hub stats / Metadata block */}
        <div className="flex items-center gap-8 text-[10px] font-mono text-white/60">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40">Sequence:</span>
            <span className="text-white uppercase font-bold tracking-wider">NEON_CITY_EXT_{String(currentFrameIndex + 400).padStart(4, '0')}</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-white/40">Interpolation:</span>
            <span className="text-white font-semibold">Bezier / Sub-pixel</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER LAYOUT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* LEFT COLUMN: Stage Display & Preset library (8/12 Columns) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* TAB SYSTEM CHANGER */}
          <div className="bg-[#0a0a0a] border border-white/10 p-1 flex rounded-none">
            <button
              onClick={() => setActiveTab('drawing')}
              className={`flex-1 py-3 px-4 font-mono text-[11px] font-bold tracking-[0.15em] transition-all flex items-center justify-center gap-2 rounded-none ${
                activeTab === 'drawing'
                  ? 'bg-white text-black border border-white'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>2D DRAWING STUDIO</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('3d');
                setIsPlaying(false);
              }}
              className={`flex-1 py-3 px-4 font-mono text-[11px] font-bold tracking-[0.15em] transition-all flex items-center justify-center gap-2 rounded-none ${
                activeTab === '3d'
                  ? 'bg-white text-black border border-white'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>3D SPACETIME CHAMBER</span>
            </button>
          </div>

          {/* ACTIVE WORKSPACE CELL */}
          <div className="flex-1 min-h-[440px] bg-[#111111] border border-white/10 rounded-none relative overflow-hidden flex items-center justify-center p-4 group shadow-2xl">
            
            {/* Viewport Frame Background GRID Accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* TAB 1: 2D drawing canvas layered over active looping video */}
            {activeTab === 'drawing' ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div id="video-canvas-stage-wrapper" className="relative w-[90%] aspect-video rounded-none overflow-hidden bg-black border border-white/15 shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex items-center justify-center">
                  
                  {/* Embedded HTML5 Core Player */}
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    loop={false}
                    muted
                    playsInline
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* Overlying Interactive SVG Canvas */}
                  <RotoscopeCanvas
                    currentFrameIndex={currentFrameIndex}
                    frames={frames}
                    onUpdateFrameStrokes={handleUpdateFrameStrokes}
                    selectedColor={selectedColor}
                    selectedWidth={selectedWidth}
                    selectedStyle={selectedStyle}
                    selectedTool={selectedTool}
                    videoRef={videoRef}
                    showOnionSkin={showOnionSkin}
                    onionSkinRange={onionSkinRange}
                    selectedStrokeId={selectedStrokeId}
                    onSetSelectedStrokeId={setSelectedStrokeId}
                    pointEditMode={pointEditMode}
                  />

                  {/* 2D Mode overlay label HUD */}
                  <div className="absolute top-4 left-4 bg-[#080808]/90 border border-white/20 px-3 py-1 text-[9px] font-mono text-white select-none pointer-events-none flex items-center gap-1.5 shadow-md">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                    <span>FRAME 0{currentFrameIndex + 424}</span>
                  </div>
                </div>

                {/* Sub-canvas timeline frame number badge */}
                <div
                  id="external-frames-indicator"
                  className="bg-[#080808]/90 border border-white/15 px-4 py-1.5 text-[11px] font-mono text-cyan-400 select-none z-20 tracking-wider shadow-lg flex items-center gap-1.5 font-bold"
                >
                  (   Frames [{String(currentFrameIndex + 1).padStart(2, '0')}/{String(TOTAL_FRAMES).padStart(2, '0')}]   )
                </div>
              </div>
            ) : (
              // TAB 2: Dynamic 3D perspective spacetime chamber
              <div id="spacetime-3d-stage-wrapper" className="w-full h-full min-h-[420px]">
                <Viewport3D
                  frames={frames}
                  currentFrameIndex={currentFrameIndex}
                  totalFrames={TOTAL_FRAMES}
                  zSpacing={zSpacing}
                  onSetFrameIndex={handleSetFrameIndex}
                />
              </div>
            )}

            {/* EDITORIAL MASSIVE WATERMARK OVERLAY */}
            <div className="absolute bottom-6 left-6 text-left pointer-events-none select-none z-10 opacity-80">
              <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">Current Track</div>
              <h1 className="editorial-massive-text">MOTION<br />TRACK</h1>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 mt-1">
                Precision Rotoscope &bull; Keyframe Matrix
              </div>
            </div>
          </div>

          {/* PLAYBACK TIMELINE CONTROL BAR */}
          <div className="bg-[#0a0a0a] border border-white/10 p-4 flex flex-col md:flex-row items-center gap-4 text-left">
            {/* Playback Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const prevIdx = Math.max(0, currentFrameIndex - 1);
                  handleSetFrameIndex(prevIdx);
                }}
                disabled={currentFrameIndex === 0}
                className="p-2 border border-white/10 bg-black hover:bg-white/5 text-white/70 hover:text-white transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Frame"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2 border transition flex items-center justify-center w-10 h-10 cursor-pointer ${
                  isPlaying
                    ? 'bg-cyan-500 border-cyan-500 text-black font-bold'
                    : 'bg-white border-white text-black hover:bg-white/90'
                }`}
                title={isPlaying ? 'Pause Playback' : 'Play Sequence'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                onClick={() => {
                  const nextIdx = Math.min(TOTAL_FRAMES - 1, currentFrameIndex + 1);
                  handleSetFrameIndex(nextIdx);
                }}
                disabled={currentFrameIndex === TOTAL_FRAMES - 1}
                className="p-2 border border-white/10 bg-black hover:bg-white/5 text-white/70 hover:text-white transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                title="Next Frame"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Slider Track with Custom keyframe indicators */}
            <div className="flex-1 w-full flex flex-col gap-1.5">
              <div className="relative h-6 flex items-center bg-black/40 border border-white/5 px-2">
                {/* Tick Indicators background */}
                <div className="absolute inset-x-2 h-1 bg-white/10 pointer-events-none flex justify-between items-center">
                  {Array.from({ length: TOTAL_FRAMES }).map((_, i) => {
                    const hasStrokes = frames[i]?.strokes.length > 0;
                    return (
                      <span
                        key={i}
                        className={`w-[2px] h-2 -translate-y-[2px] transition-all ${
                          i === currentFrameIndex
                            ? 'bg-cyan-400 h-3.5 -translate-y-[3px]'
                            : hasStrokes
                            ? 'bg-pink-500 h-2.5 -translate-y-[2px]'
                            : 'bg-white/20'
                        }`}
                      />
                    );
                  })}
                </div>

                <input
                  type="range"
                  min={0}
                  max={TOTAL_FRAMES - 1}
                  value={currentFrameIndex}
                  onChange={(e) => handleSetFrameIndex(Number(e.target.value))}
                  className="w-full absolute inset-0 opacity-0 h-full cursor-pointer z-10"
                />

                {/* Progress bar overlay */}
                <div
                  className="h-1 bg-cyan-400 pointer-events-none absolute left-2"
                  style={{ width: `calc(${(currentFrameIndex / (TOTAL_FRAMES - 1)) * 100}% - 4px)` }}
                />
              </div>

              {/* Slider Sub-metrics */}
              <div className="flex justify-between items-center text-[9px] font-mono text-white/40 tracking-wider">
                <span>0.00s</span>
                <div className="flex gap-4">
                  {frames.map((f, i) => f.strokes.length > 0 && (
                    <span key={i} className="text-pink-400/80 font-bold">● KEYFRAME {i+1}</span>
                  )).filter(Boolean).slice(0, 3)}
                  {frames.filter(f => f.strokes.length > 0).length > 3 && (
                    <span>+{frames.filter(f => f.strokes.length > 0).length - 3} MORE</span>
                  )}
                </div>
                <span>3.00s</span>
              </div>
            </div>

            {/* Below right frame indicator showing how many frames are in the video */}
            <div className="text-right flex flex-col justify-center border-l border-white/10 pl-4 h-10 select-none">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest leading-none">Timeline Index</div>
              <div className="text-sm font-mono font-bold text-white mt-1 leading-none flex items-baseline gap-1">
                <span className="text-cyan-400">{String(currentFrameIndex + 1).padStart(2, '0')}</span>
                <span className="text-white/30 text-xs">/</span>
                <span>{String(TOTAL_FRAMES).padStart(2, '0')}</span>
                <span className="text-[10px] text-white/40 font-normal ml-1">({TOTAL_FRAMES} FRAMES)</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC SAMPLES PANEL LIBRARY */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-none p-6 flex flex-col gap-5 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-[0.25em] text-white">
                  Temporal Video Targets
                </h3>
                <p className="text-[10px] text-white/50 font-mono mt-1">
                  Select a performance sequence or drag/upload a custom source
                </p>
              </div>

              {/* Custom Desktop Upload Button */}
              <label className="bg-transparent hover:bg-white hover:text-black border border-white/25 py-2 px-4 text-xs font-mono font-medium text-white transition cursor-pointer flex items-center gap-2 rounded-none">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Video</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PRESET_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    setVideoUrl(sample.url);
                    setActiveSample(sample);
                    setIsPlaying(false);
                    setCurrentFrameIndex(0);
                    if (videoRef.current) {
                      videoRef.current.src = sample.url;
                      videoRef.current.currentTime = 0;
                    }
                    triggerToast(`Loaded: ${sample.name}`);
                  }}
                  className={`p-4 rounded-none border text-left transition ${
                    activeSample.id === sample.id
                      ? 'bg-white/5 border-white text-white shadow-lg'
                      : 'bg-[#111111]/40 border-white/5 text-white/60 hover:bg-[#111111] hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold tracking-wide truncate">{sample.name}</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 border border-white/10 bg-black text-white/50">
                      {sample.difficulty}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 font-sans line-clamp-2 leading-relaxed">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Studio Dashboard Sidebars (4/12 Columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ControlPanel
            currentFrameIndex={currentFrameIndex}
            totalFrames={TOTAL_FRAMES}
            isPlaying={isPlaying}
            onSetIsPlaying={setIsPlaying}
            onSetFrameIndex={handleSetFrameIndex}
            frames={frames}
            onUpdateFrameStrokes={handleUpdateFrameStrokes}
            selectedColor={selectedColor}
            onSetSelectedColor={setSelectedColor}
            selectedWidth={selectedWidth}
            onSetSelectedWidth={setSelectedWidth}
            selectedStyle={selectedStyle}
            onSetSelectedStyle={setSelectedStyle}
            selectedTool={selectedTool}
            onSetSelectedTool={handleSetSelectedTool}
            showOnionSkin={showOnionSkin}
            onSetShowOnionSkin={setShowOnionSkin}
            onionSkinRange={onionSkinRange}
            onSetOnionSkinRange={setOnionSkinRange}
            zSpacing={zSpacing}
            onSetZSpacing={setZSpacing}
            onClearFrame={handleClearCurrentFrame}
            onExportAnimation={handleExportAnimation}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onTrackMask={handleTrackMask}
            onInterpolateTimeline={handleInterpolateTimeline}
            pointEditMode={pointEditMode}
            onSetPointEditMode={setPointEditMode}
            selectedStrokeId={selectedStrokeId}
            onSetSelectedStrokeId={setSelectedStrokeId}
            onVideoUpload={handleVideoUpload}
          />

          <AIAssistant
            currentFrameIndex={currentFrameIndex}
            frames={frames}
            onUpdateFrameStrokes={handleUpdateFrameStrokes}
            videoRef={videoRef}
            selectedColor={selectedColor}
            selectedWidth={selectedWidth}
            selectedStyle={selectedStyle}
          />
        </div>
      </main>
    </div>
  );
}
