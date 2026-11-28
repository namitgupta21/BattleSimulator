import React from "react";
import type { StatStages } from "@pokemon/protocol";

interface HealthBarProps {
  name: string;
  level: number;
  hpPercent: number;
  currentHp?: number;
  maxHp?: number;
  status?: string;
  isPlayer?: boolean;
  statStages?: StatStages;
}

export const HealthBar: React.FC<HealthBarProps> = ({
  name,
  level,
  hpPercent,
  currentHp,
  maxHp,
  status = "NONE",
  isPlayer = false,
  statStages,
}) => {
  const safeHpPercent = isNaN(hpPercent) ? 0 : hpPercent;
  const clampedPercent = Math.max(0, Math.min(100, safeHpPercent));

  let barColor = "bg-emerald-500";
  if (clampedPercent <= 20) {
    barColor = "bg-red-600";
  } else if (clampedPercent <= 50) {
    barColor = "bg-amber-400";
  }

  const statusColors: Record<string, string> = {
    PAR: "bg-amber-400 text-slate-950",
    BRN: "bg-red-500 text-white",
    PSN: "bg-purple-600 text-white",
    SLP: "bg-indigo-400 text-slate-950",
    FRZ: "bg-cyan-400 text-slate-950",
    CONF: "bg-yellow-300 text-slate-950",
  };

  const statLabels: Record<string, string> = {
    attack: "ATK",
    defense: "DEF",
    special: "SPC",
    speed: "SPE",
    accuracy: "ACC",
    evasion: "EVA",
  };

  const activeStatStages = statStages
    ? Object.entries(statStages).filter(([_, val]) => val !== 0)
    : [];

  return (
    <div className="flex flex-col w-full max-w-[200px] sm:max-w-[230px] p-1.5 rounded bg-slate-900/60 border border-slate-900 shadow-sm text-slate-900">
      {/* Header: Name & Level */}
      <div className="flex items-center justify-between text-[10px] font-bold pb-1">
        <span className="uppercase tracking-wider truncate max-w-[120px]">{name}</span>
        <span className="text-[9px] opacity-80">Lv.{level}</span>
      </div>

      {/* HP Bar Row */}
      <div className="flex items-center gap-1.5 w-full">
        <span className="text-[9px] font-bold italic tracking-tighter">HP</span>
        <div
          role="progressbar"
          aria-label={`${name}'s HP`}
          aria-valuenow={Math.round(clampedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative flex-1 h-2.5 bg-slate-800/80 rounded-sm border border-slate-900 overflow-hidden"
        >
          <div
            className={`h-full ${barColor} ${clampedPercent === 0 ? "hp-bar-fill-faint" : "hp-bar-fill"}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>

      {/* Footer: Status badge & HP Numbers / Percent */}
      <div className="flex items-center justify-between pt-1 text-[9px] font-mono">
        <div>
          {status && status !== "NONE" ? (
            <span
              className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                statusColors[status] || "bg-slate-700 text-white"
              }`}
            >
              {status}
            </span>
          ) : clampedPercent === 0 ? (
            <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-red-700 text-white">
              FNT
            </span>
          ) : null}
        </div>

        <div>
          {isPlayer && currentHp !== undefined && maxHp !== undefined ? (
            <span className="font-bold">
              {currentHp}/{maxHp}
            </span>
          ) : (
            <span className="font-bold">~{Math.round(clampedPercent)}%</span>
          )}
        </div>
      </div>

      {/* Stat Stage Modifiers Row */}
      {activeStatStages.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-900/30 mt-1">
          {activeStatStages.map(([stat, val]) => (
            <span
              key={stat}
              className={`px-1 py-0.2 rounded text-[7px] font-bold font-mono ${
                val > 0
                  ? "bg-emerald-600/80 text-white"
                  : "bg-red-600/80 text-white"
              }`}
            >
              {statLabels[stat] || stat.toUpperCase()} {val > 0 ? `+${val}` : val}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
