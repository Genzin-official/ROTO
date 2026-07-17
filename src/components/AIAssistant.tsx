/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Stroke, FrameData, CognitiveMemory } from '../types';
import { extractContoursFromSource } from '../utils/edgeDetector';
import { Sparkles, Brain, Code, AlertTriangle, Cpu, HelpCircle, Terminal } from 'lucide-react';

interface AIAssistantProps {
  currentFrameIndex: number;
  frames: FrameData[];
  onUpdateFrameStrokes: (strokes: Stroke[]) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  selectedColor: string;
  selectedWidth: number;
  selectedStyle: Stroke['style'];
  cognitiveMemory?: CognitiveMemory;
}

export default function AIAssistant({
  currentFrameIndex,
  frames,
  onUpdateFrameStrokes,
  videoRef,
  selectedColor,
  selectedWidth,
  selectedStyle,
  cognitiveMemory,
}: AIAssistantProps) {
  const [logs, setLogs] = useState<string[]>([
    'SYSTEM: Roto3D Assistant Core initialized.',
    'STATUS: Waiting for frame sequence...',
  ]);
  const [isBusy, setIsBusy] = useState(false);
  const [adviceText, setAdviceText] = useState<string>('');

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-12), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Helper to capture active frame image from the playing/paused HTML5 Video
  const captureFrameBase64 = (): string | null => {
    const video = videoRef.current;
    if (!video) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw active frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Frame capture failed due to CORS or element loading:', e);
      return null;
    }
  };

  // 1. AI Rotoscope Auto-Trace Loop (Calls Express backend, falls back to local Sobel)
  const triggerAutoTrace = async () => {
    const video = videoRef.current;
    if (!video) {
      addLog('ERROR: Video playback engine not loaded.');
      return;
    }

    const frameImg = captureFrameBase64();
    if (!frameImg) {
      addLog('ERROR: Could not capture active video buffer.');
      return;
    }

    setIsBusy(true);
    addLog('AI Scribe: Initializing frame visual buffer...');

    // Small delay for cinematic hacker logs feel
    await new Promise((r) => setTimeout(r, 600));
    addLog('AI Scribe: Launching Gemini 3.5 Contour Scribe...');

    try {
      const response = await fetch('/api/auto-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: frameImg, cognitiveMemory }),
      });

      if (!response.ok) {
        throw new Error('Backend failed or API key unconfigured');
      }

      const data = await response.json();
      if (data.points && Array.isArray(data.points) && data.points.length > 0) {
        addLog(`SUCCESS: Gemini traced ${data.points.length} coordinates.`);

        const newStroke: Stroke = {
          id: `ai-trace-${Date.now()}`,
          points: data.points,
          color: selectedColor,
          width: selectedWidth,
          glowColor: selectedColor + 'aa',
          glowWidth: selectedWidth * 3.5,
          isClosed: true,
          style: selectedStyle,
        };

        const currentFrame = frames.find((f) => f.frameIndex === currentFrameIndex);
        const existing = currentFrame ? currentFrame.strokes : [];
        onUpdateFrameStrokes([...existing, newStroke]);
      } else {
        throw new Error('Zero contour coordinates returned.');
      }
    } catch (err) {
      addLog('NOTICE: Gemini key unavailable or query offline.');
      addLog('LOCAL BACKUP: Activating low-latency Sobel Edge Engine...');

      await new Promise((r) => setTimeout(r, 450));

      // Use client-side fallback
      const localStrokes = extractContoursFromSource(video, 40, 150);
      if (localStrokes.length > 0) {
        // Map local strokes to currently selected color/style
        const formattedStrokes = localStrokes.map((s) => ({
          ...s,
          color: selectedColor,
          width: selectedWidth,
          glowColor: selectedColor + '99',
          glowWidth: selectedWidth * 3.5,
          style: selectedStyle,
        }));

        const currentFrame = frames.find((f) => f.frameIndex === currentFrameIndex);
        const existing = currentFrame ? currentFrame.strokes : [];
        onUpdateFrameStrokes([...existing, ...formattedStrokes]);

        addLog(`SUCCESS: Sobel Engine traced ${formattedStrokes.length} boundary contours.`);
      } else {
        addLog('ERROR: Could not extract edges. Try adjusting video light/contrast.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  // 2. Gemini Artistic Director (Fetches textual advice about tracing strategy)
  const triggerArtDirector = async () => {
    const video = videoRef.current;
    if (!video) return;

    const frameImg = captureFrameBase64();
    if (!frameImg) {
      addLog('ERROR: Advice capture buffer failed.');
      return;
    }

    setIsBusy(true);
    addLog('DIRECTOR: Scanning scene composition...');
    setAdviceText('');

    try {
      const response = await fetch('/api/describe-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: frameImg }),
      });

      if (!response.ok) {
        throw new Error('Backend unconfigured');
      }

      const data = await response.json();
      if (data.advice) {
        setAdviceText(data.advice);
        addLog('SUCCESS: Scene advice compiled.');
      } else {
        throw new Error('Empty advice');
      }
    } catch (err) {
      addLog('NOTICE: Key not configured. Loading default director presets...');
      await new Promise((r) => setTimeout(r, 600));

      // High-quality local generic dynamic recommendations
      const localAdvice = [
        '✦ Recommended path of action: Trace the sweeping motion of the primary subject to lock in velocity.',
        '✦ Highlighting details: Rotoscope the bright outer highlights (rim lighting) to yield an aesthetic cyberpunk glow.',
        '✦ Timing spacing: Maintain 3D time Z-spacing of 30-40px to prevent motion compression.',
      ];
      setAdviceText(localAdvice.join('\n\n'));
      addLog('SUCCESS: Presets loaded.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div id="ai-assistant-panel" className="bg-[#0a0a0a] border border-white/10 rounded-none p-6 flex flex-col gap-6 h-full relative overflow-hidden shadow-2xl">
      {/* Visual cyber mesh background */}
      <div className="absolute inset-0 bg-radial-gradient from-white/5 via-transparent to-transparent opacity-40 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3.5 relative">
        <div className="p-2 bg-white/5 border border-white/10 rounded-none">
          <Brain className="w-5 h-5 text-white/80 animate-pulse" />
        </div>
        <div>
          <h3 className="text-xs font-mono font-bold tracking-[0.25em] text-white">
            AI COGNITIVE SUITE
          </h3>
          <p className="text-[9px] font-mono uppercase tracking-widest text-white/40">Model: Gemini 3.5 Core</p>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 gap-3 relative z-10">
        <button
          onClick={triggerAutoTrace}
          disabled={isBusy}
          className="relative group w-full bg-white hover:bg-white/95 text-black font-mono text-[11px] font-bold tracking-[0.2em] py-3.5 px-4 rounded-none flex items-center justify-center gap-2 border border-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className={`w-4 h-4 ${isBusy ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
          <span>{isBusy ? 'COMPUTING OUTLINES...' : 'AI SCRIBE: AUTO-TRACE'}</span>
        </button>

        <button
          onClick={triggerArtDirector}
          disabled={isBusy}
          className="w-full bg-[#111] hover:bg-white hover:text-black text-white/80 font-mono text-[11px] font-bold tracking-[0.15em] py-3 px-4 border border-white/10 hover:border-white rounded-none transition disabled:opacity-50"
        >
          <Cpu className="w-4 h-4" />
          <span>AI DIRECTOR ADVICE</span>
        </button>
      </div>

      {/* Hologram Director Advice Panel */}
      {(adviceText || isBusy) && (
        <div id="director-advice-box" className="p-4 bg-white/5 border border-white/10 rounded-none flex flex-col gap-2.5 backdrop-blur-sm">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-1.5 border-b border-white/10 pb-1.5">
            <Terminal className="w-3.5 h-3.5" />
            DIRECTOR COMMENTS
          </span>
          {isBusy && !adviceText ? (
            <div className="flex items-center gap-2 py-3 text-xs text-white/40 font-mono">
              <span className="w-1.5 h-3 bg-white animate-pulse inline-block" />
              <span>Analyzing motion vectors...</span>
            </div>
          ) : (
            <div className="text-xs text-white/80 font-sans leading-relaxed whitespace-pre-line text-left">
              {adviceText}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Learning weight metrics */}
      {cognitiveMemory && (
        <div id="ai-learning-metrics-widget" className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-none text-left flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-cyan-400/5 to-transparent pointer-events-none rounded-full blur-md group-hover:scale-125 transition-transform" />
          
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-1 flex-wrap gap-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-cyan-400 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              Adaptive Neural Weights
            </span>
            <span className="text-[7px] font-mono bg-cyan-500/10 text-cyan-400 px-1 py-0.5 border border-cyan-500/20 uppercase font-bold tracking-wider animate-pulse">
              Self-Learning Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[9px] text-white/50">
            <div className="flex flex-col gap-0.5">
              <span className="uppercase tracking-widest text-white/30 text-[7px]">Executions</span>
              <span className="text-white font-bold text-[11px]">{cognitiveMemory.executionsCount} trials</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="uppercase tracking-widest text-white/30 text-[7px]">Confidence Weight</span>
              <span className="text-cyan-400 font-bold text-[11px]">{(cognitiveMemory.precisionWeight * 100).toFixed(0)}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="uppercase tracking-widest text-white/30 text-[7px]">Avg Density</span>
              <span className="text-white font-bold text-[11px]">{cognitiveMemory.averagePointCount} points</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="uppercase tracking-widest text-white/30 text-[7px]">Style Match</span>
              <span className="text-pink-400 font-bold uppercase text-[10px]">{cognitiveMemory.styleAffinity}</span>
            </div>
          </div>

          <div className="text-[9px] bg-black/40 border border-white/5 p-1 flex flex-col gap-0.5">
            <span className="text-white/40 uppercase tracking-[0.1em] text-[7px]">Last Logged Telemetry:</span>
            <span className="text-white/80 font-mono italic truncate">"{cognitiveMemory.lastAction}"</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[7px] uppercase text-white/30 tracking-widest">Learned System Heuristics:</span>
            <div className="flex flex-wrap gap-1 max-h-[44px] overflow-y-auto scrollbar-thin">
              {cognitiveMemory.rulesLearned.slice(-3).map((rule, idx) => (
                <span key={idx} className="bg-white/5 border border-white/10 text-white/70 text-[8px] px-1 py-0.5 rounded-none font-mono">
                  ✓ {rule}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Neural Link Terminal Log Console */}
      <div id="neural-log-console" className="flex-1 flex flex-col min-h-[140px] bg-black border border-white/10 rounded-none p-4 font-mono text-[10px] relative overflow-hidden select-text text-left">
        <div className="text-[9px] uppercase tracking-[0.15em] text-white/40 border-b border-white/5 pb-2 mb-2 flex justify-between">
          <span>Neural Link Logs</span>
          <span className="text-white/60">● system idle</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 select-text">
          {logs.map((log, index) => {
            let textColor = 'text-white/40';
            if (log.includes('SUCCESS:')) textColor = 'text-white font-bold';
            if (log.includes('ERROR:')) textColor = 'text-red-400 font-bold';
            if (log.includes('LOCAL:')) textColor = 'text-white/60';
            if (log.includes('AI Scribe:') || log.includes('DIRECTOR:')) textColor = 'text-white/80';

            return (
              <div key={index} className={`leading-relaxed break-words ${textColor}`}>
                {log}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
