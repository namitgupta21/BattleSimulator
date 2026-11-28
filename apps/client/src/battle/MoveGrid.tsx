import React from "react";
import type { MoveSlot, Action } from "@pokemon/protocol";
import { getTypeStyle } from "./typeColors.js";

interface MoveGridProps {
  moves: MoveSlot[];
  legalActions: Action[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onConfirm: (moveIdx: number) => void;
  onOpenSwitch: () => void;
  onForfeit?: () => void;
  disabled?: boolean;
}

export const MoveGrid: React.FC<MoveGridProps> = ({
  moves,
  legalActions,
  selectedIndex,
  onSelectIndex,
  onConfirm,
  onOpenSwitch,
  onForfeit,
  disabled = false,
}) => {
  const isMoveLegal = (idx: number) => {
    return (
      !disabled &&
      legalActions.some((a) => a.type === "move" && a.index === idx)
    );
  };

  const canSwitch = !disabled && legalActions.some((a) => a.type === "switch");

  return (
    <div className="flex flex-col w-full gap-2 p-1.5 select-none">
      {/* 4 Color-coded Move Tabs (2x2 grid layout) */}
      <div className="grid grid-cols-2 gap-2 w-full">
        {moves.slice(0, 4).map((move, idx) => {
          const legal = isMoveLegal(idx);
          const isSelected = selectedIndex === idx;
          const typeStyle = getTypeStyle(move.type);

          return (
            <button
              key={move.id || idx}
              type="button"
              disabled={!legal}
              onClick={() => {
                onSelectIndex(idx);
                if (legal) onConfirm(idx);
              }}
              aria-label={`Move ${idx + 1}: ${move.name}, ${move.type} type, ${move.currentPp} of ${move.maxPp} PP`}
              className={`relative flex flex-col justify-between p-2 rounded-lg border-2 text-left transition-all min-h-[52px] ${
                typeStyle.bg
              } ${typeStyle.border} ${
                isSelected
                  ? "ring-2 ring-emerald-500 scale-[1.02] shadow-md bg-white/90"
                  : "hover:bg-white/60"
              } ${!legal ? "opacity-40 grayscale cursor-not-allowed" : "cursor-pointer"}`}
            >
              {/* Cursor indicator */}
              {isSelected && (
                <span className="absolute -top-1 -left-1 text-[10px] text-emerald-600 font-bold">
                  ▶
                </span>
              )}

              {/* Move Name - Fully visible */}
              <div className="font-bold text-[9px] sm:text-[10px] text-slate-900 leading-tight mb-1 whitespace-normal break-words">
                {move.name.replace(/-/g, " ").toUpperCase()}
              </div>

              {/* Type & PP Bar */}
              <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono font-bold mt-auto">
                <span
                  className={`px-1 py-0.5 rounded text-[8px] uppercase tracking-wider ${typeStyle.text}`}
                >
                  {move.type}
                </span>
                <span className="text-slate-800">
                  {move.currentPp}/{move.maxPp}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Switch Button Row (replacing Terastallize per user request) */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          type="button"
          disabled={!canSwitch}
          onClick={canSwitch ? onOpenSwitch : undefined}
          aria-label="Switch Pokémon Roster"
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-900 bg-cyan-100 hover:bg-cyan-200 text-slate-950 font-bold text-[10px] sm:text-[11px] shadow transition-all ${
            selectedIndex === 4
              ? "ring-2 ring-emerald-500 bg-cyan-200 scale-105"
              : ""
          } ${!canSwitch ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
        >
          {selectedIndex === 4 && <span>▶</span>}
          <span>⇄ SWITCH POKÉMON</span>
        </button>

        {onForfeit && (
          <button
            type="button"
            disabled={disabled}
            onClick={onForfeit}
            aria-label="Forfeit Battle"
            className={`px-3 py-2 rounded-lg border-2 border-red-900/60 bg-red-100 hover:bg-red-200 text-red-900 font-bold text-[9px] transition-all ${
              selectedIndex === 5 ? "ring-2 ring-red-500 bg-red-200 scale-105" : ""
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
          >
            {selectedIndex === 5 && <span>▶</span>}
            FORFEIT
          </button>
        )}
      </div>
    </div>
  );
};
