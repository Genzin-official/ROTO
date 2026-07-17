/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { FrameData, Stroke, Point, Camera3D } from '../types';
import { Rotate3d, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from 'lucide-react';

interface Viewport3DProps {
  frames: FrameData[];
  currentFrameIndex: number;
  totalFrames: number;
  zSpacing: number; // Z-axis separation between frames
  onSetFrameIndex: (idx: number) => void;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
}

export default function Viewport3D({
  frames,
  currentFrameIndex,
  totalFrames,
  zSpacing = 35,
  onSetFrameIndex,
}: Viewport3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });

  // Camera settings
  const [camera, setCamera] = useState<Camera3D>({
    rotationX: -0.45, // Looking slightly downwards
    rotationY: 0.65,  // Looking slightly from the right
    zoom: 400,
    panX: 0,
    panY: -20,
  });

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const cameraStart = useRef<Camera3D | null>(null);
  const [dragMode, setDragMode] = useState<'orbit' | 'pan'>('orbit');
  const [particles, setParticles] = useState<Particle3D[]>([]);

  // Initialize a subtle floating 3D particle dust cloud
  useEffect(() => {
    const temp: Particle3D[] = [];
    const colors = ['#00f0ff', '#ff007f', '#7000ff', '#ffffff'];
    for (let i = 0; i < 45; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 220,
        y: (Math.random() - 0.5) * 160,
        z: (Math.random() - 0.2) * (totalFrames * zSpacing + 100),
        size: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setParticles(temp);
  }, [totalFrames, zSpacing]);

  // Handle ResizeObserver to automatically scale 3D canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width: Math.max(100, width), height: Math.max(100, height) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Main 3D render tick
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    ctx.clearRect(0, 0, width, height);

    // Camera perspective distance (simulates focal length)
    const focalLength = 320;

    // 3D projection formulas
    const project = (x3d: number, y3d: number, z3d: number) => {
      // Move coordinates relative to central pivot (time centered around current frame)
      const cx = x3d;
      const cy = y3d;
      // Center Z timeline around active playhead position
      const cz = z3d - currentFrameIndex * zSpacing;

      // 1. Rotate around Y axis (yaw)
      const cosY = Math.cos(camera.rotationY);
      const sinY = Math.sin(camera.rotationY);
      let rX = cx * cosY - cz * sinY;
      let rZ = cx * sinY + cz * cosY;

      // 2. Rotate around X axis (pitch)
      const cosX = Math.cos(camera.rotationX);
      const sinX = Math.sin(camera.rotationX);
      let rY = cy * cosX - rZ * sinX;
      rZ = cy * sinX + rZ * cosX;

      // Add pan offsets
      rX += camera.panX;
      rY += camera.panY;

      // Camera distance adjustment (Zoom acts as camera's Z distance)
      const dist = camera.zoom;
      const finalZ = rZ + dist;

      // Don't render points behind camera (clipping)
      if (finalZ <= 10) {
        return { x: 0, y: 0, visible: false, depth: finalZ };
      }

      // Project onto 2D viewport
      const scale = focalLength / finalZ;
      const screenX = width / 2 + rX * scale;
      // Invert Y because screens increase downward
      const screenY = height / 2 - rY * scale;

      return {
        x: screenX,
        y: screenY,
        visible: screenX >= -200 && screenX <= width + 200 && screenY >= -200 && screenY <= height + 200,
        depth: finalZ,
      };
    };

    // Keep track of all drawing operations to depth-sort them (painter's algorithm)
    interface DrawTask {
      depth: number;
      draw: () => void;
    }
    const drawTasks: DrawTask[] = [];

    // 1. Render ambient 3D stars / space dust
    particles.forEach((p) => {
      const proj = project(p.x, p.y, p.z);
      if (proj.visible) {
        drawTasks.push({
          depth: proj.depth,
          draw: () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, p.size * (150 / proj.depth), 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            // Depth fog (fade stars far away)
            ctx.globalAlpha = Math.max(0.1, Math.min(0.8, 150 / proj.depth));
            ctx.fill();
            ctx.restore();
          },
        });
      }
    });

    // 2. Render each video frame plane as a wireframe box
    for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
      const zVal = fIdx * zSpacing;
      const isCurrent = fIdx === currentFrameIndex;

      // Frame box corners (from -50 to +50 on X/Y)
      const corners = [
        { x: -50, y: 35 },  // Top Left
        { x: 50, y: 35 },   // Top Right
        { x: 50, y: -35 },  // Bottom Right
        { x: -50, y: -35 }, // Bottom Left
      ];

      const projCorners = corners.map((c) => project(c.x, c.y, zVal));

      if (projCorners.every((c) => c.visible)) {
        // Average depth of the frame plane for sorting
        const avgDepth = projCorners.reduce((acc, c) => acc + c.depth, 0) / 4;

        drawTasks.push({
          depth: avgDepth,
          draw: () => {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(projCorners[0].x, projCorners[0].y);
            projCorners.forEach((c) => ctx.lineTo(c.x, c.y));
            ctx.closePath();

            // Set frame frame borders
            if (isCurrent) {
              ctx.strokeStyle = '#00ff66'; // Glowing Active Playhead Frame
              ctx.lineWidth = 2.5;
              ctx.shadowColor = 'rgba(0, 255, 102, 0.4)';
              ctx.shadowBlur = 12;
            } else {
              // Dim relative to distance from current frame
              const dist = Math.abs(fIdx - currentFrameIndex);
              const opacity = Math.max(0.04, 0.35 - dist * 0.05);
              ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
              ctx.lineWidth = 0.8;
              ctx.shadowBlur = 0;
            }

            ctx.stroke();

            // Draw a semi-transparent background overlay on current active playhead plane
            if (isCurrent) {
              ctx.fillStyle = 'rgba(0, 255, 102, 0.04)';
              ctx.fill();

              // Add a little floating frame index number
              ctx.fillStyle = '#00ff66';
              ctx.font = '10px monospace';
              ctx.fillText(`FRAME ${fIdx + 1}`, projCorners[0].x, projCorners[0].y - 6);
            }

            ctx.restore();
          },
        });
      }
    }

    // 3. Render Connecting Spacetime Trails (connecting same strokes across frames)
    // Draw guide rails between equivalent stroke point anchors across adjacent frames
    for (let fIdx = 0; fIdx < totalFrames - 1; fIdx++) {
      const f1 = frames.find((f) => f.frameIndex === fIdx);
      const f2 = frames.find((f) => f.frameIndex === fIdx + 1);

      if (f1 && f2 && f1.strokes.length > 0 && f2.strokes.length > 0) {
        // Simple heuristic: connect points that correspond to same stroke index
        f1.strokes.forEach((s1, sIdx) => {
          const s2 = f2.strokes[sIdx];
          if (s2 && s1.points.length === s2.points.length) {
            // Draw connector guides
            s1.points.forEach((p1, pIdx) => {
              // Draw line from p1 at fIdx to p2 at fIdx+1
              const p2 = s2.points[pIdx];

              // Convert normalized coordinates to local 3D coordinates (-50 to +50)
              const x1 = p1.x - 50;
              const y1 = -(p1.y - 50); // Invert vertical
              const z1 = fIdx * zSpacing;

              const x2 = p2.x - 50;
              const y2 = -(p2.y - 50);
              const z2 = (fIdx + 1) * zSpacing;

              const proj1 = project(x1, y1, z1);
              const proj2 = project(x2, y2, z2);

              if (proj1.visible && proj2.visible) {
                const avgDepth = (proj1.depth + proj2.depth) / 2;
                drawTasks.push({
                  depth: avgDepth,
                  draw: () => {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(proj1.x, proj1.y);
                    ctx.lineTo(proj2.x, proj2.y);
                    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
                    ctx.setLineDash([2, 4]);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.restore();
                  },
                });
              }
            });
          }
        });
      }
    }

    // 4. Render 3D Vector Strokes onto each corresponding Z depth plane
    frames.forEach((frame) => {
      const zVal = frame.frameIndex * zSpacing;
      const isCurrent = frame.frameIndex === currentFrameIndex;

      frame.strokes.forEach((stroke) => {
        if (stroke.points.length === 0) return;

        // Project all points of the stroke
        const projectedPoints = stroke.points.map((pt) => {
          // Translate 0-100 canvas percentages to 3D center origin coordinates (-50 to 50)
          const x3d = pt.x - 50;
          const y3d = -(pt.y - 50); // Flip Y to cartesian
          return {
            proj: project(x3d, y3d, zVal),
            raw: pt,
          };
        });

        // Compute average depth for painter algorithm
        const avgDepth = projectedPoints.reduce((sum, p) => sum + p.proj.depth, 0) / projectedPoints.length;

        drawTasks.push({
          depth: avgDepth,
          draw: () => {
            ctx.save();
            ctx.beginPath();

            const start = projectedPoints[0].proj;
            ctx.moveTo(start.x, start.y);

            for (let i = 1; i < projectedPoints.length; i++) {
              ctx.lineTo(projectedPoints[i].proj.x, projectedPoints[i].proj.y);
            }

            if (stroke.isClosed) {
              ctx.closePath();
            }

            // Depth scale line thickness (closer = thicker)
            const depthScale = Math.max(0.2, 350 / avgDepth);

            // Configure neon glow stroke styles
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = stroke.width * depthScale;

            // Make non-current frames translucent
            const dist = Math.abs(frame.frameIndex - currentFrameIndex);
            const relativeFade = Math.max(0.12, 1.0 - dist * 0.15);

            ctx.strokeStyle = stroke.color;
            ctx.shadowColor = stroke.glowColor;
            ctx.shadowBlur = stroke.glowWidth * depthScale;
            ctx.globalAlpha = relativeFade;

            ctx.stroke();

            // Render glowing core line
            if (stroke.style === 'neon' || stroke.style === 'laser' || stroke.style === 'pulse') {
              ctx.shadowBlur = 0;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = Math.max(0.5, stroke.width * 0.3 * depthScale);
              ctx.stroke();
            }

            ctx.restore();
          },
        });
      });
    });

    // 5. Sort task queue by depth (PAINTER'S ALGORITHM: Draw furthest objects first, nearest last)
    drawTasks.sort((a, b) => b.depth - a.depth);

    // 6. Execute all drawing calls
    drawTasks.forEach((task) => task.draw());

    // 7. Draw spatial HUD elements (glowing grid floor at the bottom of the time tunnel)
    drawSpatialFloorGrid(ctx, project);
  }, [frames, currentFrameIndex, totalFrames, zSpacing, camera, dimensions, particles]);

  // Render a futuristic glowing grid floor below the workspace tunnel
  const drawSpatialFloorGrid = (ctx: CanvasRenderingContext2D, project: (x: number, y: number, z: number) => any) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(112, 0, 255, 0.08)';
    ctx.lineWidth = 1;

    const yFloor = -45; // Floor Y coordinate
    const xRange = [-100, -50, 0, 50, 100];
    const zRange = Array.from({ length: 11 }, (_, i) => i * zSpacing * (totalFrames / 10));

    // Draw Z parallel lines
    xRange.forEach((x) => {
      ctx.beginPath();
      const pStart = project(x, yFloor, 0);
      const pEnd = project(x, yFloor, totalFrames * zSpacing);
      if (pStart.visible && pEnd.visible) {
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();
      }
    });

    // Draw X orthogonal lines
    zRange.forEach((z) => {
      ctx.beginPath();
      const pStart = project(-100, yFloor, z);
      const pEnd = project(100, yFloor, z);
      if (pStart.visible && pEnd.visible) {
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();
      }
    });

    ctx.restore();
  };

  // Orbital drag handler events
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
    cameraStart.current = { ...camera };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current || !cameraStart.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (dragMode === 'orbit') {
      // Rotation X (Pitch) limited between pointing directly down and straight up
      const rotationX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraStart.current.rotationX + dy * 0.007));
      // Rotation Y (Yaw) fully circular
      const rotationY = cameraStart.current.rotationY + dx * 0.007;

      setCamera((prev) => ({
        ...prev,
        rotationX,
        rotationY,
      }));
    } else {
      // Pan camera horizontally/vertically
      setCamera((prev) => ({
        ...prev,
        panX: cameraStart.current!.panX + dx * 0.5,
        panY: cameraStart.current!.panY - dy * 0.5,
      }));
    }
  };

  const handleMouseUp = () => {
    dragStart.current = null;
    cameraStart.current = null;
  };

  const resetCamera = () => {
    setCamera({
      rotationX: -0.45,
      rotationY: 0.65,
      zoom: 400,
      panX: 0,
      panY: -20,
    });
  };

  return (
    <div
      ref={containerRef}
      id="viewport-3d-wrapper"
      className="relative w-full h-full bg-[#0a0a0a] border border-white/10 rounded-none overflow-hidden flex flex-col shadow-inner select-none"
    >
      {/* 3D Viewport Titlebar HUD */}
      <div id="viewport-3d-hud" className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2">
          <Rotate3d className="w-4 h-4 text-white/60 animate-spin-slow" />
          <span className="text-[10px] uppercase font-mono font-bold tracking-[0.2em] text-white/50">
            3D SPACETIME CHAMBER
          </span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setDragMode((prev) => (prev === 'orbit' ? 'pan' : 'orbit'))}
            className={`px-2 py-1 text-[9px] font-mono font-bold tracking-widest border rounded-none transition-all ${
              dragMode === 'orbit'
                ? 'bg-white text-black border-white'
                : 'bg-[#111111] border-white/10 text-white/80 hover:border-white/35'
            }`}
          >
            {dragMode === 'orbit' ? 'MODE: ORBIT' : 'MODE: PAN'}
          </button>
          <button
            onClick={resetCamera}
            className="p-1 rounded-none bg-[#111] border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
            title="Reset Camera Angle"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Render Canvas */}
      <canvas
        ref={canvasRef}
        id="timeline-3d-canvas"
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Manual Zoom buttons bottom right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-10">
        <button
          onClick={() => setCamera((prev) => ({ ...prev, zoom: Math.min(800, prev.zoom + 30) }))}
          className="p-1.5 rounded-none bg-[#111] border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setCamera((prev) => ({ ...prev, zoom: Math.max(150, prev.zoom - 30) }))}
          className="p-1.5 rounded-none bg-[#111] border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dynamic 3D stats tooltip bottom left */}
      <div className="absolute bottom-4 left-4 text-[9px] text-white/30 font-mono tracking-wider pointer-events-none uppercase">
        <div>Pitch: {camera.rotationX.toFixed(2)} rad | Yaw: {camera.rotationY.toFixed(2)} rad</div>
        <div>Zoom: {camera.zoom}px | Spacing: {zSpacing}px/frame</div>
      </div>
    </div>
  );
}
