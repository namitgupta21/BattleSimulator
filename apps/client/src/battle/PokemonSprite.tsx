import React, { useEffect, useState } from "react";
import { SpriteUrlResolver, type SpriteView } from "./SpriteUrlResolver.js";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";
import {
  type SpriteAnimationState,
  syncAnimationCssVariables,
} from "./animationConfig.js";
import {
  isSpriteUrlCached,
  markSpriteUrlFailed,
  markSpriteUrlLoaded,
} from "./spritePreloader.js";

export type { SpriteAnimationState };

interface PokemonSpriteProps {
  speciesId: string;
  name: string;
  variant: SpriteView;
  side?: "player" | "opponent";
  animationState?: SpriteAnimationState;
  isHit?: boolean;
  isFainted?: boolean;
  onReady?: () => void;
  className?: string;
}

export const PokemonSprite: React.FC<PokemonSpriteProps> = ({
  speciesId,
  name,
  variant,
  side,
  animationState = "idle",
  isHit = false,
  isFainted = false,
  onReady,
  className = "",
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedSide = side ?? (variant === "back" ? "player" : "opponent");

  const dexId = SpriteUrlResolver.resolveDexId(speciesId || name);

  // Candidate URLs driven by SpriteUrlResolver (respects prefersReducedMotion live)
  const candidateUrls = SpriteUrlResolver.getBattleSpriteCandidates(
    dexId,
    variant,
    prefersReducedMotion
  );

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(() => isSpriteUrlCached(candidateUrls[0]));

  useEffect(() => {
    syncAnimationCssVariables(prefersReducedMotion);
  }, [prefersReducedMotion]);

  useEffect(() => {
    setCandidateIndex(0);
    setLoadError(false);
    const firstUrl = candidateUrls[0];
    const cached = isSpriteUrlCached(firstUrl);
    setLoaded(cached);
    if (cached) {
      onReady?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesId, name, variant, prefersReducedMotion]);

  const currentUrl = candidateUrls[candidateIndex];

  useEffect(() => {
    if (loadError || !currentUrl) {
      onReady?.();
    }
  }, [loadError, currentUrl, onReady]);

  const handleImageError = () => {
    if (currentUrl) {
      markSpriteUrlFailed(currentUrl);
    }
    if (candidateIndex < candidateUrls.length - 1) {
      // Step down to next fallback candidate in cascade
      const nextIdx = candidateIndex + 1;
      setCandidateIndex(nextIdx);
      const nextUrl = candidateUrls[nextIdx];
      if (isSpriteUrlCached(nextUrl)) {
        setLoaded(true);
        onReady?.();
      }
    } else {
      // All sprite image candidates exhausted -> fall back to original LCD badge
      setLoadError(true);
    }
  };

  const handleImageLoad = () => {
    if (currentUrl) {
      markSpriteUrlLoaded(currentUrl);
    }
    setLoaded(true);
    onReady?.();
  };

  const animClass =
    animationState === "entering"
      ? resolvedSide === "player"
        ? "sprite-anim-entering-player"
        : "sprite-anim-entering-opponent"
      : animationState === "leaving"
      ? "sprite-anim-leaving"
      : animationState === "fainted"
      ? "sprite-anim-fainted"
      : "sprite-anim-idle";

  const hitClass = isHit ? "sprite-anim-hit" : "";
  const reducedClass = prefersReducedMotion ? "sprite-reduced-motion" : "";

  if (loadError || !currentUrl) {
    // Final fallback: original clean LCD badge with Pokédex number and species name
    return (
      <div
        data-testid="pokemon-sprite-fallback"
        data-animation-state={animationState}
        data-hit={isHit ? "true" : undefined}
        className={`flex flex-col items-center justify-center p-2 rounded border border-slate-700/60 bg-slate-900/40 text-center select-none ${animClass} ${hitClass} ${reducedClass} ${
          animationState !== "fainted" && isFainted ? "opacity-30 grayscale" : ""
        } ${className}`}
      >
        <span className="text-[10px] font-bold text-slate-800">#{dexId}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 truncate max-w-[90px]">
          {name}
        </span>
        <span className="text-[8px] text-slate-700">[{variant}]</span>
      </div>
    );
  }

  return (
    <div
      data-testid="pokemon-sprite-container"
      data-animation-state={animationState}
      data-hit={isHit ? "true" : undefined}
      className={`relative flex items-center justify-center select-none ${animClass} ${hitClass} ${reducedClass} ${
        animationState !== "fainted" && isFainted ? "opacity-40 translate-y-2 grayscale" : ""
      } ${className}`}
    >
      {!loaded && (
        <div
          data-testid="pokemon-sprite-loading"
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-transparent animate-spin opacity-50" />
        </div>
      )}
      <img
        key={currentUrl}
        src={currentUrl}
        alt={`${name} (${variant} view)`}
        data-testid="pokemon-sprite-image"
        data-candidate-index={candidateIndex}
        className={`w-full h-full max-w-[128px] max-h-[128px] object-contain transition-opacity duration-200 [image-rendering:pixelated] [image-rendering:-moz-crisp-edges] [image-rendering:crisp-edges] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
};
