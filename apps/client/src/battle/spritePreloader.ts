import { SpriteUrlResolver } from "./SpriteUrlResolver.js";

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
    if (frontCandidates[0]) {
      const img = new Image();
      img.src = frontCandidates[0];
    }

    // Preload back battle sprite candidate (for local player's team)
    if (includeBack) {
      const backCandidates = SpriteUrlResolver.getBattleSpriteCandidates(
        id,
        "back",
        prefersReducedMotion
      );
      if (backCandidates[0]) {
        const img = new Image();
        img.src = backCandidates[0];
      }
    }

    // Preload party icon candidate
    const iconCandidates = SpriteUrlResolver.getPartyIconCandidates(id);
    if (iconCandidates[0]) {
      const img = new Image();
      img.src = iconCandidates[0];
    }
  }
}
