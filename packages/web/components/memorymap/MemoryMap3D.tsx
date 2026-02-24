"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useThemeMode } from "@/contexts/ThemeContext";
import { select } from "d3-selection";
import { drag } from "d3-drag";
import { quadtree, type Quadtree } from "d3-quadtree";
import { timer, type Timer } from "d3-timer";
import type { MemoryMapPoint } from "@/lib/api";
import { RotateCcw, Play, Pause } from "lucide-react";
import styles from "./MemoryMap3D.module.css";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface MemoryMap3DProps {
  points: MemoryMapPoint[];
  varianceExplained?: [number, number, number];
  onPointClick?: (text: string) => void;
}

interface CameraState {
  theta: number;
  phi: number;
  distance: number;
  targetX: number;
  targetY: number;
}

interface ProjectedPoint {
  screenX: number;
  screenY: number;
  depth: number;
  index: number;
}

const DEFAULT_CAMERA: CameraState = {
  theta: Math.PI / 6,
  phi: Math.PI / 3,
  distance: 3.5,
  targetX: 0,
  targetY: 0,
};

const CANVAS_HEIGHT = 460;
const AUTO_ROTATE_SPEED = 0.002;
const IDLE_TIMEOUT = 5000;
const ORBIT_SENSITIVITY = 0.01;
const PAN_SENSITIVITY = 0.003;
const ZOOM_SENSITIVITY = 0.005;

// MongoDB brand palette
const DARK_COLORS = [
  "#00ED64", "#71F6BA", "#016BF8", "#C3E7FE",
  "#00A35C", "#FFC010", "#C0FAE6", "#B8C4C2",
];
const LIGHT_COLORS = [
  "#00684A", "#00A35C", "#016BF8", "#1A567E",
  "#023430", "#944F01", "#3D4F58", "#00684A",
];

// ---------------------------------------------------------------------------
// 3D Math
// ---------------------------------------------------------------------------

function buildViewMatrix(theta: number, phi: number): number[][] {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  return [
    [-st, 0, ct],
    [-cp * ct, sp, -cp * st],
    [sp * ct, cp, sp * st],
  ];
}

function project3D(
  point: [number, number, number],
  vm: number[][],
  cam: CameraState,
  w: number,
  h: number,
): [number, number, number] {
  const vx = vm[0][0] * point[0] + vm[0][1] * point[1] + vm[0][2] * point[2];
  const vy = vm[1][0] * point[0] + vm[1][1] * point[1] + vm[1][2] * point[2];
  const vz = vm[2][0] * point[0] + vm[2][1] * point[1] + vm[2][2] * point[2];

  const fov = 2.0;
  const z = cam.distance - vz;
  const scale = fov / Math.max(z, 0.1);

  const sx = w / 2 + (vx - cam.targetX) * scale * (w / 4);
  const sy = h / 2 - (vy - cam.targetY) * scale * (h / 4);

  return [sx, sy, z];
}

// ---------------------------------------------------------------------------
// Draw functions
// ---------------------------------------------------------------------------

function drawAxes(
  ctx: CanvasRenderingContext2D,
  vm: number[][],
  cam: CameraState,
  w: number,
  h: number,
  darkMode: boolean,
  varianceExplained?: [number, number, number],
) {
  const axisColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const labelColor = darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  const axisEndColor = darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";

  ctx.lineWidth = 1;

  const axes: [string, [number, number, number], [number, number, number], string][] = [
    ["PC1", [-1, 0, 0], [1, 0, 0], "#016BF8"],
    ["PC2", [0, -1, 0], [0, 1, 0], "#00ED64"],
    ["PC3", [0, 0, -1], [0, 0, 1], "#FFC010"],
  ];

  for (let a = 0; a < axes.length; a++) {
    const [label, from, to, color] = axes[a];
    const [x1, y1] = project3D(from, vm, cam, w, h);
    const [x2, y2] = project3D(to, vm, cam, w, h);

    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = axisEndColor;
    ctx.beginPath();
    ctx.arc(x2, y2, 3, 0, Math.PI * 2);
    ctx.fill();

    const pctStr = varianceExplained
      ? ` ${(varianceExplained[a] * 100).toFixed(0)}%`
      : "";
    ctx.fillStyle = labelColor;
    ctx.font = "10px 'Euclid Circular A', 'Source Code Pro', sans-serif";
    ctx.fillText(`${label}${pctStr}`, x2 + 6, y2 - 4);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x2, y2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  points: MemoryMapPoint[],
  cam: CameraState,
  w: number,
  h: number,
  darkMode: boolean,
  hovIdx: number | null,
  palette: string[],
  varianceExplained?: [number, number, number],
): ProjectedPoint[] {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const vm = buildViewMatrix(cam.theta, cam.phi);

  const projected: ProjectedPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const [sx, sy, depth] = project3D(
      [p.x, p.y, p.z ?? 0],
      vm, cam, w, h,
    );
    projected.push({ screenX: sx, screenY: sy, depth, index: i });
  }

  projected.sort((a, b) => b.depth - a.depth);

  drawAxes(ctx, vm, cam, w, h, darkMode, varianceExplained);

  let maxDepth = -Infinity, minDepth = Infinity;
  for (const p of projected) {
    if (p.depth > maxDepth) maxDepth = p.depth;
    if (p.depth < minDepth) minDepth = p.depth;
  }
  const depthRange = maxDepth - minDepth || 1;

  for (const { screenX, screenY, depth, index } of projected) {
    const depthFactor = 1 - (depth - minDepth) / depthRange;
    const point = points[index];

    const baseRadius = 4 + Math.min(point.tags.length, 3);
    const radius = baseRadius * (0.5 + 0.5 * depthFactor);
    const opacity = 0.3 + 0.6 * depthFactor;

    const color = palette[index % palette.length];
    const isHovered = hovIdx === index;

    ctx.beginPath();
    ctx.arc(screenX, screenY, isHovered ? radius * 1.4 : radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = isHovered ? 1.0 : opacity;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }

    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  return projected;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemoryMap3D({ points, varianceExplained, onPointClick }: MemoryMap3DProps) {
  const { darkMode } = useThemeMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // All mutable interaction state lives in refs to avoid React re-render churn
  const cameraRef = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const projectedRef = useRef<ProjectedPoint[]>([]);
  const qtreeRef = useRef<Quadtree<ProjectedPoint> | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const hoveredScreenRef = useRef<[number, number]>([0, 0]);
  const dirtyRef = useRef(true);
  const rafRef = useRef(0);
  const autoRotateTimerRef = useRef<Timer | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactedRef = useRef(false);
  const widthRef = useRef(700);

  // These React states only update for UI overlays (tooltip + controls)
  const [containerWidth, setContainerWidth] = useState(700);
  const [tooltipState, setTooltipState] = useState<{
    index: number;
    sx: number;
    sy: number;
  } | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [showHint, setShowHint] = useState(true);

  // Stable refs for values needed in event handlers
  const darkModeRef = useRef(darkMode);
  darkModeRef.current = darkMode;
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const varianceRef = useRef(varianceExplained);
  varianceRef.current = varianceExplained;
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  const palette = darkMode ? DARK_COLORS : LIGHT_COLORS;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) {
        widthRef.current = width;
        setContainerWidth(width);
        dirtyRef.current = true;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    dirtyRef.current = true;
  }, [containerWidth]);

  // Mark dirty when points/dark mode/palette change
  useEffect(() => {
    dirtyRef.current = true;
  }, [points, darkMode, palette]);

  // ---------------------------------------------------------------------------
  // Core render loop — runs via rAF, only paints when dirty
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      rafRef.current = requestAnimationFrame(loop);

      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = widthRef.current;
      projectedRef.current = renderFrame(
        ctx,
        pointsRef.current,
        cameraRef.current,
        w,
        CANVAS_HEIGHT,
        darkModeRef.current,
        hoveredRef.current,
        paletteRef.current,
        varianceRef.current,
      );

      // Rebuild quadtree from fresh projections
      const tree = quadtree<ProjectedPoint>()
        .x((d) => d.screenX)
        .y((d) => d.screenY)
        .addAll(projectedRef.current);
      qtreeRef.current = tree;
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // intentionally empty — reads everything from refs

  // ---------------------------------------------------------------------------
  // Auto-rotation via d3-timer (sets dirty flag, not React state)
  // ---------------------------------------------------------------------------

  const startAutoRotate = useCallback(() => {
    if (autoRotateTimerRef.current) return;
    setIsAutoRotating(true);
    autoRotateTimerRef.current = timer(() => {
      cameraRef.current.theta += AUTO_ROTATE_SPEED;
      dirtyRef.current = true;
    });
  }, []);

  const stopAutoRotate = useCallback(() => {
    autoRotateTimerRef.current?.stop();
    autoRotateTimerRef.current = null;
    setIsAutoRotating(false);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(startAutoRotate, IDLE_TIMEOUT);
  }, [startAutoRotate]);

  // Kick off auto-rotate after mount
  useEffect(() => {
    const t = setTimeout(startAutoRotate, 1500);
    return () => {
      clearTimeout(t);
      autoRotateTimerRef.current?.stop();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [startAutoRotate]);

  // ---------------------------------------------------------------------------
  // Tooltip sync — debounced to avoid React render storms
  // We only push tooltip state to React at ~30 fps via a low-freq updater
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let active = true;
    let lastPushed: number | null = -999; // sentinel

    const tick = () => {
      if (!active) return;
      requestAnimationFrame(tick);

      const hov = hoveredRef.current;
      if (hov !== lastPushed) {
        lastPushed = hov;
        if (hov !== null) {
          setTooltipState({
            index: hov,
            sx: hoveredScreenRef.current[0],
            sy: hoveredScreenRef.current[1],
          });
        } else {
          setTooltipState(null);
        }
      }
    };
    requestAnimationFrame(tick);
    return () => { active = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // D3 drag for orbit + pan (set up ONCE, reads refs)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sel = select<HTMLCanvasElement, unknown>(canvas);

    const dragBehavior = drag<HTMLCanvasElement, unknown>()
      .on("start", () => {
        autoRotateTimerRef.current?.stop();
        autoRotateTimerRef.current = null;
        setIsAutoRotating(false);
        if (!interactedRef.current) {
          interactedRef.current = true;
          setShowHint(false);
        }
      })
      .on("drag", (event) => {
        const cam = cameraRef.current;
        if (event.sourceEvent?.shiftKey) {
          // Pan — scale to zoom level so it feels consistent
          const panScale = PAN_SENSITIVITY * cam.distance;
          cam.targetX -= event.dx * panScale;
          cam.targetY += event.dy * panScale;
        } else {
          // Orbit
          cam.theta -= event.dx * ORBIT_SENSITIVITY;
          cam.phi = Math.max(
            0.1,
            Math.min(Math.PI - 0.1, cam.phi - event.dy * ORBIT_SENSITIVITY),
          );
        }
        dirtyRef.current = true;
      })
      .on("end", () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          if (!autoRotateTimerRef.current) {
            setIsAutoRotating(true);
            autoRotateTimerRef.current = timer(() => {
              cameraRef.current.theta += AUTO_ROTATE_SPEED;
              dirtyRef.current = true;
            });
          }
        }, IDLE_TIMEOUT);
      });

    sel.call(dragBehavior);

    // Zoom via wheel
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      autoRotateTimerRef.current?.stop();
      autoRotateTimerRef.current = null;
      setIsAutoRotating(false);

      if (!interactedRef.current) {
        interactedRef.current = true;
        setShowHint(false);
      }

      const cam = cameraRef.current;
      cam.distance = Math.max(
        1.2,
        Math.min(12, cam.distance + e.deltaY * ZOOM_SENSITIVITY),
      );
      dirtyRef.current = true;

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!autoRotateTimerRef.current) {
          setIsAutoRotating(true);
          autoRotateTimerRef.current = timer(() => {
            cameraRef.current.theta += AUTO_ROTATE_SPEED;
            dirtyRef.current = true;
          });
        }
      }, IDLE_TIMEOUT);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      sel.on(".drag", null);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []); // once — all state via refs

  // ---------------------------------------------------------------------------
  // Hover detection — pointermove reads cached quadtree, no React state churn
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const tree = qtreeRef.current;
      if (!tree) return;

      const nearest = tree.find(mx, my, 20);
      const prev = hoveredRef.current;

      if (nearest) {
        hoveredRef.current = nearest.index;
        hoveredScreenRef.current = [nearest.screenX, nearest.screenY];
        canvas.style.cursor = "pointer";
      } else {
        hoveredRef.current = null;
        canvas.style.cursor = "grab";
      }

      // Only trigger canvas repaint if hover actually changed
      if (hoveredRef.current !== prev) {
        dirtyRef.current = true;
      }
    };

    const onPointerLeave = () => {
      if (hoveredRef.current !== null) {
        hoveredRef.current = null;
        dirtyRef.current = true;
      }
      canvas.style.cursor = "grab";
    };

    const onClick = () => {
      const idx = hoveredRef.current;
      if (idx !== null && onPointClickRef.current) {
        const p = pointsRef.current[idx];
        const q = p.text.length > 60 ? p.text.slice(0, 60) : p.text;
        onPointClickRef.current(q);
      }
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, []); // once

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------

  const resetCamera = useCallback(() => {
    cameraRef.current = { ...DEFAULT_CAMERA };
    autoRotateTimerRef.current?.stop();
    autoRotateTimerRef.current = null;
    setIsAutoRotating(false);
    dirtyRef.current = true;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(startAutoRotate, IDLE_TIMEOUT);
  }, [startAutoRotate]);

  const toggleAutoRotate = useCallback(() => {
    if (autoRotateTimerRef.current) {
      stopAutoRotate();
    } else {
      startAutoRotate();
    }
  }, [startAutoRotate, stopAutoRotate]);

  // ---------------------------------------------------------------------------
  // Tooltip data
  // ---------------------------------------------------------------------------

  const hoveredPoint = tooltipState ? points[tooltipState.index] : null;

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={containerWidth}
        height={CANVAS_HEIGHT}
      />

      {/* Control buttons */}
      <div className={styles.controls}>
        <button
          className={styles.controlBtn}
          onClick={resetCamera}
          title="Reset view"
        >
          <RotateCcw size={14} />
        </button>
        <button
          className={styles.controlBtn}
          onClick={toggleAutoRotate}
          title={isAutoRotating ? "Pause rotation" : "Auto-rotate"}
        >
          {isAutoRotating ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>

      {/* Variance explained badge */}
      {varianceExplained && (
        <div className={styles.varianceInfo}>
          PC1: {(varianceExplained[0] * 100).toFixed(1)}%
          {" | "}
          PC2: {(varianceExplained[1] * 100).toFixed(1)}%
          {" | "}
          PC3: {(varianceExplained[2] * 100).toFixed(1)}%
          {" | "}
          Total: {((varianceExplained[0] + varianceExplained[1] + varianceExplained[2]) * 100).toFixed(1)}%
        </div>
      )}

      {/* Drag hint */}
      {showHint && points.length > 0 && (
        <div className={styles.dragHint}>
          Drag to orbit &middot; Scroll to zoom &middot; Shift+drag to pan
        </div>
      )}

      {/* Tooltip */}
      {hoveredPoint && tooltipState && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(tooltipState.sx, containerWidth - 260),
            top:
              tooltipState.sy > CANVAS_HEIGHT / 2
                ? tooltipState.sy - 80
                : tooltipState.sy + 20,
          }}
        >
          <div className={styles.tooltipText}>
            {hoveredPoint.text.slice(0, 120)}
            {hoveredPoint.text.length > 120 ? "..." : ""}
          </div>
          {hoveredPoint.tags.length > 0 && (
            <div className={styles.tooltipTags}>
              {hoveredPoint.tags.slice(0, 5).map((tag) => (
                <span key={tag} className={styles.tooltipTag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className={styles.tooltipDate}>
            {new Date(hoveredPoint.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
