import { useEffect, useRef } from 'react';
import type { FaceLandmarkPoint } from '../hooks/useMediaPipeFaceTwin';

interface TrackingDebugOverlayProps {
  video: HTMLVideoElement | null;
  rawLandmarks: FaceLandmarkPoint[];
  landmarks: FaceLandmarkPoint[];
  status: 'idle' | 'loading' | 'tracking' | 'error';
  proximity: number;
  refinementConfidence: number;
}

const LIP_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 33];
const RIGHT_EYE_INDICES = [263, 387, 385, 362, 380, 373, 263];
const FACE_FRAME_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];

const NOSE_INDICES = [168, 6, 197, 195, 5, 4, 45, 275, 440, 344, 278, 1, 48, 115, 220, 45];

function drawPolyline(ctx: CanvasRenderingContext2D, landmarks: FaceLandmarkPoint[], indices: number[], width: number, height: number, color: string) {
  let started = false;
  ctx.beginPath();
  for (const index of indices) {
    const point = landmarks[index];
    if (!point) continue;
    const x = (1 - point.x) * width;
    const y = point.y * height;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) {
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

function drawPoints(
  ctx: CanvasRenderingContext2D,
  landmarks: FaceLandmarkPoint[],
  width: number,
  height: number,
  fillStyle: string,
  radius: number,
  indices?: Set<number>,
) {
  for (let index = 0; index < landmarks.length; index += 1) {
    if (indices && !indices.has(index)) continue;
    const point = landmarks[index];
    const x = (1 - point.x) * width;
    const y = point.y * height;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
}

export default function TrackingDebugOverlay({ video, rawLandmarks, landmarks, status, proximity, refinementConfidence }: TrackingDebugOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, width, height);

      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(2, 6, 23, 0.22)';
      ctx.fillRect(0, 0, width, height);

      if (rawLandmarks.length > 0) {
        ctx.lineWidth = 1.4;
        drawPolyline(ctx, rawLandmarks, FACE_FRAME_INDICES, width, height, 'rgba(125, 211, 252, 0.28)');
        drawPolyline(ctx, rawLandmarks, LIP_INDICES, width, height, 'rgba(148, 163, 184, 0.5)');
        drawPolyline(ctx, rawLandmarks, NOSE_INDICES, width, height, 'rgba(148, 163, 184, 0.45)');
        drawPoints(ctx, rawLandmarks, width, height, 'rgba(191, 219, 254, 0.38)', 0.95);
      }

      if (landmarks.length > 0) {
        ctx.lineWidth = 1.6;
        drawPolyline(ctx, landmarks, FACE_FRAME_INDICES, width, height, 'rgba(125, 211, 252, 0.7)');
        drawPolyline(ctx, landmarks, LEFT_EYE_INDICES, width, height, 'rgba(167, 243, 208, 0.92)');
        drawPolyline(ctx, landmarks, RIGHT_EYE_INDICES, width, height, 'rgba(167, 243, 208, 0.92)');
        drawPolyline(ctx, landmarks, LIP_INDICES, width, height, 'rgba(251, 113, 133, 0.98)');
        drawPolyline(ctx, landmarks, NOSE_INDICES, width, height, 'rgba(253, 224, 71, 0.92)');

        drawPoints(ctx, landmarks, width, height, 'rgba(191, 219, 254, 0.62)', 1.1);
        drawPoints(ctx, landmarks, width, height, 'rgba(254, 205, 211, 0.98)', 2.1, new Set(LIP_INDICES));
        drawPoints(ctx, landmarks, width, height, 'rgba(253, 224, 71, 0.95)', 1.8, new Set(NOSE_INDICES));
      }

      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.fillRect(10, 10, 164, 58);
      ctx.fillStyle = '#e5eefb';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.fillText(`status: ${status}`, 18, 28);
      ctx.fillText(`prox: ${proximity.toFixed(2)}`, 18, 44);
      ctx.fillText(`cv: ${refinementConfidence.toFixed(2)}`, 18, 60);

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [video, rawLandmarks, landmarks, proximity, refinementConfidence, status]);

  return (
    <div className="pointer-events-none absolute right-6 bottom-20 z-20 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
        <span>MediaPipe Debug</span>
        <span>{status}</span>
      </div>
      <canvas ref={canvasRef} width={320} height={240} className="block h-auto w-full" />
    </div>
  );
}
