export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function smooth(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

export function smoothStable(current: number, target: number, alpha: number, deadzone: number) {
  const delta = target - current;
  if (Math.abs(delta) <= deadzone) {
    return current;
  }

  const normalizedDelta = delta > 0 ? delta - deadzone : delta + deadzone;
  return current + normalizedDelta * alpha;
}

export function remapRange(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}
