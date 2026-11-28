export const ANIMATION_DURATIONS_MS = {
  entrance: 400,
  switchOut: 200,
  hit: 250,
  moveBeat: 300,
  faint: 500,
  reducedMotionFade: 100,
  spriteReadyTimeout: 600,
} as const;

export type SpriteAnimationState = "entering" | "idle" | "leaving" | "fainted";

function readInitialSpeedMultiplier(): number {
  if (typeof window === "undefined") return 1;
  const globalVal = (window as unknown as { __POKEMON_ANIM_SPEED__?: unknown }).__POKEMON_ANIM_SPEED__;
  if (typeof globalVal === "number" && Number.isFinite(globalVal) && globalVal >= 0) {
    return globalVal;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get("animSpeed");
    if (paramVal !== null) {
      const parsed = Number(paramVal);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore malformed search params in non-browser test environments
  }
  return 1;
}

let speedMultiplier: number = readInitialSpeedMultiplier();
let lastReducedMotion = false;

export function getAnimationSpeedMultiplier(): number {
  return speedMultiplier;
}

export function setAnimationSpeedMultiplier(mult: number): void {
  speedMultiplier = Number.isFinite(mult) && mult >= 0 ? mult : 1;
  syncAnimationCssVariables(lastReducedMotion, speedMultiplier);
}

export function getEffectiveDurationMs(
  baseMs: number,
  prefersReducedMotion: boolean,
  multiplier: number = speedMultiplier
): number {
  if (multiplier <= 0 || baseMs <= 0) {
    return 0;
  }
  if (prefersReducedMotion) {
    return Math.max(0, Math.round(ANIMATION_DURATIONS_MS.reducedMotionFade * multiplier));
  }
  return Math.max(0, Math.round(baseMs * multiplier));
}

export function getSpriteReadyTimeoutMs(
  prefersReducedMotion: boolean,
  multiplier: number = speedMultiplier
): number {
  if (multiplier <= 0) {
    return 0;
  }
  if (prefersReducedMotion) {
    return Math.min(
      ANIMATION_DURATIONS_MS.spriteReadyTimeout,
      Math.max(100, Math.round(ANIMATION_DURATIONS_MS.spriteReadyTimeout * multiplier))
    );
  }
  return Math.max(0, Math.round(ANIMATION_DURATIONS_MS.spriteReadyTimeout * multiplier));
}

export function syncAnimationCssVariables(
  prefersReducedMotion: boolean,
  multiplier: number = speedMultiplier
): void {
  lastReducedMotion = prefersReducedMotion;
  if (typeof document === "undefined" || !document.documentElement) {
    return;
  }
  const root = document.documentElement.style;
  root.setProperty(
    "--entrance-ms",
    `${getEffectiveDurationMs(ANIMATION_DURATIONS_MS.entrance, prefersReducedMotion, multiplier)}ms`
  );
  root.setProperty(
    "--switch-out-ms",
    `${getEffectiveDurationMs(ANIMATION_DURATIONS_MS.switchOut, prefersReducedMotion, multiplier)}ms`
  );
  root.setProperty(
    "--hit-ms",
    `${prefersReducedMotion ? 0 : getEffectiveDurationMs(ANIMATION_DURATIONS_MS.hit, false, multiplier)}ms`
  );
  root.setProperty(
    "--faint-ms",
    `${getEffectiveDurationMs(ANIMATION_DURATIONS_MS.faint, prefersReducedMotion, multiplier)}ms`
  );
  const reducedMs =
    multiplier <= 0 ? 0 : Math.max(0, Math.round(ANIMATION_DURATIONS_MS.reducedMotionFade * multiplier));
  root.setProperty("--reduced-fade-ms", `${reducedMs}ms`);
  root.setProperty(
    "--hp-transition-ms",
    `${getEffectiveDurationMs(ANIMATION_DURATIONS_MS.faint, prefersReducedMotion, multiplier)}ms`
  );
}
