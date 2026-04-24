import { MICRODETAIL_CHANNELS, MOUTH_BLENDSHAPE_KEYS, STABILITY_TUNING } from './config';
import { clamp, smoothStable } from './math';

export function smoothBlendshape(name: string, current: number, target: number) {
  const delta = target - current;
  const microWeight = MICRODETAIL_CHANNELS[name] ?? 0;
  const isMicroMotion = Math.abs(delta) <= 0.12;
  const isMouth = MOUTH_BLENDSHAPE_KEYS.has(name);
  const baseAlpha = isMouth ? 0.32 : 0.46;
  const alpha = microWeight > 0 ? (isMicroMotion ? (isMouth ? 0.4 : 0.56) : Math.max(baseAlpha, isMouth ? 0.38 : 0.5)) : baseAlpha;
  const deadzone = isMouth ? STABILITY_TUNING.mouthBlendshapeDeadzone : STABILITY_TUNING.blendshapeDeadzone;
  const base = smoothStable(current, target, alpha, deadzone);

  if (microWeight <= 0 || !isMicroMotion) {
    return clamp(base, 0, 1);
  }

  const microBoost = clamp(delta * microWeight, -0.015, 0.015);
  return clamp(base + microBoost, 0, 1);
}
