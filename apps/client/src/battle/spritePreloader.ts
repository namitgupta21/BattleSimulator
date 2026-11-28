import { SpriteUrlResolver, type SpriteView } from "./SpriteUrlResolver.js";
import { ANIMATION_DURATIONS_MS, getAnimationSpeedMultiplier } from "./animationConfig.js";

const loadedSpriteUrls = new Set<string>();
const failedSpriteUrls = new Set<string>();

export function isSpriteUrlCached(url: string | undefined): boolean {
  return Boolean(url && loadedSpriteUrls.has(url));
}

export function markSpriteUrlLoaded(url: string): void {
  loadedSpriteUrls.add(url);
  failedSpriteUrls.delete(url);
}

export function markSpriteUrlFailed(url: string): void {
  failedSpriteUrls.add(url);
}

/**
 * Preloads sprites for specified Pokémon in the background.
 *
 * CRITICAL RULE:
 * Only preload the local player's full team at battle start,
 * and opponent Pokémon ONLY as the server reveals them (active at battle:start,
 * newly sent-out Pokémon at turn:result).
 * NEVER request sprites or icons for unrevealed opponent Pokémon!
 */
export function preloadPokemonSprites(
  pokemonList: Array<{ speciesId?: string; name?: string }>,
  options: {
    includeBack?: boolean;
    prefersReducedMotion?: boolean;
  } = {}
): void {
  if (typeof window === "undefined" || !pokemonList || pokemonList.length === 0) {
    return;
  }

  const includeBack = options.includeBack ?? false;
  const prefersReducedMotion = options.prefersReducedMotion ?? false;

  for (const poke of pokemonList) {
    const id = poke.speciesId || poke.name;
    if (!id) continue;

    // Preload front battle sprite candidate
    const frontCandidates = SpriteUrlResolver.getBattleSpriteCandidates(
      id,
      "front",
      prefersReducedMotion
    );
    if (frontCandidates[0] && !loadedSpriteUrls.has(frontCandidates[0])) {
      const img = new Image();
      img.onload = () => markSpriteUrlLoaded(frontCandidates[0]);
      img.onerror = () => markSpriteUrlFailed(frontCandidates[0]);
      img.src = frontCandidates[0];
    }

    // Preload back battle sprite candidate (for local player's team)
    if (includeBack) {
      const backCandidates = SpriteUrlResolver.getBattleSpriteCandidates(
        id,
        "back",
        prefersReducedMotion
      );
      if (backCandidates[0] && !loadedSpriteUrls.has(backCandidates[0])) {
        const img = new Image();
        img.onload = () => markSpriteUrlLoaded(backCandidates[0]);
        img.onerror = () => markSpriteUrlFailed(backCandidates[0]);
        img.src = backCandidates[0];
      }
    }

    // Preload party icon candidate
    const iconCandidates = SpriteUrlResolver.getPartyIconCandidates(id);
    if (iconCandidates[0] && !loadedSpriteUrls.has(iconCandidates[0])) {
      const img = new Image();
      img.onload = () => markSpriteUrlLoaded(iconCandidates[0]);
      img.onerror = () => markSpriteUrlFailed(iconCandidates[0]);
      img.src = iconCandidates[0];
    }
  }
}

/**
 * Waits for a revealed Pokémon's battle sprite (or static fallback) to become ready
 * before starting its entrance animation, bounded by a short timeout (~600ms).
 * Resolves immediately when speedMultiplier is 0 or running headless/non-browser.
 */
export function waitForPokemonSprite(
  poke: { speciesId?: string; name?: string },
  variant: SpriteView,
  options: {
    prefersReducedMotion?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<void> {
  if (typeof window === "undefined" || getAnimationSpeedMultiplier() <= 0) {
    return Promise.resolve();
  }

  const id = poke.speciesId || poke.name;
  if (!id) {
    return Promise.resolve();
  }

  const candidates = SpriteUrlResolver.getBattleSpriteCandidates(
    id,
    variant,
    options.prefersReducedMotion ?? false
  );

  if (candidates.length === 0 || candidates.some((u) => loadedSpriteUrls.has(u))) {
    return Promise.resolve();
  }

  const timeoutMs = options.timeoutMs ?? ANIMATION_DURATIONS_MS.spriteReadyTimeout;
  if (timeoutMs <= 0) {
    return Promise.resolve();
  }

  if (options.signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idx = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      options.signal?.removeEventListener("abort", finish);
      resolve();
    };

    options.signal?.addEventListener("abort", finish, { once: true });
    timer = setTimeout(finish, timeoutMs);

    const tryNext = () => {
      if (settled) return;
      if (idx >= candidates.length) {
        finish(); // Fallback badge is synchronous once candidates exhausted
        return;
      }
      const url = candidates[idx++];
      if (loadedSpriteUrls.has(url)) {
        finish();
        return;
      }
      if (failedSpriteUrls.has(url)) {
        tryNext();
        return;
      }
      const img = new Image();
      img.onload = () => {
        markSpriteUrlLoaded(url);
        finish();
      };
      img.onerror = () => {
        markSpriteUrlFailed(url);
        tryNext();
      };
      img.src = url;
    };

    tryNext();
  });
}
