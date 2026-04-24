import { MOUTH_BLENDSHAPE_KEYS } from './config';
import { clamp, remapRange } from './math';

const BLENDSHAPE_MAP: Record<string, string> = {
  eyeBlinkLeft: 'eyeBlink_L',
  eyeBlinkRight: 'eyeBlink_R',
  eyeSquintLeft: 'eyeSquint_L',
  eyeSquintRight: 'eyeSquint_R',
  eyeWideLeft: 'eyeWide_L',
  eyeWideRight: 'eyeWide_R',
  jawOpen: 'jawOpen',
  jawForward: 'jawForward',
  jawLeft: 'jawLeft',
  jawRight: 'jawRight',
  mouthClose: 'mouthClose',
  mouthLeft: 'mouthLeft',
  mouthRight: 'mouthRight',
  mouthSmileLeft: 'mouthSmile_L',
  mouthSmileRight: 'mouthSmile_R',
  mouthFrownLeft: 'mouthFrown_L',
  mouthFrownRight: 'mouthFrown_R',
  mouthStretchLeft: 'mouthStretch_L',
  mouthStretchRight: 'mouthStretch_R',
  mouthDimpleLeft: 'mouthDimple_L',
  mouthDimpleRight: 'mouthDimple_R',
  mouthFunnel: 'mouthFunnel',
  mouthPucker: 'mouthPucker',
  mouthPressLeft: 'mouthPress_L',
  mouthPressRight: 'mouthPress_R',
  mouthRollLower: 'mouthRollLower',
  mouthRollUpper: 'mouthRollUpper',
  mouthShrugLower: 'mouthShrugLower',
  mouthShrugUpper: 'mouthShrugUpper',
  mouthLowerDownLeft: 'mouthLowerDown_L',
  mouthLowerDownRight: 'mouthLowerDown_R',
  mouthUpperUpLeft: 'mouthUpperUp_L',
  mouthUpperUpRight: 'mouthUpperUp_R',
  browInnerUp: 'browInnerUp',
  browDownLeft: 'browDown_L',
  browDownRight: 'browDown_R',
  browOuterUpLeft: 'browOuterUp_L',
  browOuterUpRight: 'browOuterUp_R',
  cheekPuff: 'cheekPuff',
  cheekSquintLeft: 'cheekSquint_L',
  cheekSquintRight: 'cheekSquint_R',
  noseSneerLeft: 'noseSneer_L',
  noseSneerRight: 'noseSneer_R',
  tongueOut: 'tongueOut',
};

const BLENDSHAPE_GAIN: Partial<Record<string, number>> = {
  eyeBlink_L: 1.35,
  eyeBlink_R: 1.35,
  eyeSquint_L: 1.25,
  eyeSquint_R: 1.25,
  eyeWide_L: 1.25,
  eyeWide_R: 1.25,
  jawOpen: 1.55,
  jawForward: 1.2,
  jawLeft: 1.2,
  jawRight: 1.2,
  mouthClose: 1.2,
  mouthLeft: 1.2,
  mouthRight: 1.2,
  mouthSmile_L: 1.75,
  mouthSmile_R: 1.75,
  mouthFrown_L: 1.55,
  mouthFrown_R: 1.55,
  mouthStretch_L: 1.4,
  mouthStretch_R: 1.4,
  mouthDimple_L: 1.35,
  mouthDimple_R: 1.35,
  mouthFunnel: 1.45,
  mouthPucker: 1.55,
  mouthPress_L: 1.25,
  mouthPress_R: 1.25,
  mouthRollLower: 1.25,
  mouthRollUpper: 1.25,
  mouthShrugLower: 1.35,
  mouthShrugUpper: 1.35,
  mouthLowerDown_L: 1.35,
  mouthLowerDown_R: 1.35,
  mouthUpperUp_L: 1.35,
  mouthUpperUp_R: 1.35,
  browInnerUp: 1.45,
  browDown_L: 1.4,
  browDown_R: 1.4,
  browOuterUp_L: 1.35,
  browOuterUp_R: 1.35,
  cheekPuff: 1.45,
  cheekSquint_L: 1.35,
  cheekSquint_R: 1.35,
  noseSneer_L: 1.35,
  noseSneer_R: 1.35,
  tongueOut: 1.15,
};

const BLENDSHAPE_ACCUMULATORS: Record<string, Array<{ target: string; weight: number }>> = {
  cheekSquintLeft: [
    { target: 'noseSneer_L', weight: 0.65 },
    { target: 'cheekPuff', weight: 0.15 },
  ],
  cheekSquintRight: [
    { target: 'noseSneer_R', weight: 0.65 },
    { target: 'cheekPuff', weight: 0.15 },
  ],
};

export const TRACKED_BLENDSHAPE_KEYS = Array.from(
  new Set([
    ...Object.values(BLENDSHAPE_MAP),
    ...Object.values(BLENDSHAPE_ACCUMULATORS).flatMap((targets) => targets.map(({ target }) => target)),
  ]),
);

function suppressPair(values: Record<string, number>, a: string, b: string, overlap = 0.6) {
  const av = values[a] ?? 0;
  const bv = values[b] ?? 0;
  if (av <= 0 || bv <= 0) return;

  if (av >= bv) {
    values[b] = clamp(bv * (1 - av * overlap), 0, 1);
  } else {
    values[a] = clamp(av * (1 - bv * overlap), 0, 1);
  }
}

function clampPair(values: Record<string, number>, a: string, b: string, limit = 1) {
  const av = values[a] ?? 0;
  const bv = values[b] ?? 0;
  const total = av + bv;
  if (total <= limit || total <= 1e-6) return;

  const scale = limit / total;
  values[a] = av * scale;
  values[b] = bv * scale;
}

function swapChannels(values: Record<string, number>, left: string, right: string) {
  const leftValue = values[left] ?? 0;
  const rightValue = values[right] ?? 0;
  values[left] = rightValue;
  values[right] = leftValue;
}

export function normalizeMirroredFacialSemantics(values: Record<string, number>) {
  const next = { ...values };

  swapChannels(next, 'eyeBlink_L', 'eyeBlink_R');
  swapChannels(next, 'eyeSquint_L', 'eyeSquint_R');
  swapChannels(next, 'eyeWide_L', 'eyeWide_R');
  swapChannels(next, 'noseSneer_L', 'noseSneer_R');
  swapChannels(next, 'cheekSquint_L', 'cheekSquint_R');
  swapChannels(next, 'mouthSmile_L', 'mouthSmile_R');
  swapChannels(next, 'mouthFrown_L', 'mouthFrown_R');
  swapChannels(next, 'mouthStretch_L', 'mouthStretch_R');
  swapChannels(next, 'mouthDimple_L', 'mouthDimple_R');
  swapChannels(next, 'mouthPress_L', 'mouthPress_R');
  swapChannels(next, 'mouthLowerDown_L', 'mouthLowerDown_R');
  swapChannels(next, 'mouthUpperUp_L', 'mouthUpperUp_R');
  swapChannels(next, 'mouthLeft', 'mouthRight');
  swapChannels(next, 'jawLeft', 'jawRight');

  return next;
}

export function stabilizeMouthBlendshapes(values: Record<string, number>) {
  const next = { ...values };

  suppressPair(next, 'mouthSmile_L', 'mouthFrown_L', 0.85);
  suppressPair(next, 'mouthSmile_R', 'mouthFrown_R', 0.85);
  suppressPair(next, 'mouthLeft', 'mouthRight', 1.0);
  suppressPair(next, 'jawLeft', 'jawRight', 1.0);
  suppressPair(next, 'mouthPucker', 'mouthStretch_L', 0.8);
  suppressPair(next, 'mouthPucker', 'mouthStretch_R', 0.8);
  suppressPair(next, 'mouthPucker', 'mouthSmile_L', 0.7);
  suppressPair(next, 'mouthPucker', 'mouthSmile_R', 0.7);
  suppressPair(next, 'mouthPucker', 'mouthFrown_L', 0.65);
  suppressPair(next, 'mouthPucker', 'mouthFrown_R', 0.65);
  suppressPair(next, 'mouthClose', 'jawOpen', 1.0);

  clampPair(next, 'mouthSmile_L', 'mouthDimple_L', 1.0);
  clampPair(next, 'mouthSmile_R', 'mouthDimple_R', 1.0);
  clampPair(next, 'mouthPucker', 'mouthFunnel', 1.15);

  const jawOpen = next.jawOpen ?? 0;
  const smileStrength = Math.max(next.mouthSmile_L ?? 0, next.mouthSmile_R ?? 0);
  const stretchStrength = Math.max(next.mouthStretch_L ?? 0, next.mouthStretch_R ?? 0);
  const pressStrength = Math.max(next.mouthPress_L ?? 0, next.mouthPress_R ?? 0);
  const sealedSmile = clamp(
    Math.max(smileStrength, stretchStrength * 0.82) * remapRange((next.mouthClose ?? 0) + pressStrength * 0.55, 0.1, 0.9),
    0,
    1,
  );
  const mouthPucker = next.mouthPucker ?? 0;
  const mouthFunnel = next.mouthFunnel ?? 0;

  next.jawOpen = clamp(jawOpen * (1 - sealedSmile * 0.88), 0, 1);
  next.jawForward = clamp((next.jawForward ?? 0) * (1 - sealedSmile * 0.45), 0, 1);
  next.mouthLowerDown_L = clamp((next.mouthLowerDown_L ?? 0) * (1 - sealedSmile * 0.6), 0, 1);
  next.mouthLowerDown_R = clamp((next.mouthLowerDown_R ?? 0) * (1 - sealedSmile * 0.6), 0, 1);

  next.mouthRollLower = clamp((next.mouthRollLower ?? 0) * (1 - next.jawOpen * 0.45), 0, 1);
  next.mouthRollUpper = clamp((next.mouthRollUpper ?? 0) * (1 - next.jawOpen * 0.28), 0, 1);
  next.mouthPress_L = clamp((next.mouthPress_L ?? 0) * (1 - next.jawOpen * 0.55), 0, 1);
  next.mouthPress_R = clamp((next.mouthPress_R ?? 0) * (1 - next.jawOpen * 0.55), 0, 1);
  next.mouthClose = clamp((next.mouthClose ?? 0) * (1 - next.jawOpen * 0.8), 0, 1);
  next.mouthShrugLower = clamp((next.mouthShrugLower ?? 0) * (1 - next.jawOpen * 0.35), 0, 1);
  next.mouthUpperUp_L = clamp((next.mouthUpperUp_L ?? 0) * (1 - mouthPucker * 0.35), 0, 1);
  next.mouthUpperUp_R = clamp((next.mouthUpperUp_R ?? 0) * (1 - mouthPucker * 0.35), 0, 1);
  next.mouthStretch_L = clamp((next.mouthStretch_L ?? 0) * (1 - mouthPucker * 0.5), 0, 1);
  next.mouthStretch_R = clamp((next.mouthStretch_R ?? 0) * (1 - mouthPucker * 0.5), 0, 1);
  next.mouthLeft = clamp((next.mouthLeft ?? 0) * (1 - mouthFunnel * 0.35), 0, 1);
  next.mouthRight = clamp((next.mouthRight ?? 0) * (1 - mouthFunnel * 0.35), 0, 1);

  return next;
}

export function extractBlendshapes(categories: Array<{ categoryName: string; score: number }> | undefined) {
  const values: Record<string, number> = {};
  if (!categories) return values;

  for (const category of categories) {
    const mapped = BLENDSHAPE_MAP[category.categoryName];
    if (mapped) {
      const gain = BLENDSHAPE_GAIN[mapped] ?? 1;
      values[mapped] = Math.max(values[mapped] ?? 0, clamp(category.score * gain, 0, 1));
    }

    const accumulators = BLENDSHAPE_ACCUMULATORS[category.categoryName];
    if (accumulators) {
      for (const { target, weight } of accumulators) {
        const gain = BLENDSHAPE_GAIN[target] ?? 1;
        const nextValue = clamp(category.score * weight * gain, 0, 1);
        values[target] = clamp((values[target] ?? 0) + nextValue, 0, 1);
      }
    }
  }

  return values;
}
