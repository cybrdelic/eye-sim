import { MOUTH_BLENDSHAPE_KEYS, MOUTH_SOLVE_BLEND } from './config';
import { clamp, remapRange, smooth } from './math';
import type { FaceLandmarkPoint } from './types';

export interface MouthMetricSample {
  lipGapNorm: number;
  outerLipGapNorm: number;
  mouthWidthNorm: number;
  leftWidthNorm: number;
  rightWidthNorm: number;
  mouthCenterOffsetX: number;
  leftCornerLift: number;
  rightCornerLift: number;
  upperLipLift: number;
  lowerLipDrop: number;
  upperLipForward: number;
  lowerLipForward: number;
}

function readLandmark(result: FaceLandmarkPoint[] | undefined, index: number) {
  return result?.[index] ?? null;
}

function mixSolved(base: number, solved: number, weight: number) {
  return clamp(base * (1 - weight) + solved * weight, 0, 1);
}

export function sampleMouthMetrics(landmarks: FaceLandmarkPoint[] | undefined) {
  const leftCorner = readLandmark(landmarks, 61);
  const rightCorner = readLandmark(landmarks, 291);
  const upperLip = readLandmark(landmarks, 13);
  const lowerLip = readLandmark(landmarks, 14);
  const upperOuterLip = readLandmark(landmarks, 0);
  const lowerOuterLip = readLandmark(landmarks, 17);
  const noseTip = readLandmark(landmarks, 1);
  const chin = readLandmark(landmarks, 152);
  const leftEyeOuter = readLandmark(landmarks, 33);
  const rightEyeOuter = readLandmark(landmarks, 263);

  if (
    !leftCorner ||
    !rightCorner ||
    !upperLip ||
    !lowerLip ||
    !upperOuterLip ||
    !lowerOuterLip ||
    !noseTip ||
    !chin ||
    !leftEyeOuter ||
    !rightEyeOuter
  ) {
    return null;
  }

  const mouthCenterX = (leftCorner.x + rightCorner.x) * 0.5;
  const mouthCenterY = (upperLip.y + lowerLip.y) * 0.5;
  const mouthWidth = Math.max(Math.abs(rightCorner.x - leftCorner.x), 1e-5);
  const innerLipGap = Math.max(lowerLip.y - upperLip.y, 0);
  const outerLipGap = Math.max(lowerOuterLip.y - upperOuterLip.y, 0);
  const faceWidth = Math.max(Math.abs(rightEyeOuter.x - leftEyeOuter.x), 1e-5);
  const faceHeight = Math.max(chin.y - noseTip.y, 1e-5);
  const cornerDepth = ((leftCorner.z ?? 0) + (rightCorner.z ?? 0)) * 0.5;
  const upperLipDepth = ((upperLip.z ?? 0) + (upperOuterLip.z ?? 0)) * 0.5;
  const lowerLipDepth = ((lowerLip.z ?? 0) + (lowerOuterLip.z ?? 0)) * 0.5;

  return {
    lipGapNorm: innerLipGap / faceHeight,
    outerLipGapNorm: outerLipGap / faceHeight,
    mouthWidthNorm: mouthWidth / faceWidth,
    leftWidthNorm: (mouthCenterX - leftCorner.x) / faceWidth,
    rightWidthNorm: (rightCorner.x - mouthCenterX) / faceWidth,
    mouthCenterOffsetX: (mouthCenterX - noseTip.x) / faceWidth,
    leftCornerLift: (mouthCenterY - leftCorner.y) / faceHeight,
    rightCornerLift: (mouthCenterY - rightCorner.y) / faceHeight,
    upperLipLift: (upperOuterLip.y - noseTip.y) / faceHeight,
    lowerLipDrop: (chin.y - lowerOuterLip.y) / faceHeight,
    upperLipForward: cornerDepth - upperLipDepth,
    lowerLipForward: cornerDepth - lowerLipDepth,
  } satisfies MouthMetricSample;
}

export function isLikelyNeutralMouth(sample: MouthMetricSample, baseBlendshapes: Record<string, number>) {
  return (
    sample.lipGapNorm < 0.04 &&
    Math.abs(sample.leftCornerLift) < 0.035 &&
    Math.abs(sample.rightCornerLift) < 0.035 &&
    Math.abs(sample.mouthCenterOffsetX) < 0.03 &&
    (baseBlendshapes.jawOpen ?? 0) < 0.18 &&
    (baseBlendshapes.mouthSmile_L ?? 0) < 0.24 &&
    (baseBlendshapes.mouthSmile_R ?? 0) < 0.24 &&
    (baseBlendshapes.mouthPucker ?? 0) < 0.22 &&
    (baseBlendshapes.mouthFunnel ?? 0) < 0.22
  );
}

export function updateMouthNeutralBaseline(
  current: MouthMetricSample | null,
  sample: MouthMetricSample,
  shouldAdapt: boolean,
) {
  if (!current) {
    return sample;
  }

  const alpha = shouldAdapt ? 0.045 : 0.006;
  return {
    lipGapNorm: smooth(current.lipGapNorm, sample.lipGapNorm, alpha),
    outerLipGapNorm: smooth(current.outerLipGapNorm, sample.outerLipGapNorm, alpha),
    mouthWidthNorm: smooth(current.mouthWidthNorm, sample.mouthWidthNorm, alpha),
    leftWidthNorm: smooth(current.leftWidthNorm, sample.leftWidthNorm, alpha),
    rightWidthNorm: smooth(current.rightWidthNorm, sample.rightWidthNorm, alpha),
    mouthCenterOffsetX: smooth(current.mouthCenterOffsetX, sample.mouthCenterOffsetX, alpha),
    leftCornerLift: smooth(current.leftCornerLift, sample.leftCornerLift, alpha),
    rightCornerLift: smooth(current.rightCornerLift, sample.rightCornerLift, alpha),
    upperLipLift: smooth(current.upperLipLift, sample.upperLipLift, alpha),
    lowerLipDrop: smooth(current.lowerLipDrop, sample.lowerLipDrop, alpha),
    upperLipForward: smooth(current.upperLipForward, sample.upperLipForward, alpha),
    lowerLipForward: smooth(current.lowerLipForward, sample.lowerLipForward, alpha),
  };
}

function extractMouthLandmarkBlendshapes(sample: MouthMetricSample | null, neutral: MouthMetricSample | null) {
  if (!sample || !neutral) {
    return {} as Record<string, number>;
  }

  const lipGapDelta = sample.lipGapNorm - neutral.lipGapNorm;
  const outerLipGapDelta = sample.outerLipGapNorm - neutral.outerLipGapNorm;
  const widthDelta = sample.mouthWidthNorm - neutral.mouthWidthNorm;
  const leftWidthDelta = sample.leftWidthNorm - neutral.leftWidthNorm;
  const rightWidthDelta = sample.rightWidthNorm - neutral.rightWidthNorm;
  const centerOffsetDelta = sample.mouthCenterOffsetX - neutral.mouthCenterOffsetX;
  const leftCornerLiftDelta = sample.leftCornerLift - neutral.leftCornerLift;
  const rightCornerLiftDelta = sample.rightCornerLift - neutral.rightCornerLift;
  const upperLipLiftDelta = neutral.upperLipLift - sample.upperLipLift;
  const lowerLipDropDelta = neutral.lowerLipDrop - sample.lowerLipDrop;
  const upperLipForwardDelta = sample.upperLipForward - neutral.upperLipForward;
  const lowerLipForwardDelta = sample.lowerLipForward - neutral.lowerLipForward;
  const lowerLipBulgeDelta = Math.max(0, lowerLipForwardDelta - Math.max(upperLipForwardDelta, 0) * 0.45);

  const smileLeft = remapRange(leftCornerLiftDelta, 0.004, 0.045);
  const smileRight = remapRange(rightCornerLiftDelta, 0.004, 0.045);
  const frownLeft = remapRange(-leftCornerLiftDelta, 0.004, 0.04);
  const frownRight = remapRange(-rightCornerLiftDelta, 0.004, 0.04);
  const mouthStretch = remapRange(widthDelta, 0.01, 0.08);
  const mouthStretchLeft = remapRange(leftWidthDelta, 0.006, 0.055);
  const mouthStretchRight = remapRange(rightWidthDelta, 0.006, 0.055);
  const smileStrength = Math.max(smileLeft, smileRight);
  const smileSeal = clamp(
    Math.max(smileStrength, mouthStretch * 0.82, Math.max(mouthStretchLeft, mouthStretchRight) * 0.74)
      * remapRange(-outerLipGapDelta, -0.001, 0.014),
    0,
    1,
  );
  const rawJawOpen = remapRange(lipGapDelta, 0.004, 0.075);
  const jawOpen = clamp(rawJawOpen * (1 - smileSeal * 0.78), 0, 1);
  const mouthNarrow = remapRange(-widthDelta, 0.008, 0.06);
  const mouthPressBase =
    remapRange(-outerLipGapDelta, 0.002, 0.022) *
    remapRange(sample.mouthWidthNorm, neutral.mouthWidthNorm - 0.02, neutral.mouthWidthNorm + 0.05);
  const lowerLipBulge =
    remapRange(lowerLipBulgeDelta, 0.0015, 0.022) *
    Math.max(
      mouthPressBase * 1.15,
      remapRange(-lipGapDelta, -0.001, 0.016),
      remapRange(-outerLipGapDelta, -0.0005, 0.016),
      remapRange(Math.max(sample.lowerLipForward, neutral.lowerLipForward) - sample.upperLipForward, 0.001, 0.02) * 0.9,
    ) *
    (1 - jawOpen * 0.78);
  const mouthPressLeft = mouthPressBase * remapRange(-rightWidthDelta, 0.0, 0.03);
  const mouthPressRight = mouthPressBase * remapRange(-leftWidthDelta, 0.0, 0.03);
  const mouthClose = clamp(
    Math.max(
      remapRange(-lipGapDelta, 0.002, 0.02) * remapRange(sample.mouthWidthNorm, neutral.mouthWidthNorm - 0.02, neutral.mouthWidthNorm + 0.05),
      lowerLipBulge * 0.35,
    ),
    0,
    1,
  );
  const upperUp = remapRange(upperLipLiftDelta, 0.006, 0.03);
  const lowerDown = remapRange(lowerLipDropDelta, 0.014, 0.05) * remapRange(jawOpen, 0.14, 0.8) * (1 - lowerLipBulge * 0.72);
  const mouthLeft = remapRange(centerOffsetDelta, 0.004, 0.04);
  const mouthRight = remapRange(-centerOffsetDelta, 0.004, 0.04);
  const jawLeft = remapRange(centerOffsetDelta, 0.008, 0.05) * remapRange(jawOpen, 0.08, 0.7);
  const jawRight = remapRange(-centerOffsetDelta, 0.008, 0.05) * remapRange(jawOpen, 0.08, 0.7);
  const jawForward = mouthNarrow * remapRange(lipGapDelta, -0.002, 0.028);
  const pucker = mouthNarrow * remapRange(sample.lipGapNorm, neutral.lipGapNorm - 0.004, neutral.lipGapNorm + 0.025);
  const funnel = mouthNarrow * remapRange(lipGapDelta, 0.004, 0.05);
  const dimpleLeft = remapRange(smileLeft * Math.max(mouthStretchLeft, mouthStretch * 0.7), 0.08, 0.42);
  const dimpleRight = remapRange(smileRight * Math.max(mouthStretchRight, mouthStretch * 0.7), 0.08, 0.42);
  const lowerRoll = clamp(Math.max(remapRange(mouthPressBase * (1 - jawOpen), 0.22, 0.78), lowerLipBulge * 0.92), 0, 1);
  const upperRoll = remapRange(mouthPressBase * (1 - Math.max(smileLeft, smileRight) * 0.4), 0.18, 0.64);
  const shrugUpper = remapRange(upperLipLiftDelta, 0.004, 0.018) * (1 - jawOpen * 0.55);
  const shrugLower = remapRange(-lowerLipDropDelta, 0.002, 0.02) * (1 - jawOpen * 0.75) * (1 - lowerLipBulge * 0.88);
  const tongueOut = clamp(
    lowerLipBulge *
      Math.max(
        remapRange(-lipGapDelta, -0.001, 0.012),
        remapRange(mouthClose + mouthPressBase, 0.12, 0.78) * 0.9,
      ) *
      0.48,
    0,
    0.6,
  );
  const upperUpLeft = upperUp * remapRange(rightCornerLiftDelta + 0.018, 0.0, 0.05);
  const upperUpRight = upperUp * remapRange(leftCornerLiftDelta + 0.018, 0.0, 0.05);
  const lowerDownLeft = lowerDown * remapRange(rightWidthDelta + 0.018, 0.0, 0.06);
  const lowerDownRight = lowerDown * remapRange(leftWidthDelta + 0.018, 0.0, 0.06);

  return {
    jawOpen,
    jawForward,
    mouthClose,
    mouthLeft,
    mouthRight,
    jawLeft,
    jawRight,
    mouthSmile_L: smileLeft,
    mouthSmile_R: smileRight,
    mouthFrown_L: frownLeft,
    mouthFrown_R: frownRight,
    mouthStretch_L: Math.max(mouthStretchLeft, mouthStretch * 0.72),
    mouthStretch_R: Math.max(mouthStretchRight, mouthStretch * 0.72),
    mouthDimple_L: dimpleLeft,
    mouthDimple_R: dimpleRight,
    mouthPucker: pucker,
    mouthFunnel: funnel,
    mouthPress_L: mouthPressLeft,
    mouthPress_R: mouthPressRight,
    mouthRollLower: lowerRoll,
    mouthRollUpper: upperRoll,
    mouthShrugUpper: shrugUpper,
    mouthShrugLower: shrugLower,
    mouthUpperUp_L: upperUpLeft,
    mouthUpperUp_R: upperUpRight,
    mouthLowerDown_L: lowerDownLeft,
    mouthLowerDown_R: lowerDownRight,
    tongueOut,
  };
}

export function solveMouthRetarget(
  base: Record<string, number>,
  sample: MouthMetricSample | null,
  neutral: MouthMetricSample | null,
) {
  if (!sample || !neutral) {
    return base;
  }

  const supplemental = extractMouthLandmarkBlendshapes(sample, neutral);
  const next = { ...base };

  const smileSeal = clamp(
    Math.max(supplemental.mouthSmile_L ?? 0, supplemental.mouthSmile_R ?? 0, supplemental.mouthStretch_L ?? 0, supplemental.mouthStretch_R ?? 0)
      * remapRange((supplemental.mouthClose ?? 0) + ((supplemental.mouthPress_L ?? 0) + (supplemental.mouthPress_R ?? 0)) * 0.35, 0.12, 0.85),
    0,
    1,
  );

  const jawOpenSolved = clamp(
    Math.max(
      (supplemental.jawOpen ?? 0) * (1 - smileSeal * 0.72),
      clamp((base.jawOpen ?? 0) * (1 - smileSeal * 0.65) * 0.82 + (supplemental.jawOpen ?? 0) * 0.58, 0, 1),
    ),
    0,
    1,
  );

  const smileLeftSolved = Math.max(supplemental.mouthSmile_L ?? 0, (base.mouthSmile_L ?? 0) * 0.9);
  const smileRightSolved = Math.max(supplemental.mouthSmile_R ?? 0, (base.mouthSmile_R ?? 0) * 0.9);
  const frownLeftSolved = Math.max(supplemental.mouthFrown_L ?? 0, (base.mouthFrown_L ?? 0) * 0.85);
  const frownRightSolved = Math.max(supplemental.mouthFrown_R ?? 0, (base.mouthFrown_R ?? 0) * 0.85);
  const stretchLeftSolved = Math.max(supplemental.mouthStretch_L ?? 0, (base.mouthStretch_L ?? 0) * 0.72);
  const stretchRightSolved = Math.max(supplemental.mouthStretch_R ?? 0, (base.mouthStretch_R ?? 0) * 0.72);
  const narrowSolved = Math.max(supplemental.mouthPucker ?? 0, supplemental.mouthFunnel ?? 0);
  const mouthCloseSolved = clamp(
    Math.max(supplemental.mouthClose ?? 0, (base.mouthClose ?? 0) * 0.75) * (1 - jawOpenSolved * 0.88),
    0,
    1,
  );
  const pressLeftSolved = clamp(
    Math.max(supplemental.mouthPress_L ?? 0, (base.mouthPress_L ?? 0) * 0.72) * (1 - jawOpenSolved * 0.52),
    0,
    1,
  );
  const pressRightSolved = clamp(
    Math.max(supplemental.mouthPress_R ?? 0, (base.mouthPress_R ?? 0) * 0.72) * (1 - jawOpenSolved * 0.52),
    0,
    1,
  );
  const upperUpLeftSolved = clamp(
    Math.max(supplemental.mouthUpperUp_L ?? 0, (base.mouthUpperUp_L ?? 0) * 0.5) * (1 - narrowSolved * 0.28),
    0,
    1,
  );
  const upperUpRightSolved = clamp(
    Math.max(supplemental.mouthUpperUp_R ?? 0, (base.mouthUpperUp_R ?? 0) * 0.5) * (1 - narrowSolved * 0.28),
    0,
    1,
  );
  const lowerDownLeftSolved = clamp(
    Math.max(supplemental.mouthLowerDown_L ?? 0, (base.mouthLowerDown_L ?? 0) * 0.35) * remapRange(jawOpenSolved, 0.12, 0.72),
    0,
    1,
  );
  const lowerDownRightSolved = clamp(
    Math.max(supplemental.mouthLowerDown_R ?? 0, (base.mouthLowerDown_R ?? 0) * 0.35) * remapRange(jawOpenSolved, 0.12, 0.72),
    0,
    1,
  );
  const shrugUpperSolved = clamp(
    Math.max(supplemental.mouthShrugUpper ?? 0, (base.mouthShrugUpper ?? 0) * 0.58) * (1 - jawOpenSolved * 0.48),
    0,
    1,
  );
  const shrugLowerSolved = clamp(
    Math.max(supplemental.mouthShrugLower ?? 0, (base.mouthShrugLower ?? 0) * 0.52) * (1 - jawOpenSolved * 0.68),
    0,
    1,
  );
  const rollLowerSolved = clamp(
    Math.max(supplemental.mouthRollLower ?? 0, (base.mouthRollLower ?? 0) * 0.45) * (1 - jawOpenSolved * 0.62),
    0,
    1,
  );
  const rollUpperSolved = clamp(
    Math.max(supplemental.mouthRollUpper ?? 0, (base.mouthRollUpper ?? 0) * 0.52) * (1 - Math.max(smileLeftSolved, smileRightSolved) * 0.35),
    0,
    1,
  );
  const tongueOutSolved = clamp(
    Math.max(supplemental.tongueOut ?? 0, (base.tongueOut ?? 0) * 0.4) * (1 - jawOpenSolved * 0.55),
    0,
    0.6,
  );

  const solvedValues: Partial<Record<string, number>> = {
    jawOpen: jawOpenSolved,
    jawForward: Math.max(supplemental.jawForward ?? 0, (base.jawForward ?? 0) * 0.8),
    jawLeft: Math.max(supplemental.jawLeft ?? 0, (base.jawLeft ?? 0) * 0.8),
    jawRight: Math.max(supplemental.jawRight ?? 0, (base.jawRight ?? 0) * 0.8),
    mouthClose: mouthCloseSolved,
    mouthLeft: Math.max(supplemental.mouthLeft ?? 0, (base.mouthLeft ?? 0) * 0.82),
    mouthRight: Math.max(supplemental.mouthRight ?? 0, (base.mouthRight ?? 0) * 0.82),
    mouthSmile_L: smileLeftSolved,
    mouthSmile_R: smileRightSolved,
    mouthFrown_L: frownLeftSolved,
    mouthFrown_R: frownRightSolved,
    mouthStretch_L: stretchLeftSolved,
    mouthStretch_R: stretchRightSolved,
    mouthDimple_L: Math.max(supplemental.mouthDimple_L ?? 0, smileLeftSolved * 0.42, (base.mouthDimple_L ?? 0) * 0.7),
    mouthDimple_R: Math.max(supplemental.mouthDimple_R ?? 0, smileRightSolved * 0.42, (base.mouthDimple_R ?? 0) * 0.7),
    mouthFunnel: Math.max(supplemental.mouthFunnel ?? 0, (base.mouthFunnel ?? 0) * 0.78),
    mouthPucker: Math.max(supplemental.mouthPucker ?? 0, (base.mouthPucker ?? 0) * 0.82),
    mouthPress_L: pressLeftSolved,
    mouthPress_R: pressRightSolved,
    mouthRollLower: rollLowerSolved,
    mouthRollUpper: rollUpperSolved,
    mouthShrugLower: shrugLowerSolved,
    mouthShrugUpper: shrugUpperSolved,
    mouthLowerDown_L: lowerDownLeftSolved,
    mouthLowerDown_R: lowerDownRightSolved,
    mouthUpperUp_L: upperUpLeftSolved,
    mouthUpperUp_R: upperUpRightSolved,
    tongueOut: tongueOutSolved,
  };

  for (const key of MOUTH_BLENDSHAPE_KEYS) {
    const solved = solvedValues[key] ?? next[key] ?? 0;
    const weight = MOUTH_SOLVE_BLEND[key] ?? 0.7;
    next[key] = mixSolved(next[key] ?? 0, solved, weight);
  }

  return next;
}
