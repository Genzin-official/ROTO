/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Stroke, Point, FrameData, CognitiveMemory } from '../types';
import { Sparkles, Trash2, Edit2, RotateCcw } from 'lucide-react';
import { clientMagicMask } from '../utils/geminiClient';

interface RotoscopeCanvasProps {
  currentFrameIndex: number;
  frames: FrameData[];
  onUpdateFrameStrokes: (strokes: Stroke[]) => void;
  selectedColor: string;
  selectedWidth: number;
  selectedStyle: Stroke['style'];
  selectedTool: 'brush' | 'line' | 'polygon' | 'eraser' | 'point' | 'magic';
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showOnionSkin: boolean;
  onionSkinRange: number;
  selectedStrokeId: string | null;
  onSetSelectedStrokeId: (id: string | null) => void;
  pointEditMode: 'add' | 'remove';
  cognitiveMemory?: CognitiveMemory;
  magicMaskMode?: 'add' | 'remove';
  geminiApiKey?: string;
}

export default function RotoscopeCanvas({
  currentFrameIndex,
  frames,
  onUpdateFrameStrokes,
  selectedColor,
  selectedWidth,
  selectedStyle,
  selectedTool,
  videoRef,
  showOnionSkin,
  onionSkinRange,
  selectedStrokeId,
  onSetSelectedStrokeId,
  pointEditMode,
  cognitiveMemory,
  magicMaskMode = 'add',
  geminiApiKey,
}: RotoscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePoints, setActivePoints] = useState<Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number>(-1);
  const [tempStrokePoints, setTempStrokePoints] = useState<Point[] | null>(null);

  // Get active frame's strokes
  const currentFrame = frames.find((f) => f.frameIndex === currentFrameIndex);
  const strokes = currentFrame ? currentFrame.strokes : [];

  useEffect(() => {
    setTempStrokePoints(null);
    setDraggedNodeIndex(-1);
  }, [selectedStrokeId, currentFrameIndex]);

  // Magic masking states
  const [isMagicMasking, setIsMagicMasking] = useState(false);
  const [magicFeedback, setMagicFeedback] = useState<{ x: number; y: number } | null>(null);

  // Helper to capture the current active frame from the HTML5 video player
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

  // Trigger server-side AI Magic Mask background removing / object segmentation
  const triggerMagicMask = async (clickX?: number, clickY?: number) => {
    const video = videoRef.current;
    if (!video) {
      alert("Video playback engine is not loaded.");
      return;
    }

    const frameImg = captureFrameBase64();
    if (!frameImg) {
      alert("Could not capture the current frame buffer. Verify the video source.");
      return;
    }

    setIsMagicMasking(true);
    if (clickX !== undefined && clickY !== undefined) {
      setMagicFeedback({ x: clickX, y: clickY });
    } else {
      setMagicFeedback({ x: 50, y: 50 }); // Center for auto subject cutout
    }

    try {
      let points: Array<{ x: number; y: number }> = [];

      if (geminiApiKey) {
        // Run completely client-side in browser using direct Google REST API!
        const result = await clientMagicMask(
          geminiApiKey,
          frameImg,
          clickX,
          clickY,
          clickX !== undefined ? 'click' : 'subject',
          cognitiveMemory
        );
        points = result.points;
      } else {
        // Fallback to server proxy
        const response = await fetch('/api/magic-mask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: frameImg,
            clickX,
            clickY,
            mode: clickX !== undefined ? 'click' : 'subject',
            cognitiveMemory,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || `API server returned status ${response.status}`);
        }

        const data = await response.json();
        points = data.points;
      }

      if (points && Array.isArray(points) && points.length > 0) {
        const isRemove = magicMaskMode === 'remove';
        const newStroke: Stroke = {
          id: `magic-mask-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          points: points,
          color: isRemove ? '#ff3b30' : selectedColor,
          width: selectedWidth,
          glowColor: isRemove ? 'rgba(239, 68, 68, 0.45)' : selectedColor + 'aa',
          glowWidth: selectedWidth * 3.5,
          isClosed: true,
          style: selectedStyle,
          blendMode: magicMaskMode === 'remove' ? 'subtract' : 'add',
        };

        onUpdateFrameStrokes([...strokes, newStroke]);
        onSetSelectedStrokeId(newStroke.id);
      } else {
        throw new Error('AI returned empty or invalid coordinate points.');
      }
    } catch (err: any) {
      console.error('AI Magic Mask failed:', err);
      alert(`AI Magic Mask failed: ${err.message || 'Unknown error'}. Ensure GEMINI_API_KEY is configured in Settings > Secrets.`);
    } finally {
      setIsMagicMasking(false);
      setMagicFeedback(null);
    }
  };

  // Listen to background removal (auto-subject mask) events from ControlPanel
  useEffect(() => {
    const handleAutoSubjectMask = () => {
      triggerMagicMask();
    };
    window.addEventListener('trigger-magic-subject-mask', handleAutoSubjectMask);
    return () => {
      window.removeEventListener('trigger-magic-subject-mask', handleAutoSubjectMask);
    };
  }, [currentFrameIndex, strokes, selectedColor, selectedWidth, selectedStyle]);

  // Observe container size to match the video dimensions perfectly
  useEffect(() => {
    if (!containerRef.current || !videoRef.current) return;

    const updateSize = () => {
      const video = videoRef.current;
      if (!video) return;

      // Fit canvas to video display dimensions
      const rect = video.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', updateSize);
      video.addEventListener('play', updateSize);
      video.addEventListener('pause', updateSize);
      video.addEventListener('timeupdate', updateSize);
      resizeObserver.observe(containerRef.current);
    }

    updateSize();

    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', updateSize);
        video.removeEventListener('play', updateSize);
        video.removeEventListener('pause', updateSize);
        video.removeEventListener('timeupdate', updateSize);
      }
      resizeObserver.disconnect();
    };
  }, [videoRef, containerRef]);

  // Handle drawing rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Helper to convert normalized coordinate to canvas pixel coordinate
    const toPx = (p: Point) => ({
      x: (p.x / 100) * canvasSize.width,
      y: (p.y / 100) * canvasSize.height,
    });

    // Helper to draw a stroke
    const drawStroke = (stroke: Stroke, opacity: number = 1.0, isPrevious: boolean = false, isNext: boolean = false) => {
      if (stroke.points.length === 0) return;

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

      // Configure style
      let strokeColor = stroke.color;
      let glowColor = stroke.glowColor;

      // Adjust for onion skinning colors
      if (isPrevious) {
        strokeColor = 'rgba(239, 68, 68, 0.4)'; // Dim red
        glowColor = 'rgba(239, 68, 68, 0.15)';
      } else if (isNext) {
        strokeColor = 'rgba(34, 197, 94, 0.4)'; // Dim green
        glowColor = 'rgba(34, 197, 94, 0.15)';
      }

      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Apply line dash or dot styling
      if (stroke.blendMode === 'subtract') {
        ctx.setLineDash([6, 4]);
      } else if (stroke.style === 'dotted') {
        ctx.setLineDash([1, stroke.width * 2]);
      } else if (stroke.style === 'dashed') {
        ctx.setLineDash([12, 6]);
      } else if (stroke.style === 'pulse') {
        // Create an organic glowing look by pulsating linewidth
        const pulse = 1 + 0.25 * Math.sin(Date.now() / 150);
        ctx.lineWidth = stroke.width * pulse;
      }

      // If the path is closed (e.g., polygon vector mask), fill the shape like a high-end mask overlay in Photopea
      if (stroke.isClosed) {
        ctx.save();
        ctx.fillStyle = stroke.blendMode === 'subtract' ? 'rgba(239, 68, 68, 0.45)' : strokeColor;
        ctx.globalAlpha = opacity * (stroke.blendMode === 'subtract' ? 0.35 : 0.28); // semi-transparent mask color
        ctx.shadowBlur = 0; // turn off shadow blur for the inner fill
        ctx.fill();
        ctx.restore();
      }

      // Neon glowing drop-shadow drawing technique
      ctx.strokeStyle = strokeColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = stroke.glowWidth;
      ctx.globalAlpha = opacity;

      // Draw shadow + line
      ctx.stroke();

      // Draw secondary bright inner core for absolute 3D neon look
      if (stroke.style === 'neon' || stroke.style === 'laser' || stroke.style === 'pulse') {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, stroke.width * 0.3);
        ctx.stroke();
      }

      ctx.restore();
    };

    // 1. Draw Onion Skins (Previous and Next frames)
    if (showOnionSkin) {
      for (let step = 1; step <= onionSkinRange; step++) {
        const prevFrameIndex = currentFrameIndex - step;
        const nextFrameIndex = currentFrameIndex + step;
        const opacity = Math.max(0.1, 0.4 - step * 0.15);

        // Previous Onion Skin (Red shade)
        const prevFrame = frames.find((f) => f.frameIndex === prevFrameIndex);
        if (prevFrame) {
          prevFrame.strokes.forEach((stroke) => drawStroke(stroke, opacity, true, false));
        }

        // Next Onion Skin (Green shade)
        const nextFrame = frames.find((f) => f.frameIndex === nextFrameIndex);
        if (nextFrame) {
          nextFrame.strokes.forEach((stroke) => drawStroke(stroke, opacity, false, true));
        }
      }
    }

    // 2. Draw Current Frame's Saved Strokes
    strokes.forEach((stroke) => {
      const isSelected = stroke.id === selectedStrokeId;
      if (isSelected && tempStrokePoints) {
        // Draw the temporary dragged version
        const tempStroke = { ...stroke, points: tempStrokePoints };
        drawStroke(tempStroke, 1.0);
      } else {
        drawStroke(stroke, isSelected ? 1.0 : 0.8); // make non-selected ones slightly dimmer for contrast
      }
    });

    // 2.5 Draw anchors/nodes for Selected Stroke if in 'point' tool mode
    if (selectedTool === 'point' && selectedStrokeId) {
      const activeStroke = strokes.find((s) => s.id === selectedStrokeId);
      const pointsToDraw = tempStrokePoints || activeStroke?.points;
      
      if (pointsToDraw && pointsToDraw.length > 0) {
        // Draw elegant polygon selection path boundary (marching-ants dashed outline, high visibility)
        ctx.save();
        ctx.beginPath();
        const start = toPx(pointsToDraw[0]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < pointsToDraw.length; i++) {
          const pt = toPx(pointsToDraw[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        if (activeStroke?.isClosed) {
          ctx.closePath();
        }
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]); // Dashed selection line
        ctx.stroke();
        ctx.restore();

        // Draw professional vector square anchor points (handles)
        pointsToDraw.forEach((pt, idx) => {
          const px = toPx(pt);
          const size = idx === draggedNodeIndex ? 7.5 : 6;
          
          ctx.save();
          // Subtle glow for selected/dragged node
          if (idx === draggedNodeIndex) {
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 8;
          }
          
          ctx.beginPath();
          ctx.rect(px.x - size / 2, px.y - size / 2, size, size);
          ctx.fillStyle = idx === draggedNodeIndex ? '#ffffff' : '#00b0ff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }
    }

    // 3. Draw Active Drawing Stroke Preview
    if (activePoints.length > 0) {
      const activeStroke: Stroke = {
        id: 'preview',
        points: activePoints,
        color: selectedColor,
        width: selectedWidth,
        glowColor: selectedColor + 'aa',
        glowWidth: selectedWidth * 3,
        isClosed: selectedTool === 'polygon' && activePoints.length > 2 && isOverFirstPoint(activePoints[activePoints.length - 1], activePoints[0]),
        style: selectedStyle,
      };
      drawStroke(activeStroke, 0.85);

      // Draw anchors for Polygon tool
      if (selectedTool === 'polygon') {
        activePoints.forEach((pt, idx) => {
          const px = toPx(pt);
          ctx.save();
          ctx.beginPath();
          ctx.arc(px.x, px.y, idx === 0 ? 6 : 4, 0, Math.PI * 2);
          ctx.fillStyle = idx === 0 ? '#ff0055' : selectedColor;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }
    }
  }, [strokes, activePoints, canvasSize, showOnionSkin, onionSkinRange, currentFrameIndex, frames, selectedColor, selectedWidth, selectedStyle, selectedTool, selectedStrokeId, tempStrokePoints, draggedNodeIndex]);

  // Utility to check if polygon click is overlapping the initial anchor
  const isOverFirstPoint = (pt: Point, firstPt: Point) => {
    const dx = pt.x - firstPt.x;
    const dy = pt.y - firstPt.y;
    // Tolerance in normalized percentage units
    return Math.sqrt(dx * dx + dy * dy) < 3.0;
  };

  // Convert mouse or pointer event coordinates to normalized (0 - 100) points
  const getNormalizedPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  // Helper to simplify dense points (e.g. from freehand brush) to clean vector paths
  const simplifyPoints = (points: Point[], tolerance: number = 1.6): Point[] => {
    if (points.length <= 2) return points;
    
    const result: Point[] = [points[0]];
    let lastSaved = points[0];
    
    for (let i = 1; i < points.length - 1; i++) {
      const pt = points[i];
      const dx = pt.x - lastSaved.x;
      const dy = pt.y - lastSaved.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= tolerance) {
        result.push(pt);
        lastSaved = pt;
      }
    }
    
    result.push(points[points.length - 1]);
    return result;
  };

  // Helper to calculate shortest distance in pixels from point p to line segment a-b
  const getPixelDistanceToSegment = (p: Point, a: Point, b: Point, size: { width: number, height: number }): number => {
    const px_p = { x: (p.x / 100) * size.width, y: (p.y / 100) * size.height };
    const px_a = { x: (a.x / 100) * size.width, y: (a.y / 100) * size.height };
    const px_b = { x: (b.x / 100) * size.width, y: (b.y / 100) * size.height };

    const dx = px_b.x - px_a.x;
    const dy = px_b.y - px_a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px_p.x - px_a.x) ** 2 + (px_p.y - px_a.y) ** 2);

    let t = ((px_p.x - px_a.x) * dx + (px_p.y - px_a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // clamp to segment bounds

    const projX = px_a.x + t * dx;
    const projY = px_a.y + t * dy;
    return Math.sqrt((px_p.x - projX) ** 2 + (px_p.y - projY) ** 2);
  };

  // Helper to select a stroke if click is within pixel tolerance
  const selectStrokeAt = (pt: Point): boolean => {
    const selectTolerancePx = 18.0; // Uniform pixel tolerance for easy selections
    for (const stroke of strokes) {
      // 1. Check distance to points
      const isCloseToPoint = stroke.points.some((p) => {
        const px_p = { x: (p.x / 100) * canvasSize.width, y: (p.y / 100) * canvasSize.height };
        const px_pt = { x: (pt.x / 100) * canvasSize.width, y: (pt.y / 100) * canvasSize.height };
        const dx = px_p.x - px_pt.x;
        const dy = px_p.y - px_pt.y;
        return Math.sqrt(dx * dx + dy * dy) < selectTolerancePx;
      });

      if (isCloseToPoint) {
        onSetSelectedStrokeId(stroke.id);
        return true;
      }

      // 2. Check distance to segments
      const count = stroke.points.length;
      const loopCount = stroke.isClosed ? count : count - 1;
      for (let i = 0; i < loopCount; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[(i + 1) % count];
        if (getPixelDistanceToSegment(pt, p1, p2, canvasSize) < selectTolerancePx) {
          onSetSelectedStrokeId(stroke.id);
          return true;
        }
      }
    }
    return false;
  };

  // Drawing pointer and mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    const pt = getNormalizedPoint(e);

    if (selectedTool === 'magic') {
      triggerMagicMask(pt.x, pt.y);
      return;
    }

    if (selectedTool === 'eraser') {
      eraseStrokeAt(pt);
      return;
    }

    if (selectedTool === 'polygon') {
      if (activePoints.length > 2 && isOverFirstPoint(pt, activePoints[0])) {
        // Close polygon!
        saveActiveStroke(true);
      } else {
        setActivePoints((prev) => [...prev, pt]);
      }
      return;
    }

    if (selectedTool === 'point') {
      // 1. If we click a vertex of the selected stroke, see if we should delete or drag
      const activeStroke = strokes.find((s) => s.id === selectedStrokeId);
      if (activeStroke) {
        const px_pt = { x: (pt.x / 100) * canvasSize.width, y: (pt.y / 100) * canvasSize.height };
        const nodeTolerancePx = 18.0; // Easy-to-grab node clicking radius (18px)
        let clickedNodeIndex = -1;
        
        for (let i = 0; i < activeStroke.points.length; i++) {
          const node = activeStroke.points[i];
          const px_node = { x: (node.x / 100) * canvasSize.width, y: (node.y / 100) * canvasSize.height };
          const dx = px_node.x - px_pt.x;
          const dy = px_node.y - px_pt.y;
          if (Math.sqrt(dx * dx + dy * dy) < nodeTolerancePx) {
            clickedNodeIndex = i;
            break;
          }
        }

        if (clickedNodeIndex !== -1) {
          if (pointEditMode === 'remove') {
            // Delete this point!
            const updatedPoints = activeStroke.points.filter((_, idx) => idx !== clickedNodeIndex);
            if (updatedPoints.length < 2) {
              // Delete the entire stroke
              onUpdateFrameStrokes(strokes.filter((s) => s.id !== selectedStrokeId));
              onSetSelectedStrokeId(null);
            } else {
              // Update strokes
              onUpdateFrameStrokes(
                strokes.map((s) => (s.id === selectedStrokeId ? { ...s, points: updatedPoints } : s))
              );
            }
            return;
          } else {
            // Start node dragging
            setDraggedNodeIndex(clickedNodeIndex);
            setTempStrokePoints([...activeStroke.points]);
            return;
          }
        }

        // 2. Clicked on canvas, but NOT on a vertex. If in 'add' mode, we can insert or extend point!
        if (pointEditMode === 'add') {
          const px_pt = { x: (pt.x / 100) * canvasSize.width, y: (pt.y / 100) * canvasSize.height };
          
          let minSegDistPx = Infinity;
          let insertIndex = activeStroke.points.length;
          
          const count = activeStroke.points.length;
          const loopCount = activeStroke.isClosed ? count : count - 1;

          for (let i = 0; i < loopCount; i++) {
            const p1 = activeStroke.points[i];
            const p2 = activeStroke.points[(i + 1) % count];
            const distPx = getPixelDistanceToSegment(pt, p1, p2, canvasSize);
            if (distPx < minSegDistPx) {
              minSegDistPx = distPx;
              insertIndex = i + 1;
            }
          }

          // Check endpoints to support extending open paths
          if (!activeStroke.isClosed && count > 0) {
            const startPt = activeStroke.points[0];
            const endPt = activeStroke.points[count - 1];
            
            const px_start = { x: (startPt.x / 100) * canvasSize.width, y: (startPt.y / 100) * canvasSize.height };
            const px_end = { x: (endPt.x / 100) * canvasSize.width, y: (endPt.y / 100) * canvasSize.height };

            const distToStartPx = Math.sqrt((px_pt.x - px_start.x) ** 2 + (px_pt.y - px_start.y) ** 2);
            const distToEndPx = Math.sqrt((px_pt.x - px_end.x) ** 2 + (px_pt.y - px_end.y) ** 2);

            // Extend if clicked close to an endpoint (within 45px) and closer than internal segments
            if (distToStartPx < 45.0 && distToStartPx < minSegDistPx) {
              const updatedPoints = [pt, ...activeStroke.points];
              onUpdateFrameStrokes(
                strokes.map((s) => (s.id === selectedStrokeId ? { ...s, points: updatedPoints } : s))
              );
              return;
            } else if (distToEndPx < 45.0 && distToEndPx < minSegDistPx) {
              const updatedPoints = [...activeStroke.points, pt];
              onUpdateFrameStrokes(
                strokes.map((s) => (s.id === selectedStrokeId ? { ...s, points: updatedPoints } : s))
              );
              return;
            }
          }

          // Insert point on internal segment if within 30px
          if (minSegDistPx < 30.0) {
            const updatedPoints = [...activeStroke.points];
            updatedPoints.splice(insertIndex, 0, pt);
            onUpdateFrameStrokes(
              strokes.map((s) => (s.id === selectedStrokeId ? { ...s, points: updatedPoints } : s))
            );
            return;
          }
        }
      }

      // 3. Try to select a stroke under the click if we didn't perform a point edit
      const selected = selectStrokeAt(pt);
      // Clicking on empty space deselects the active vector mask, matching standard Photopea/Illustrator behaviors
      if (!selected) {
        onSetSelectedStrokeId(null);
      }
      return;
    }

    setIsDrawing(true);
    setActivePoints([pt]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedPoint(e);

    if (selectedTool === 'eraser') {
      if (e.buttons === 1) {
        eraseStrokeAt(pt);
      }
      return;
    }

    if (selectedTool === 'point') {
      if (draggedNodeIndex !== -1 && tempStrokePoints) {
        // Drag active node!
        setTempStrokePoints((prev) =>
          prev ? prev.map((p, idx) => (idx === draggedNodeIndex ? pt : p)) : null
        );
      }
      return;
    }

    if (!isDrawing) return;

    if (selectedTool === 'brush') {
      // Freehand smoothing/density filter: only add point if it's far enough
      setActivePoints((prev) => {
        if (prev.length === 0) return [pt];
        const last = prev[prev.length - 1];
        const dist = Math.sqrt(Math.pow(pt.x - last.x, 2) + Math.pow(pt.y - last.y, 2));
        if (dist > 0.8) {
          return [...prev, pt];
        }
        return prev;
      });
    } else if (selectedTool === 'line') {
      // Line mode: just anchor start and end points
      setActivePoints((prev) => [prev[0], pt]);
    }
  };

  const handleMouseUp = () => {
    if (selectedTool === 'point') {
      if (draggedNodeIndex !== -1 && tempStrokePoints && selectedStrokeId) {
        // Drag complete! Save the final points back to parent state
        onUpdateFrameStrokes(
          strokes.map((s) => (s.id === selectedStrokeId ? { ...s, points: tempStrokePoints } : s))
        );
      }
      setDraggedNodeIndex(-1);
      setTempStrokePoints(null);
      return;
    }

    if (selectedTool === 'polygon') return; // Handled by double click, double click, or node close
    if (!isDrawing) return;

    setIsDrawing(false);
    saveActiveStroke(false);
  };

  const saveActiveStroke = (isClosed: boolean) => {
    if (activePoints.length < 2) {
      setActivePoints([]);
      return;
    }

    // Simplify points for Brush tool to make them easy and responsive to edit with nodes
    const pointsToSave = selectedTool === 'brush' 
      ? simplifyPoints(activePoints, 1.6) 
      : activePoints;

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      points: pointsToSave,
      color: selectedColor,
      width: selectedWidth,
      glowColor: selectedColor + 'aa', // add alpha to glowing background
      glowWidth: selectedWidth * 3.5,
      isClosed,
      style: selectedStyle,
    };

    onUpdateFrameStrokes([...strokes, newStroke]);
    onSetSelectedStrokeId(newStroke.id); // Auto-select newly drawn stroke for fast/seamless node editing!
    setActivePoints([]);
  };

  // Erase stroke intersecting with a normalized coordinate
  const eraseStrokeAt = (pt: Point) => {
    const tolerance = 4.0; // Normalized coordinate distance threshold
    const filteredStrokes = strokes.filter((stroke) => {
      // Check if any point in the stroke is close to the eraser coordinate
      const isClose = stroke.points.some((p) => {
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        return Math.sqrt(dx * dx + dy * dy) < tolerance;
      });
      return !isClose; // Keep stroke if NOT close to erase point
    });

    if (filteredStrokes.length !== strokes.length) {
      onUpdateFrameStrokes(filteredStrokes);
    }
  };

  // Cancel or close active poly drawings on right click/double click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedTool === 'polygon' && activePoints.length > 1) {
      saveActiveStroke(false);
    }
  };

  return (
    <div
      ref={containerRef}
      id="rotoscope-canvas-container"
      className="absolute inset-0 z-20 pointer-events-auto overflow-hidden flex items-center justify-center cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        id="rotoscope-drawing-canvas"
        width={canvasSize.width}
        height={canvasSize.height}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="block touch-none"
      />
      
      {/* Frame number display directly under/overlaying the bottom of the drawing canvas */}
      <div
        id="rotoscope-frame-badge"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#080808]/95 border border-cyan-500/30 px-3.5 py-1.5 text-[11px] font-mono text-cyan-400 select-none pointer-events-none flex items-center gap-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-sm z-30 tracking-widest font-bold border-t border-t-cyan-400/50"
      >
        <span>(   Frames [{String(currentFrameIndex + 1).padStart(2, '0')}/{String(frames.length).padStart(2, '0')}]   )</span>
      </div>
      
      {/* Dynamic draw-assist HUD HUD overlays */}
      {selectedTool === 'polygon' && activePoints.length > 0 && (
        <div id="polygon-help-badge" className="absolute top-4 left-4 bg-[#080808]/95 border border-white/20 px-3 py-1.5 rounded-none text-[10px] text-white/80 font-mono flex items-center gap-2 backdrop-blur-sm pointer-events-none select-none uppercase tracking-wider">
          <Edit2 className="w-3.5 h-3.5" />
          <span>Click original node to CLOSE, or Right-Click to SAVE open path.</span>
        </div>
      )}

      {selectedTool === 'magic' && !isMagicMasking && (
        <div id="magic-help-badge" className="absolute top-4 left-4 bg-[#080808]/95 border border-cyan-500/30 px-3 py-1.5 text-[10px] text-cyan-400 font-mono flex items-center gap-2 backdrop-blur-sm pointer-events-none select-none uppercase tracking-wider shadow-[0_4px_20px_rgba(0,240,255,0.1)]">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Click anywhere to isolate/mask that specific object, or click "Isolate Foreground Subject" on the panel.</span>
        </div>
      )}

      {/* Magic masking loading overlay */}
      {isMagicMasking && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-50 pointer-events-auto">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6 border border-cyan-500/20 bg-black/90 shadow-[0_0_50px_rgba(0,240,255,0.2)] relative">
            {/* Corner brackets */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

            <div className="relative">
              <Sparkles className="w-10 h-10 text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 w-10 h-10 bg-cyan-400/20 rounded-full blur-md animate-ping" />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-[0.2em] animate-pulse">
                MAGIC MASKING ACTIVE
              </h4>
              <p className="text-[10px] text-white/80 font-mono tracking-wider leading-relaxed">
                Gemini is removing background and isolating subject boundary...
              </p>
              <div className="w-48 h-1 bg-white/5 overflow-hidden mt-3 mx-auto relative">
                <div 
                  className="absolute inset-y-0 bg-cyan-400 w-1/2 animate-pulse"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #00f0ff, transparent)',
                    animation: 'shimmer 1.5s infinite linear'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Magic mask feedback pulsing click ring */}
      {magicFeedback && (
        <div 
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-45"
          style={{ left: `${magicFeedback.x}%`, top: `${magicFeedback.y}%` }}
        >
          <div className="w-14 h-14 border-2 border-cyan-400 rounded-full animate-ping" />
          <div className="absolute inset-0 w-14 h-14 border border-cyan-400/40 rounded-full animate-pulse scale-75" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_12px_#00f0ff]" />
        </div>
      )}
    </div>
  );
}
