import React, { useEffect, useState } from "react";
import { SpriteUrlResolver, type SpriteView } from "./SpriteUrlResolver.js";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";

interface PokemonSpriteProps {
  speciesId: string;
  name: string;
  variant: SpriteView;
  isFainted?: boolean;
  className?: string;
}

export const PokemonSprite: React.FC<PokemonSpriteProps> = ({
  speciesId,
  name,
  variant,
  isFainted = false,
  className = "",
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const dexId = SpriteUrlResolver.resolveDexId(speciesId || name);

  // Candidate URLs driven by SpriteUrlResolver (respects prefersReducedMotion live)
  const candidateUrls = SpriteUrlResolver.getBattleSpriteCandidates(
    dexId,
    variant,
    prefersReducedMotion
  );

  useEffect(() => {
    setCandidateIndex(0);
    setLoadError(false);
    setLoaded(false);
  }, [speciesId, name, variant, prefersReducedMotion]);

  const currentUrl = candidateUrls[candidateIndex];

  const handleImageError = () => {
    if (candidateIndex < candidateUrls.length - 1) {
      // Step down to next fallback candidate in cascade
      // (e.g. animated local -> animated remote -> static local -> static remote)
      setCandidateIndex((prev) => prev + 1);
    } else {
      // All sprite image candidates exhausted -> fall back to original LCD badge
      setLoadError(true);
    }
  };

  if (loadError || !currentUrl) {
    // Final fallback: original clean LCD badge with Pokédex number and species name
    return (
      <div
        data-testid="pokemon-sprite-fallback"
        className={`flex flex-col items-center justify-center p-2 rounded border border-slate-700/60 bg-slate-900/40 text-center select-none ${
          isFainted ? "opacity-30 grayscale" : ""
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
      className={`relative flex items-center justify-center select-none transition-all duration-300 ${
        isFainted ? "opacity-40 translate-y-2 grayscale" : ""
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
        onLoad={() => setLoaded(true)}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
};
