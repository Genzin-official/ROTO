/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { FrameData, Stroke, VideoSample, CognitiveMemory } from './types';
import RotoscopeCanvas from './components/RotoscopeCanvas';
import Viewport3D from './components/Viewport3D';
import ControlPanel from './components/ControlPanel';
import AIAssistant from './components/AIAssistant';
import { interpolateTimeline, EasingType } from './utils/interpolation';
// @ts-ignore
import gifshot from 'gifshot';
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
  Settings,
  Key,
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'drawing' | '3d'>('drawing');
  const [activeSample, setActiveSample] = useState<VideoSample>(PRESET_SAMPLES[0]);
  const [videoUrl, setVideoUrl] = useState<string>(PRESET_SAMPLES[0].url);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cancelExportRef = useRef(false);

  // Gemini API Key & Settings Modal States
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('ROTO3D_GEMINI_API_KEY') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [serverHasKey, setServerHasKey] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.geminiApiKeyConfigured) {
          setServerHasKey(true);
        }
      })
      .catch((e) => console.error('Error fetching API health:', e));
  }, []);

  // Frame sequencer data states with dynamic sequence support
  const [totalFrames, setTotalFrames] = useState(24);
  const [magicMaskMode, setMagicMaskMode] = useState<'add' | 'remove'>('add');
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frames, setFrames] = useState<FrameData[]>(() =>
    Array.from({ length: 24 }, (_, idx) => ({
      frameIndex: idx,
      timestamp: (idx / 24) * 3, // mock timestamps
      strokes: [],
    }))
  );

  // Automatically expand or shrink frames sequence while maintaining existing keyframe vectors
  useEffect(() => {
    setFrames((prev) => {
      if (prev.length === totalFrames) return prev;
      if (prev.length < totalFrames) {
        const next = [...prev];
        for (let idx = prev.length; idx < totalFrames; idx++) {
          next.push({
            frameIndex: idx,
            timestamp: (idx / totalFrames) * 3,
            strokes: [],
          });
        }
        return next;
      } else {
        return prev.slice(0, totalFrames);
      }
    });

    if (currentFrameIndex >= totalFrames) {
      setCurrentFrameIndex(totalFrames - 1);
    }
  }, [totalFrames]);

  // Brush styling states
  const [selectedColor, setSelectedColor] = useState('#00f0ff');
  const [selectedWidth, setSelectedWidth] = useState(2.5);
  const [selectedStyle, setSelectedStyle] = useState<Stroke['style']>('neon');
  const [selectedTool, setSelectedTool] = useState<'brush' | 'line' | 'polygon' | 'eraser' | 'point' | 'magic'>('brush');

  // AI Cognitive Mind / Self-Learning Memory Engine (retains across refreshes)
  const [cognitiveMemory, setCognitiveMemory] = useState<CognitiveMemory>(() => {
    try {
      const saved = localStorage.getItem('cognitive_rotoscope_memory');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      executionsCount: 0,
      lastAction: 'Neural link established',
      averagePointCount: 30,
      colorAffinity: '#00f0ff',
      styleAffinity: 'neon',
      precisionWeight: 0.5,
      densityPreference: 35,
      rulesLearned: [
        'Initialize vector anchor optimization',
        'Learn spatial 3D time depth projection',
      ],
    };
  });

  const registerExecution = (actionName: string, meta?: { pointsCount?: number; color?: string; style?: string }) => {
    setCognitiveMemory((prev) => {
      const newCount = prev.executionsCount + 1;
      let newRules = [...prev.rulesLearned];
      
      if (newCount === 1) {
        newRules.push('Learn click-to-isolate mask logic');
      }
      if (newCount === 3) {
        newRules.push('Calibrate professional boundary density ratios');
      }
      if (newCount === 5) {
        newRules.push('Maximize edge contour vector precision');
      }
      if (newCount === 8) {
        newRules.push('Activate custom 3D mesh time depth alignment');
      }
      if (actionName.toLowerCase().includes('magic') || actionName.toLowerCase().includes('ai')) {
        if (!newRules.includes('Optimize AI semantic background isolation')) {
          newRules.push('Optimize AI semantic background isolation');
        }
      }
      if (actionName.toLowerCase().includes('drag') || actionName.toLowerCase().includes('point') || actionName.toLowerCase().includes('modif')) {
        if (!newRules.includes('Refine manual point correction alignment')) {
          newRules.push('Refine manual point correction alignment');
        }
      }

      const nextColor = meta?.color || prev.colorAffinity;
      const nextStyle = meta?.style || prev.styleAffinity;
      
      let nextAvgPoints = prev.averagePointCount;
      if (meta?.pointsCount) {
        nextAvgPoints = Math.round((prev.averagePointCount * 4 + meta.pointsCount) / 5);
      }

      const nextPrecision = Math.min(0.99, parseFloat((0.5 + (newCount * 0.02)).toFixed(2)));

      const updated = {
        executionsCount: newCount,
        lastAction: actionName,
        averagePointCount: nextAvgPoints,
        colorAffinity: nextColor,
        styleAffinity: nextStyle,
        precisionWeight: nextPrecision,
        densityPreference: nextAvgPoints,
        rulesLearned: Array.from(new Set(newRules)),
      };

      localStorage.setItem('cognitive_rotoscope_memory', JSON.stringify(updated));
      return updated;
    });
  };

  // Point editing states
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [pointEditMode, setPointEditMode] = useState<'add' | 'remove'>('add');

  const handleSetSelectedTool = (tool: 'brush' | 'line' | 'polygon' | 'eraser' | 'point' | 'magic') => {
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
    registerExecution('Reverted Action (Undo)');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    const currentCopy = JSON.parse(JSON.stringify(frames));
    setUndoStack((prev) => [...prev, currentCopy]);

    setFrames(next);
    triggerToast('Redo successful');
    registerExecution('Re-applied Action (Redo)');
  };

  // Onion skin options
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [onionSkinRange, setOnionSkinRange] = useState(1);

  // 3D Spacing configuration
  const [zSpacing, setZSpacing] = useState(35);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Exporting MP4/GIF states
  const [exportStatus, setExportStatus] = useState<'idle' | 'rendering' | 'compiling' | 'success' | 'error'>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [exportTargetFormat, setExportTargetFormat] = useState<'mp4' | 'gif' | null>(null);

  // Sync status for branding panel
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving'>('synced');

  useEffect(() => {
    setSyncStatus('saving');
    const timer = setTimeout(() => {
      setSyncStatus('synced');
    }, 1000);
    return () => clearTimeout(timer);
  }, [frames, cognitiveMemory]);

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

  // Clean stale selection on frame change: make sure point editing remains focused on active frame
  useEffect(() => {
    if (selectedStrokeId) {
      const currentStrokes = frames.find((f) => f.frameIndex === currentFrameIndex)?.strokes || [];
      const exists = currentStrokes.some((s) => s.id === selectedStrokeId);
      if (!exists) {
        setSelectedStrokeId(null);
      }
    }
  }, [currentFrameIndex]);

  // Video time tracking sync (converts currentTime to frame index)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    const duration = video.duration || 1;
    const progress = video.currentTime / duration;
    // Cap to ensure frameIndex doesn't exceed total sequence limit
    const frameIdx = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));

    setCurrentFrameIndex(frameIdx);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      // Standard video framerate estimation (24 FPS) to fit frames precisely to video duration
      // e.g. 1.5s -> 36 frames, 2.25s -> 54 frames
      const calculatedFrames = Math.max(5, Math.min(100, Math.round(video.duration * 24)));
      setTotalFrames(calculatedFrames);
      
      if (currentFrameIndex >= calculatedFrames) {
        setCurrentFrameIndex(calculatedFrames - 1);
      }
    }
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
      video.currentTime = (idx / totalFrames) * video.duration;
    }
  };

  const handleUpdateFrameStrokes = (strokes: Stroke[]) => {
    pushToUndo(frames);
    setFrames((prev) =>
      prev.map((f) => (f.frameIndex === currentFrameIndex ? { ...f, strokes } : f))
    );

    // Register learning execution if strokes changed
    const currentFrame = frames.find((f) => f.frameIndex === currentFrameIndex);
    const prevStrokes = currentFrame ? currentFrame.strokes : [];
    if (strokes.length > prevStrokes.length) {
      const added = strokes[strokes.length - 1];
      const isAi = added.id.startsWith('ai-trace') || added.id.startsWith('magic-mask');
      const actionLabel = isAi 
        ? `Isolated vector contour with AI (${added.points.length} pts)` 
        : `Plotted manual keyframe path (${added.points.length} pts)`;
      registerExecution(actionLabel, {
        pointsCount: added.points.length,
        color: added.color,
        style: added.style,
      });
    } else if (strokes.length < prevStrokes.length) {
      registerExecution('Deleted/erased target mask vector');
    } else {
      registerExecution('Fine-tuned/dragged vertex points on mask', {
        color: selectedColor,
        style: selectedStyle,
      });
    }
  };

  const handleClearCurrentFrame = () => {
    pushToUndo(frames);
    setFrames((prev) =>
      prev.map((f) => (f.frameIndex === currentFrameIndex ? { ...f, strokes: [] } : f))
    );
    triggerToast('Current frame mask reset');
    registerExecution('Reset Current Frame Mask');
  };

  const handleResetAllMasks = () => {
    pushToUndo(frames);
    setFrames((prev) =>
      prev.map((f) => ({ ...f, strokes: [] }))
    );
    setSelectedStrokeId(null);
    triggerToast('All keyframe masks reset');
    registerExecution('Cleared all timeline masks');
  };

  const handleTrackMask = (direction: 'forward' | 'backward' | 'both') => {
    const currentStrokes = frames.find((f) => f.frameIndex === currentFrameIndex)?.strokes || [];
    if (currentStrokes.length === 0) {
      triggerToast('No masks on the current frame to track');
      return;
    }

    pushToUndo(frames);

    let nextSelectedId: string | null = null;
    let prevSelectedId: string | null = null;

    const cloneStrokes = (targetDirection: 'forward' | 'backward') => {
      return JSON.parse(JSON.stringify(currentStrokes)).map((stroke: Stroke) => {
        const newId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        if (stroke.id === selectedStrokeId) {
          if (targetDirection === 'forward') nextSelectedId = newId;
          if (targetDirection === 'backward') prevSelectedId = newId;
        }
        return {
          ...stroke,
          id: newId
        };
      });
    };

    setFrames((prev) => {
      return prev.map((f) => {
        if (direction === 'forward' && f.frameIndex === currentFrameIndex + 1) {
          return { ...f, strokes: cloneStrokes('forward') };
        }
        if (direction === 'backward' && f.frameIndex === currentFrameIndex - 1) {
          return { ...f, strokes: cloneStrokes('backward') };
        }
        if (direction === 'both') {
          if (f.frameIndex === currentFrameIndex + 1) {
            return { ...f, strokes: cloneStrokes('forward') };
          }
          if (f.frameIndex === currentFrameIndex - 1) {
            return { ...f, strokes: cloneStrokes('backward') };
          }
        }
        return f;
      });
    });

    registerExecution(`Tracked/interpolated mask ${direction} in timeline`);

    if (direction === 'forward') {
      const nextFrameIndex = currentFrameIndex + 1;
      if (nextFrameIndex < totalFrames) {
        handleSetFrameIndex(nextFrameIndex);
        if (nextSelectedId) {
          setSelectedStrokeId(nextSelectedId);
        }
        triggerToast('Mask tracked forward & advanced to next frame');
      } else {
        triggerToast('Mask tracked forward (already at last frame)');
      }
    } else if (direction === 'backward') {
      const prevFrameIndex = currentFrameIndex - 1;
      if (prevFrameIndex >= 0) {
        handleSetFrameIndex(prevFrameIndex);
        if (prevSelectedId) {
          setSelectedStrokeId(prevSelectedId);
        }
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
      framesCount: totalFrames,
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

  const drawStrokeOnExport = (
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    width: number,
    height: number,
    opacity: number = 1.0
  ) => {
    if (stroke.points.length === 0) return;

    const toPx = (p: { x: number; y: number }) => ({
      x: (p.x / 100) * width,
      y: (p.y / 100) * height,
    });

    ctx.save();
    ctx.beginPath();

    const start = toPx(stroke.points[0]);
    ctx.moveTo(start.x, start.y);

    for (let i = 1; i < stroke.points.length; i++) {
      const pt = toPx(stroke.points[i]);
      ctx.lineTo(pt.x, pt.y);
    }

    if (stroke.isClosed) {
      ctx.closePath();
    }

    const strokeColor = stroke.color;
    const glowColor = stroke.glowColor;

    ctx.lineWidth = stroke.width * (width / 640);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.style === 'dotted') {
      ctx.setLineDash([1, ctx.lineWidth * 2]);
    } else if (stroke.style === 'dashed') {
      ctx.setLineDash([12 * (width / 640), 6 * (width / 640)]);
    } else if (stroke.style === 'pulse') {
      ctx.lineWidth = stroke.width * 1.15 * (width / 640);
    }

    if (stroke.isClosed) {
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.globalAlpha = opacity * 0.28;
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = strokeColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = stroke.glowWidth * (width / 640);
    ctx.globalAlpha = opacity;

    ctx.stroke();

    if (stroke.style === 'neon' || stroke.style === 'laser' || stroke.style === 'pulse') {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, stroke.width * 0.3 * (width / 640));
      ctx.stroke();
    }

    ctx.restore();
  };

  const handleExportFormat = async (format: 'mp4' | 'gif') => {
    cancelExportRef.current = false;
    const video = videoRef.current;
    
    // 1. Initial State
    setExportStatus('rendering');
    setExportTargetFormat(format);
    setExportProgress(0);
    setExportMessage('Initializing Roto3D Cybernetic Render Engine...');
    setIsPlaying(false);

    // 2. Prepare canvas
    const exportCanvas = document.createElement('canvas');
    const exportWidth = video && video.videoWidth ? video.videoWidth : 1280;
    const exportHeight = video && video.videoHeight ? video.videoHeight : 720;
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      setExportStatus('error');
      setExportMessage('Failed to initialize 2D render context.');
      return;
    }

    // 3. Prepare MediaRecorder if MP4
    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: Blob[] = [];
    let mimeType = 'video/mp4';

    if (format === 'mp4') {
      const stream = exportCanvas.captureStream(10); // Capture stream at 10fps
      
      // Determine support
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };
        mediaRecorder.start();
      } catch (err: any) {
        setExportStatus('error');
        setExportMessage(`MediaRecorder initialization failed: ${err?.message || err}`);
        return;
      }
    }

    // 4. Determine delay per frame
    const duration = video ? video.duration : 4;
    const frameDelayMs = (duration / totalFrames) * 1000;
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const frameImages: string[] = [];

    // 5. Render Loop
    try {
      for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
        if (cancelExportRef.current) {
          throw new Error('Export cancelled by user.');
        }

        setExportProgress(Math.round((fIdx / totalFrames) * 90));
        setExportMessage(`Rendering Frame ${fIdx + 1} of ${totalFrames}...`);
        
        // Sync frame preview in main UI
        setCurrentFrameIndex(fIdx);

        // Seek video
        if (video) {
          const frameTime = (fIdx / totalFrames) * video.duration;
          video.currentTime = frameTime;
          
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }, 300); // 300ms max seek wait
          });
        }

        // Draw Frame
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, exportWidth, exportHeight);

        if (video) {
          try {
            ctx.drawImage(video, 0, 0, exportWidth, exportHeight);
          } catch (e) {
            console.warn("Failed to draw video frame during render", e);
          }
        }

        // Draw Strokes for this frame
        const currentFrame = frames[fIdx];
        if (currentFrame && currentFrame.strokes) {
          currentFrame.strokes.forEach((stroke) => {
            drawStrokeOnExport(ctx, stroke, exportWidth, exportHeight);
          });
        }

        // Add some premium Roto3D Cybernetic overlay metadata/HUD
        ctx.save();
        ctx.font = 'bold 16px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
        ctx.fillText(`ROTO3D DIGITAL RENDER ENGINE // FRAME ${String(fIdx + 1).padStart(2, '0')}`, 24, 40);
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(`SEQUENCE KEY: ROTO3D_CYBER_SEQ | TIMECODE: ${(fIdx * (video ? video.duration : 4) / totalFrames).toFixed(2)}s / ${duration.toFixed(2)}s`, 24, 60);
        
        // Add watermarks/aesthetic branding
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.fillText('POWERED BY ROTO3D STUDIO // SELF-LEARNING AI ACTIVE', 24, exportHeight - 24);
        ctx.restore();

        // Save frame for GIF
        if (format === 'gif') {
          const frameDataUrl = exportCanvas.toDataURL('image/jpeg', 0.82); // 82% quality JPEG is perfect
          frameImages.push(frameDataUrl);
        }

        // Delay so MediaRecorder captures with proper clock intervals
        await delay(frameDelayMs);
      }

      // Add one more delay tick for the final frame
      await delay(frameDelayMs);

      // Check cancellation again
      if (cancelExportRef.current) {
        throw new Error('Export cancelled by user.');
      }

      setExportStatus('compiling');
      setExportProgress(95);

      if (format === 'mp4' && mediaRecorder) {
        setExportMessage('Compiling final MP4/WebM video stream container...');
        mediaRecorder.stop();
        
        await new Promise<void>((resolve) => {
          mediaRecorder!.onstop = () => {
            resolve();
          };
        });

        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `roto3d-render-sequence-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportProgress(100);
        setExportStatus('success');
        setExportMessage(`Successfully exported animation sequence as ${ext.toUpperCase()} video file!`);
        registerExecution(`Rendered entire timeline as high-precision ${ext.toUpperCase()} video`);
      } else {
        setExportMessage('Synthesizing frames into optimized looping GIF...');
        
        gifshot.createGIF({
          images: frameImages,
          gifWidth: exportWidth > 640 ? 640 : exportWidth,
          gifHeight: exportHeight > 360 ? 360 : exportHeight,
          interval: frameDelayMs / 1000,
          numFrames: totalFrames,
        }, (obj) => {
          if (cancelExportRef.current) {
            setExportStatus('idle');
            return;
          }
          if (!obj.error) {
            const url = obj.image;
            const a = document.createElement('a');
            a.href = url;
            a.download = `roto3d-render-sequence-${Date.now()}.gif`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setExportProgress(100);
            setExportStatus('success');
            setExportMessage('Successfully compiled and downloaded animated GIF!');
            registerExecution('Synthesized and exported looping animated GIF');
          } else {
            setExportStatus('error');
            setExportMessage(`GIF compilation failed: ${obj.errorMsg}`);
          }
        });
      }

    } catch (err: any) {
      if (err?.message === 'Export cancelled by user.') {
        setExportStatus('idle');
        triggerToast('Export cancelled');
      } else {
        setExportStatus('error');
        setExportMessage(`Export failed: ${err?.message || err}`);
      }
    }
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

      {/* DIGITAL RENDER ENGINE EXPORT MODAL */}
      {exportStatus !== 'idle' && (
        <div id="render-export-overlay" className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/10 p-6 flex flex-col gap-6 text-left shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-pink-500 to-indigo-500" />
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-none border border-cyan-500/20 bg-cyan-950/20 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-extrabold tracking-[0.2em] text-white">
                    Roto3D Digital Render Engine
                  </h3>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-white/40 mt-0.5">
                    Target Format: {exportTargetFormat?.toUpperCase()}
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 border border-cyan-500/20 uppercase font-bold tracking-widest animate-pulse">
                {exportStatus}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {/* Progress bar and percentages */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">{exportMessage}</span>
                  <span className="text-white font-bold">{exportProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 border border-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>

              {/* Technical Telemetry Details */}
              <div className="bg-black border border-white/5 p-4 font-mono text-[9px] text-white/50 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="uppercase text-white/30">Frame Dimension</span>
                  <span className="text-white font-semibold">
                    {videoRef.current?.videoWidth || 1280} x {videoRef.current?.videoHeight || 720} px
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1.5">
                  <span className="uppercase text-white/30">Target Rate</span>
                  <span className="text-white font-semibold">
                    {(totalFrames / (videoRef.current ? videoRef.current.duration : 4)).toFixed(1)} FPS
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1.5">
                  <span className="uppercase text-white/30">Drawn Paths</span>
                  <span className="text-white font-semibold">
                    {frames.reduce((acc, f) => acc + f.strokes.length, 0)} total vector paths
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              {exportStatus === 'success' ? (
                <button
                  onClick={() => setExportStatus('idle')}
                  className="bg-white hover:bg-white/90 text-black border border-white text-[10px] font-mono font-bold tracking-widest px-6 py-2.5 uppercase transition cursor-pointer"
                >
                  Dismiss Render
                </button>
              ) : exportStatus === 'error' ? (
                <button
                  onClick={() => setExportStatus('idle')}
                  className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-mono font-bold tracking-widest px-6 py-2.5 uppercase transition cursor-pointer"
                >
                  Close & Retry
                </button>
              ) : (
                <button
                  onClick={() => {
                    cancelExportRef.current = true;
                    setExportStatus('idle');
                  }}
                  className="border border-white/20 hover:border-white/40 hover:bg-white/5 text-white/70 hover:text-white text-[10px] font-mono font-bold tracking-widest px-6 py-2.5 uppercase transition cursor-pointer"
                >
                  Cancel Render
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION (EDITORIAL THEME: Minimalist, tracked spacing, crisp fine borders) */}
      <header id="app-header-nav" className="border-b border-white/10 bg-[#080808] sticky top-0 z-40 px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between gap-4">
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
        <div className="flex items-center gap-4 sm:gap-6 text-[10px] font-mono text-white/60">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-white/40">Sequence:</span>
            <span className="text-white uppercase font-bold tracking-wider">NEON_CITY_EXT_{String(currentFrameIndex + 400).padStart(4, '0')}</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-white/40">Interpolation:</span>
            <span className="text-white font-semibold">Bezier / Sub-pixel</span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 bg-white/5 hover:bg-white/10 text-white hover:border-white transition cursor-pointer active:scale-95 select-none"
            title="System Settings"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase font-bold tracking-wider text-[9px]">Settings</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER LAYOUT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* LEFT COLUMN: Stage Display & Preset library (8/12 Columns) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
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
          <div className="w-full aspect-video bg-[#0c0c0c] border border-white/10 rounded-none relative overflow-hidden flex items-center justify-center p-0 group shadow-2xl">
            
            {/* Viewport Frame Background GRID Accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* TAB 1: 2D drawing canvas layered over active looping video */}
            {activeTab === 'drawing' ? (
              <div id="video-canvas-stage-wrapper" className="relative w-full h-full aspect-video rounded-none overflow-hidden bg-black flex items-center justify-center">
                
                 {/* Embedded HTML5 Core Player */}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
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
                  cognitiveMemory={cognitiveMemory}
                  magicMaskMode={magicMaskMode}
                  geminiApiKey={geminiApiKey}
                />

                {/* 2D Mode overlay label HUD */}
                <div className="absolute top-4 left-4 bg-[#080808]/95 border border-white/20 px-3 py-1 text-[9px] font-mono text-white select-none pointer-events-none flex items-center gap-1.5 shadow-md z-20">
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                  <span>FRAME 0{currentFrameIndex + 424}</span>
                </div>

                {/* Timeline frame index indicator overlay on top right */}
                <div className="absolute top-4 right-4 bg-[#080808]/95 border border-white/20 px-3 py-1 text-[9px] font-mono text-cyan-400 select-none pointer-events-none flex items-center gap-1.5 shadow-md font-bold z-20">
                  <span>Frames [{String(currentFrameIndex + 1).padStart(2, '0')}/{String(totalFrames).padStart(2, '0')}]</span>
                </div>
              </div>
            ) : (
              // TAB 2: Dynamic 3D perspective spacetime chamber
              <div id="spacetime-3d-stage-wrapper" className="w-full h-full aspect-video min-h-0">
                <Viewport3D
                  frames={frames}
                  currentFrameIndex={currentFrameIndex}
                  totalFrames={totalFrames}
                  zSpacing={zSpacing}
                  onSetFrameIndex={handleSetFrameIndex}
                />
              </div>
            )}

          </div>

          {/* EDITORIAL MASSIVE WATERMARK UNDER THE CANVAS */}
          <div className="bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.05] hover:border-white/10 p-4 transition-all duration-300 group/brand cursor-pointer select-none text-left relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40 group-hover/brand:text-white/60 transition-colors duration-300">Current Track</div>
                <h1 className="editorial-massive-text group-hover/brand:text-white/95 transition-colors duration-300">MOTION<br />TRACK</h1>
              </div>
              
              {/* Sync Status Badge */}
              <div className="self-start flex items-center gap-2 px-2.5 py-1 border border-white/5 bg-[#080808]/80 text-[9px] font-mono tracking-wider transition-all duration-300">
                <span className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  syncStatus === 'saving' 
                    ? 'bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]' 
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                }`} />
                <span className={syncStatus === 'saving' ? 'text-yellow-400 font-bold' : 'text-emerald-400 font-medium'}>
                  {syncStatus === 'saving' ? 'SYNCING MATRIX...' : 'NEURAL LINK SECURED'}
                </span>
              </div>
            </div>
            
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 mt-3 group-hover/brand:text-white/60 transition-colors duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Precision Rotoscope &bull; Keyframe Matrix</span>
              <span className="text-[9px] text-white/20 uppercase tracking-widest group-hover/brand:text-white/40 transition-colors duration-300 font-sans">
                {cognitiveMemory.lastAction ? `Last action: ${cognitiveMemory.lastAction}` : 'Status: Optimal'}
              </span>
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
                  const nextIdx = Math.min(totalFrames - 1, currentFrameIndex + 1);
                  handleSetFrameIndex(nextIdx);
                }}
                disabled={currentFrameIndex === totalFrames - 1}
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
                  {Array.from({ length: totalFrames }).map((_, i) => {
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
                  max={totalFrames - 1}
                  value={currentFrameIndex}
                  onChange={(e) => handleSetFrameIndex(Number(e.target.value))}
                  className="w-full absolute inset-0 opacity-0 h-full cursor-pointer z-10"
                />

                {/* Progress bar overlay */}
                <div
                  className="h-1 bg-cyan-400 pointer-events-none absolute left-2"
                  style={{ width: `calc(${(currentFrameIndex / (totalFrames - 1)) * 100}% - 4px)` }}
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
            <div className="text-left md:text-right flex flex-col justify-center border-t border-t-white/5 md:border-t-0 md:border-l md:border-white/10 pt-3 md:pt-0 md:pl-4 h-auto md:h-10 select-none w-full md:w-auto">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest leading-none">Timeline Index</div>
              <div className="text-sm font-mono font-bold text-white mt-1 leading-none flex items-baseline gap-1">
                <span className="text-cyan-400">{String(currentFrameIndex + 1).padStart(2, '0')}</span>
                <span className="text-white/30 text-xs">/</span>
                <span>{String(totalFrames).padStart(2, '0')}</span>
                <span className="text-[10px] text-white/40 font-normal ml-1">({totalFrames} FRAMES)</span>
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
            totalFrames={totalFrames}
            onSetTotalFrames={setTotalFrames}
            magicMaskMode={magicMaskMode}
            onSetMagicMaskMode={setMagicMaskMode}
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
            onResetAllMasks={handleResetAllMasks}
            onExportAnimation={handleExportAnimation}
            onExportFormat={handleExportFormat}
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
            cognitiveMemory={cognitiveMemory}
            geminiApiKey={geminiApiKey}
          />
        </div>
      </main>

      {/* SETTINGS DIALOG MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/15 w-full max-w-md p-6 relative flex flex-col gap-6 shadow-2xl select-none">
            
            {/* Modal Title */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-extrabold uppercase tracking-[0.25em] text-white">
                  System Configuration
                </span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-white/40 hover:text-white transition font-mono text-[10px] uppercase tracking-wider cursor-pointer select-none active:scale-95"
              >
                [CLOSE]
              </button>
            </div>

            {/* Status Section */}
            <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-3 font-mono text-[9px] uppercase tracking-wider">
              <span className="text-white/40">Auth Credentials Status</span>
              <div className="flex items-center gap-2">
                {geminiApiKey ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
                    <span className="text-cyan-400 font-bold">USER_KEY ACTIVE</span>
                  </>
                ) : serverHasKey ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                    <span className="text-green-500 font-bold">SERVER_KEY ACTIVE</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                    <span className="text-amber-500 font-bold">KEY MISSING</span>
                  </>
                )}
              </div>
            </div>

            {/* Input Form Section */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-widest text-white/50">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-white/50" />
                  Gemini API Key
                </span>
                <span className="text-[8px] text-white/30">(Saved locally in browser)</span>
              </div>
              
              <div className="relative">
                <input
                  type="password"
                  placeholder={serverHasKey ? "••••••••••••••••••••••••••••••••" : "Enter your custom Gemini API key..."}
                  value={geminiApiKey}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setGeminiApiKey(val);
                    if (val) {
                      localStorage.setItem('ROTO3D_GEMINI_API_KEY', val);
                    } else {
                      localStorage.removeItem('ROTO3D_GEMINI_API_KEY');
                    }
                  }}
                  className="w-full bg-black border border-white/20 focus:border-cyan-400 focus:outline-none px-3 py-2.5 text-xs font-mono text-white tracking-widest transition-all"
                />
              </div>

              <p className="text-[9px] font-mono text-white/35 leading-relaxed">
                If configured, calculations like the AI Auto-Trace, Magic Mask Cutouts, and Scene Advices are authorized directly using your private API key. If left blank, it falls back to the default server-side configuration.
              </p>
            </div>

            {/* Save Buttons & Actions */}
            <div className="flex gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  triggerToast("System settings synced successfully");
                }}
                className="flex-1 bg-white hover:bg-white/90 text-black border border-white font-mono text-[10px] font-bold tracking-widest py-2.5 uppercase transition cursor-pointer select-none text-center active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
