export type MouthSafetyProfile = {
  jawOpenMax: number;
  smileMax: number;
  stretchMax: number;
  lipRaiseMax: number;
  lipDropMax: number;
  puckerMax: number;
  funnelMax: number;
  tongueOutMax: number;
  dentalExposureMax: number;
  closedMouthBias: number;
  description: string;
};

export const DEFAULT_MOUTH_SAFETY_PROFILE: MouthSafetyProfile = {
  jawOpenMax: 0.34,
  smileMax: 0.42,
  stretchMax: 0.34,
  lipRaiseMax: 0.12,
  lipDropMax: 0.15,
  puckerMax: 0.38,
  funnelMax: 0.34,
  tongueOutMax: 0.02,
  dentalExposureMax: 0.26,
  closedMouthBias: 0.08,
  description: 'Keep the current Facecap mouth interior out of extreme expression ranges.',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function attenuateAbove(value: number, safeMax: number, softness: number) {
  if (value <= safeMax) return value;
  return safeMax + (value - safeMax) * softness;
}

function limitChannel(values: Record<string, number>, key: string, max: number) {
  values[key] = clamp(values[key] ?? 0, 0, max);
}

function attenuateChannel(values: Record<string, number>, key: string, safeMax: number, softness: number) {
  values[key] = clamp(attenuateAbove(values[key] ?? 0, safeMax, softness), 0, 1);
}

export function applyMouthSafetyProfile<T extends Record<string, number>>(
  values: T,
  profile: MouthSafetyProfile = DEFAULT_MOUTH_SAFETY_PROFILE,
) {
  const next = { ...values } as Record<string, number>;

  limitChannel(next, 'jawOpen', profile.jawOpenMax);
  limitChannel(next, 'jawForward', 0.12);
  limitChannel(next, 'jawLeft', 0.18);
  limitChannel(next, 'jawRight', 0.18);
  limitChannel(next, 'mouthSmile_L', profile.smileMax);
  limitChannel(next, 'mouthSmile_R', profile.smileMax);
  limitChannel(next, 'mouthStretch_L', profile.stretchMax);
  limitChannel(next, 'mouthStretch_R', profile.stretchMax);
  limitChannel(next, 'mouthDimple_L', profile.smileMax * 0.62);
  limitChannel(next, 'mouthDimple_R', profile.smileMax * 0.62);
  limitChannel(next, 'mouthUpperUp_L', profile.lipRaiseMax);
  limitChannel(next, 'mouthUpperUp_R', profile.lipRaiseMax);
  limitChannel(next, 'mouthLowerDown_L', profile.lipDropMax);
  limitChannel(next, 'mouthLowerDown_R', profile.lipDropMax);
  limitChannel(next, 'mouthShrugUpper', profile.lipRaiseMax);
  limitChannel(next, 'mouthShrugLower', profile.lipDropMax);
  limitChannel(next, 'mouthRollUpper', Math.max(profile.lipRaiseMax, 0.12));
  limitChannel(next, 'mouthRollLower', Math.max(profile.lipDropMax, 0.14));
  limitChannel(next, 'mouthPucker', profile.puckerMax);
  limitChannel(next, 'mouthFunnel', profile.funnelMax);
  limitChannel(next, 'tongueOut', profile.tongueOutMax);

  const dentalExposure = Math.max(
    next.jawOpen ?? 0,
    next.mouthUpperUp_L ?? 0,
    next.mouthUpperUp_R ?? 0,
    next.mouthLowerDown_L ?? 0,
    next.mouthLowerDown_R ?? 0,
    (next.mouthFunnel ?? 0) * 0.72,
  );
  const dentalRisk = clamp((dentalExposure - profile.dentalExposureMax) / Math.max(1 - profile.dentalExposureMax, 1e-5), 0, 1);

  if (dentalRisk > 0) {
    const lipOcclusion = 1 - dentalRisk * 0.44;
    next.mouthUpperUp_L = (next.mouthUpperUp_L ?? 0) * lipOcclusion;
    next.mouthUpperUp_R = (next.mouthUpperUp_R ?? 0) * lipOcclusion;
    next.mouthLowerDown_L = (next.mouthLowerDown_L ?? 0) * lipOcclusion;
    next.mouthLowerDown_R = (next.mouthLowerDown_R ?? 0) * lipOcclusion;
    next.mouthClose = Math.max(next.mouthClose ?? 0, dentalRisk * profile.closedMouthBias);
  }

  const smileStrength = Math.max(next.mouthSmile_L ?? 0, next.mouthSmile_R ?? 0);
  const openWhileSmiling = (next.jawOpen ?? 0) * smileStrength;
  if (openWhileSmiling > 0.06) {
    const smileOpenRisk = clamp((openWhileSmiling - 0.06) / 0.22, 0, 1);
    next.jawOpen = (next.jawOpen ?? 0) * (1 - smileOpenRisk * 0.32);
    next.mouthLowerDown_L = (next.mouthLowerDown_L ?? 0) * (1 - smileOpenRisk * 0.38);
    next.mouthLowerDown_R = (next.mouthLowerDown_R ?? 0) * (1 - smileOpenRisk * 0.38);
  }

  attenuateChannel(next, 'mouthFrown_L', profile.smileMax * 0.72, 0.36);
  attenuateChannel(next, 'mouthFrown_R', profile.smileMax * 0.72, 0.36);

  return next as T;
}
