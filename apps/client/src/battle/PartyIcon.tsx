import React, { useState, useEffect } from "react";
import { SpriteUrlResolver } from "./SpriteUrlResolver.js";
import { getTypeStyle } from "./typeColors.js";

export interface PartyIconProps {
  speciesId?: string;
  name?: string;
  level?: number;
  currentHp?: number;
  maxHp?: number;
  hpPercent?: number;
  status?: string;
  types?: string[];
  isActive?: boolean;
  isFainted?: boolean;
  isAnonymous?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PartyIcon: React.FC<PartyIconProps> = ({
  speciesId,
  name = "Pokémon",
  level: _level = 50,
  currentHp,
  maxHp,
  hpPercent,
  status = "NONE",
  types = [],
  isActive = false,
  isFainted = false,
  isAnonymous = false,
  isFocused = false,
  onClick,
  className = "",
  size = "md",
}) => {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const dexId = speciesId || name ? SpriteUrlResolver.resolveDexId(speciesId || name) : 0;
  const candidates = isAnonymous ? [] : SpriteUrlResolver.getPartyIconCandidates(dexId);

  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
    setImgLoaded(false);
  }, [speciesId, name, isAnonymous]);

  // Compute calculated HP percent
  let calcHpPercent = 100;
  if (isFainted) {
    calcHpPercent = 0;
  } else if (hpPercent !== undefined) {
    calcHpPercent = Math.max(0, Math.min(100, hpPercent));
  } else if (currentHp !== undefined && maxHp !== undefined && maxHp > 0) {
    calcHpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));
  }

  const actuallyFainted = isFainted || calcHpPercent <= 0;

  // HP Ring / Border colors following Gen 1 thresholds
  let hpRingColor = "border-emerald-500 shadow-emerald-500/30";
  if (actuallyFainted) {
    hpRingColor = "border-slate-600 shadow-none";
  } else if (calcHpPercent <= 20) {
    hpRingColor = "border-red-600 shadow-red-600/30";
  } else if (calcHpPercent <= 50) {
    hpRingColor = "border-amber-400 shadow-amber-400/30";
  }

  // Dimension classes
  const sizeClasses = {
    sm: "w-8 h-8 text-[7px]",
    md: "w-10 h-10 text-[8px]",
    lg: "w-12 h-12 text-[9px]",
  }[size];

  const imgSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }[size];

  // Status mapping
  const statusLabels: Record<string, { label: string; bg: string }> = {
    BRN: { label: "BRN", bg: "bg-red-500 text-white" },
    PAR: { label: "PAR", bg: "bg-amber-400 text-slate-950" },
    PSN: { label: "PSN", bg: "bg-purple-600 text-white" },
    SLP: { label: "SLP", bg: "bg-indigo-400 text-slate-950" },
    FRZ: { label: "FRZ", bg: "bg-cyan-400 text-slate-950" },
  };

  const statusInfo = status && status !== "NONE" ? statusLabels[status] : null;

  // Accessible Label
  let accessibleLabel = "";
  if (isAnonymous) {
    accessibleLabel = actuallyFainted ? "Fainted unrevealed Pokémon" : "Unrevealed reserve Pokémon";
  } else if (actuallyFainted) {
    accessibleLabel = `${name}, fainted`;
  } else {
    const statusPart = statusInfo ? `, ${status}` : "";
    const activePart = isActive ? ", active" : "";
    accessibleLabel = `${name}, ${Math.round(calcHpPercent)}% HP${statusPart}${activePart}`;
  }

  const handleImageError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const primaryType = types[0] || "normal";
  const typeStyle = getTypeStyle(primaryType);

  // Original vector SVG fallback token drawn with type color and dex initials
  const renderSvgFallback = () => {
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <svg
        viewBox="0 0 32 32"
        className={`${imgSizes} select-none`}
        data-testid="party-icon-svg-fallback"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="14" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="10" className={typeStyle.bg} fill="currentColor" fillOpacity="0.4" />
        <text
          x="16"
          y="18.5"
          textAnchor="middle"
          fill="#F8FAFC"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {dexId > 0 && dexId <= 151 ? `#${dexId}` : initials}
        </text>
      </svg>
    );
  };

  // Neutral Anonymous Token (for unrevealed opponent Pokémon)
  const renderAnonymousToken = () => {
    return (
      <svg
        viewBox="0 0 32 32"
        className={`${imgSizes} select-none ${actuallyFainted ? "opacity-30" : "opacity-80"}`}
        data-testid="party-icon-anonymous"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="14" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
        {/* Neutral Pokeball silhouette */}
        <path d="M 3 16 A 13 13 0 0 1 29 16 Z" fill="#DC2626" />
        <path d="M 3 16 A 13 13 0 0 0 29 16 Z" fill="#E2E8F0" />
        <rect x="2" y="15" width="28" height="2" fill="#0F172A" />
        <circle cx="16" cy="16" r="4.5" fill="#0F172A" />
        <circle cx="16" cy="16" r="2.5" fill="#FFFFFF" />
      </svg>
    );
  };

  const currentUrl = candidates[candidateIndex];

  return (
    <div
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-label={accessibleLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid="party-icon-root"
      data-active={isActive}
      data-fainted={actuallyFainted}
      className={`relative inline-flex items-center justify-center rounded-lg border-2 bg-slate-900/80 transition-all ${sizeClasses} ${hpRingColor} ${
        isFocused
          ? "ring-2 ring-cyan-400 border-cyan-300 scale-105 shadow-md z-20"
          : "hover:scale-[1.02]"
      } ${actuallyFainted ? "opacity-45 grayscale" : "opacity-100"} ${
        onClick ? "cursor-pointer" : "cursor-default"
      } ${className}`}
    >
      {/* Icon Graphic */}
      <div className="relative flex items-center justify-center w-full h-full p-0.5 overflow-hidden">
        {isAnonymous ? (
          renderAnonymousToken()
        ) : hasError || !currentUrl ? (
          renderSvgFallback()
        ) : (
          <img
            key={currentUrl}
            src={currentUrl}
            alt=""
            aria-hidden="true"
            data-testid="party-icon-img"
            className={`${imgSizes} object-contain pixelated transition-opacity duration-150 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={handleImageError}
            loading="lazy"
          />
        )}

        {/* Fainted Red X overlay */}
        {actuallyFainted && (
          <div
            data-testid="party-icon-fainted-x"
            className="absolute inset-0 flex items-center justify-center text-red-600 font-extrabold text-[14px] pointer-events-none drop-shadow"
            aria-hidden="true"
          >
            ✕
          </div>
        )}
      </div>

      {/* Active Indicator Pip */}
      {isActive && (
        <span
          data-testid="party-icon-active-badge"
          title="Active Pokémon"
          className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-cyan-400 text-slate-950 text-[6px] font-black uppercase tracking-tighter border border-slate-900 shadow-sm"
          aria-hidden="true"
        >
          IN
        </span>
      )}

      {/* Status Badge */}
      {!actuallyFainted && statusInfo && (
        <span
          data-testid="party-icon-status-badge"
          className={`absolute -bottom-1 -left-1 px-1 py-0.2 rounded text-[6px] font-black uppercase tracking-tighter border border-slate-900 shadow-sm ${statusInfo.bg}`}
          aria-hidden="true"
        >
          {statusInfo.label}
        </span>
      )}
    </div>
  );
};
