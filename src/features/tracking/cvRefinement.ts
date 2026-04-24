import type { FaceLandmarkPoint } from './types';
import { clamp, smooth } from './math';

type CvRefinementScratch = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

type CvRefinementResult = {
  refinedLandmarks: FaceLandmarkPoint[];
  confidence: number;
};

type DirectedRefinementSpec = {
  index: number;
  dirX: number;
  dirY: number;
  radiusPx: number;
  darknessWeight: number;
  edgeWeight: number;
};

const CV_REFINEMENT_INDICES = {
  mouth: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
  nose: [1, 2, 4, 5, 45, 98, 195, 197, 275, 327],
} as const;

const CV_REFINEMENT_TUNING = {
  analysisWidth: 320,
  mouthRadiusPx: 5,
  noseRadiusPx: 4,
  temporalWeight: 0.65,
  baseWeight: 0.42,
  edgeWeight: 1.0,
  maxOffsetNorm: 0.028,
  contourTemporalAlpha: 0.58,
  lipMinGapNorm: 0.0028,
};

const DIRECTED_MOUTH_REFINEMENT: DirectedRefinementSpec[] = [
  { index: 61, dirX: -1, dirY: 0.12, radiusPx: 7, darknessWeight: 0.35, edgeWeight: 1.2 },
  { index: 291, dirX: 1, dirY: 0.12, radiusPx: 7, darknessWeight: 0.35, edgeWeight: 1.2 },
  { index: 0, dirX: 0, dirY: -1, radiusPx: 7, darknessWeight: 0.62, edgeWeight: 1.15 },
  { index: 13, dirX: 0, dirY: -1, radiusPx: 6, darknessWeight: 0.7, edgeWeight: 1.25 },
  { index: 14, dirX: 0, dirY: 1, radiusPx: 6, darknessWeight: 0.72, edgeWeight: 1.2 },
  { index: 17, dirX: 0, dirY: 1, radiusPx: 7, darknessWeight: 0.62, edgeWeight: 1.15 },
  { index: 37, dirX: -0.35, dirY: -1, radiusPx: 6, darknessWeight: 0.55, edgeWeight: 1.15 },
  { index: 267, dirX: 0.35, dirY: -1, radiusPx: 6, darknessWeight: 0.55, edgeWeight: 1.15 },
  { index: 84, dirX: -0.35, dirY: 1, radiusPx: 6, darknessWeight: 0.55, edgeWeight: 1.1 },
  { index: 314, dirX: 0.35, dirY: 1, radiusPx: 6, darknessWeight: 0.55, edgeWeight: 1.1 },
  { index: 91, dirX: -0.5, dirY: 0.85, radiusPx: 5, darknessWeight: 0.42, edgeWeight: 1.08 },
  { index: 321, dirX: 0.5, dirY: 0.85, radiusPx: 5, darknessWeight: 0.42, edgeWeight: 1.08 },
  { index: 40, dirX: -0.55, dirY: -0.8, radiusPx: 5, darknessWeight: 0.44, edgeWeight: 1.08 },
  { index: 270, dirX: 0.55, dirY: -0.8, radiusPx: 5, darknessWeight: 0.44, edgeWeight: 1.08 },
];

const DIRECTED_NOSE_REFINEMENT: DirectedRefinementSpec[] = [
  { index: 45, dirX: -1, dirY: 0.15, radiusPx: 5, darknessWeight: 0.6, edgeWeight: 1.15 },
  { index: 275, dirX: 1, dirY: 0.15, radiusPx: 5, darknessWeight: 0.6, edgeWeight: 1.15 },
  { index: 98, dirX: -0.85, dirY: 0.45, radiusPx: 4, darknessWeight: 0.58, edgeWeight: 1.1 },
  { index: 327, dirX: 0.85, dirY: 0.45, radiusPx: 4, darknessWeight: 0.58, edgeWeight: 1.1 },
  { index: 4, dirX: 0, dirY: 1, radiusPx: 4, darknessWeight: 0.3, edgeWeight: 1.0 },
  { index: 5, dirX: 0, dirY: 1, radiusPx: 4, darknessWeight: 0.28, edgeWeight: 0.96 },
];

const LIP_CONSTRAINT_PAIRS: Array<[number, number]> = [
  [0, 17],
  [13, 14],
  [37, 84],
  [39, 181],
  [40, 91],
  [267, 314],
  [269, 405],
  [270, 321],
];

export function createCvRefinementScratch(): CvRefinementScratch | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  return { canvas, ctx };
}

function gaussianWeight(distance: number, sigma: number) {
  return Math.exp(-(distance * distance) / Math.max(2 * sigma * sigma, 1e-6));
}

function computeLumaBuffer(imageData: ImageData) {
  const { data, width, height } = imageData;
  const luma = new Float32Array(width * height);
  for (let index = 0, pixel = 0; index < luma.length; index += 1, pixel += 4) {
    luma[index] = data[pixel] * 0.2126 + data[pixel + 1] * 0.7152 + data[pixel + 2] * 0.0722;
  }
  return { luma, width, height };
}

function sampleLuma(luma: Float32Array, width: number, height: number, x: number, y: number) {
  const ix = clamp(Math.round(x), 0, width - 1);
  const iy = clamp(Math.round(y), 0, height - 1);
  return luma[iy * width + ix] / 255;
}

function sampleGradientMagnitude(luma: Float32Array, width: number, height: number, x: number, y: number) {
  const ix = clamp(Math.round(x), 1, width - 2);
  const iy = clamp(Math.round(y), 1, height - 2);
  const index = iy * width + ix;
  const gx = luma[index + 1] - luma[index - 1];
  const gy = luma[index + width] - luma[index - width];
  return Math.sqrt(gx * gx + gy * gy) / 255;
}

function refineDirectedLandmarks(
  refined: FaceLandmarkPoint[],
  raw: FaceLandmarkPoint[],
  previous: FaceLandmarkPoint[] | null,
  luma: Float32Array,
  width: number,
  height: number,
  specs: DirectedRefinementSpec[],
) {
  let confidence = 0;

  for (const spec of specs) {
    const base = refined[spec.index] ?? raw[spec.index];
    if (!base) continue;

    const prev = previous?.[spec.index] ?? base;
    const baseX = base.x * width;
    const baseY = base.y * height;
    const prevX = prev.x * width;
    const prevY = prev.y * height;
    const dirLength = Math.hypot(spec.dirX, spec.dirY) || 1;
    const dirX = spec.dirX / dirLength;
    const dirY = spec.dirY / dirLength;
    const perpX = -dirY;
    const perpY = dirX;
    let bestScore = -Infinity;
    let bestX = baseX;
    let bestY = baseY;

    for (let along = -spec.radiusPx; along <= spec.radiusPx; along += 1) {
      for (let across = -2; across <= 2; across += 1) {
        const px = clamp(Math.round(baseX + dirX * along + perpX * across), 1, width - 2);
        const py = clamp(Math.round(baseY + dirY * along + perpY * across), 1, height - 2);
        const edge = sampleGradientMagnitude(luma, width, height, px, py);
        const darkness = 1 - sampleLuma(luma, width, height, px, py);
        const distBase = Math.hypot(px - baseX, py - baseY);
        const distPrev = Math.hypot(px - prevX, py - prevY);
        const score =
          edge * spec.edgeWeight +
          darkness * spec.darknessWeight +
          gaussianWeight(distBase, spec.radiusPx * 0.58) * 0.45 +
          gaussianWeight(distPrev, spec.radiusPx * 0.7) * 0.4;

        if (score > bestScore) {
          bestScore = score;
          bestX = px;
          bestY = py;
        }
      }
    }

    const refinedPoint = {
      ...base,
      x: clamp(bestX / width, raw[spec.index].x - CV_REFINEMENT_TUNING.maxOffsetNorm, raw[spec.index].x + CV_REFINEMENT_TUNING.maxOffsetNorm),
      y: clamp(bestY / height, raw[spec.index].y - CV_REFINEMENT_TUNING.maxOffsetNorm, raw[spec.index].y + CV_REFINEMENT_TUNING.maxOffsetNorm),
    };

    refined[spec.index] = previous?.[spec.index]
      ? {
          ...refinedPoint,
          x: smooth(previous[spec.index].x, refinedPoint.x, CV_REFINEMENT_TUNING.contourTemporalAlpha),
          y: smooth(previous[spec.index].y, refinedPoint.y, CV_REFINEMENT_TUNING.contourTemporalAlpha),
        }
      : refinedPoint;

    confidence += clamp(bestScore / 2.2, 0, 1);
  }

  return confidence / Math.max(specs.length, 1);
}

function enforceLipConstraints(refined: FaceLandmarkPoint[], raw: FaceLandmarkPoint[]) {
  const minGap = CV_REFINEMENT_TUNING.lipMinGapNorm;

  for (const [upperIndex, lowerIndex] of LIP_CONSTRAINT_PAIRS) {
    const upper = refined[upperIndex];
    const lower = refined[lowerIndex];
    if (!upper || !lower) continue;

    if (lower.y <= upper.y + minGap) {
      const center = (upper.y + lower.y) * 0.5;
      upper.y = center - minGap * 0.5;
      lower.y = center + minGap * 0.5;
    }
  }

  const leftCorner = refined[61];
  const rightCorner = refined[291];
  if (leftCorner && rightCorner && leftCorner.x >= rightCorner.x - 0.01) {
    const center = (leftCorner.x + rightCorner.x) * 0.5;
    leftCorner.x = center - 0.005;
    rightCorner.x = center + 0.005;
  }

  const upperCenter = refined[13];
  const lowerCenter = refined[14];
  const outerUpper = refined[0];
  const outerLower = refined[17];
  const noseBase = refined[4] ?? raw[4];

  if (upperCenter && noseBase) {
    upperCenter.y = Math.max(upperCenter.y, noseBase.y + 0.012);
  }

  if (lowerCenter && noseBase) {
    const rawLowerCenter = raw[14];
    lowerCenter.y = Math.max(lowerCenter.y, Math.max(noseBase.y + 0.03, (rawLowerCenter?.y ?? noseBase.y) - 0.004));
  }

  if (outerUpper && upperCenter) {
    outerUpper.y = Math.min(outerUpper.y, upperCenter.y + 0.01);
  }

  if (outerLower && lowerCenter) {
    outerLower.y = Math.max(outerLower.y, lowerCenter.y - 0.012);
  }

  return refined;
}

function refineLandmarkSet(
  refined: FaceLandmarkPoint[],
  raw: FaceLandmarkPoint[],
  previous: FaceLandmarkPoint[] | null,
  luma: Float32Array,
  width: number,
  height: number,
  indices: number[],
  radiusPx: number,
) {
  let confidence = 0;

  for (const index of indices) {
    const base = raw[index];
    if (!base) continue;

    const prev = previous?.[index] ?? base;
    const baseX = base.x * width;
    const baseY = base.y * height;
    const prevX = prev.x * width;
    const prevY = prev.y * height;
    let weightedX = 0;
    let weightedY = 0;
    let totalWeight = 0;
    let bestScore = 0;

    for (let dy = -radiusPx; dy <= radiusPx; dy += 1) {
      for (let dx = -radiusPx; dx <= radiusPx; dx += 1) {
        const px = clamp(Math.round(baseX + dx), 1, width - 2);
        const py = clamp(Math.round(baseY + dy), 1, height - 2);
        const distBase = Math.hypot(px - baseX, py - baseY);
        const distPrev = Math.hypot(px - prevX, py - prevY);
        const edge = sampleGradientMagnitude(luma, width, height, px, py);
        const score =
          edge * CV_REFINEMENT_TUNING.edgeWeight *
          gaussianWeight(distBase, radiusPx * CV_REFINEMENT_TUNING.baseWeight) *
          gaussianWeight(distPrev, radiusPx * CV_REFINEMENT_TUNING.temporalWeight);

        if (score <= 1e-5) continue;

        weightedX += px * score;
        weightedY += py * score;
        totalWeight += score;
        bestScore = Math.max(bestScore, score);
      }
    }

    if (totalWeight <= 1e-5) {
      refined[index] = base;
      continue;
    }

    const refinedX = weightedX / totalWeight;
    const refinedY = weightedY / totalWeight;
    const refinedPoint = {
      ...base,
      x: clamp(refinedX / width, base.x - CV_REFINEMENT_TUNING.maxOffsetNorm, base.x + CV_REFINEMENT_TUNING.maxOffsetNorm),
      y: clamp(refinedY / height, base.y - CV_REFINEMENT_TUNING.maxOffsetNorm, base.y + CV_REFINEMENT_TUNING.maxOffsetNorm),
    };

    refined[index] = previous?.[index]
      ? {
          ...refinedPoint,
          x: smooth(previous[index].x, refinedPoint.x, 0.52),
          y: smooth(previous[index].y, refinedPoint.y, 0.52),
        }
      : refinedPoint;

    confidence += clamp(bestScore * 4.2, 0, 1);
  }

  return confidence / Math.max(indices.length, 1);
}

export function refineLandmarksWithCV(
  video: HTMLVideoElement,
  landmarks: FaceLandmarkPoint[] | undefined,
  previous: FaceLandmarkPoint[] | null,
  scratch: CvRefinementScratch | null,
): CvRefinementResult {
  if (!landmarks || landmarks.length === 0 || !scratch || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return {
      refinedLandmarks: landmarks ? landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z })) : [],
      confidence: 0,
    };
  }

  const aspect = video.videoHeight / video.videoWidth;
  const width = CV_REFINEMENT_TUNING.analysisWidth;
  const height = Math.max(64, Math.round(width * aspect));
  scratch.canvas.width = width;
  scratch.canvas.height = height;
  scratch.ctx.drawImage(video, 0, 0, width, height);

  const imageData = scratch.ctx.getImageData(0, 0, width, height);
  const { luma } = computeLumaBuffer(imageData);
  const raw = landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z }));
  const refined = raw.map((point) => ({ ...point }));

  const mouthConfidence = refineLandmarkSet(
    refined,
    raw,
    previous,
    luma,
    width,
    height,
    [...CV_REFINEMENT_INDICES.mouth],
    CV_REFINEMENT_TUNING.mouthRadiusPx,
  );
  const noseConfidence = refineLandmarkSet(
    refined,
    raw,
    previous,
    luma,
    width,
    height,
    [...CV_REFINEMENT_INDICES.nose],
    CV_REFINEMENT_TUNING.noseRadiusPx,
  );

  const contourMouthConfidence = refineDirectedLandmarks(
    refined,
    raw,
    previous,
    luma,
    width,
    height,
    DIRECTED_MOUTH_REFINEMENT,
  );
  const contourNoseConfidence = refineDirectedLandmarks(
    refined,
    raw,
    previous,
    luma,
    width,
    height,
    DIRECTED_NOSE_REFINEMENT,
  );

  enforceLipConstraints(refined, raw);

  return {
    refinedLandmarks: refined,
    confidence: clamp(
      mouthConfidence * 0.34 + noseConfidence * 0.16 + contourMouthConfidence * 0.34 + contourNoseConfidence * 0.16,
      0,
      1,
    ),
  };
}
