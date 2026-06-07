export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampToStep(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
    return clamp(value, min, max);
  }

  return clamp(Math.round(value / step) * step, min, max);
}
