import React from "react";
import type { PlayerPokemon, Action } from "@pokemon/protocol";
import { PartyIcon } from "./PartyIcon.js";

interface SwitchMenuProps {
  team: PlayerPokemon[];
  activeIndex: number;
  legalActions: Action[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onConfirmSwitch: (slotIndex: number) => void;
  onCancel: () => void;
  isForcedSwitch?: boolean;
}

export const SwitchMenu: React.FC<SwitchMenuProps> = ({
  team,
  activeIndex,
  legalActions,
  selectedIndex,
  onSelectIndex,
  onConfirmSwitch,
  onCancel,
  isForcedSwitch = false,
}) => {
  const isSwitchLegal = (slotIdx: number) => {
    if (slotIdx === activeIndex) return false;
    const poke = team[slotIdx];
    if (!poke || poke.currentHp <= 0) return false;
    return legalActions.some((a) => a.type === "switch" && a.index === slotIdx);
  };

  return (
    <div
      data-testid="switch-menu"
      className="flex flex-col w-full h-full p-2 bg-slate-900/90 rounded-lg text-slate-100 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-700">
        <span className="text-[10px] font-bold text-cyan-300 tracking-wider">
          {isForcedSwitch ? "FORCED SWITCH: CHOOSE NEXT POKÉMON" : "CHOOSE POKÉMON TO SWITCH"}
        </span>
        {!isForcedSwitch && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel switch and return to moves"
            className="px-2 py-0.5 text-[8px] bg-red-600 hover:bg-red-500 text-white rounded font-bold"
          >
            CANCEL [B]
          </button>
        )}
      </div>

      {/* Pokémon Slots List */}
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1">
        {team.map((pokemon, idx) => {
          const isActive = idx === activeIndex;
          const isFainted = pokemon.currentHp <= 0;
          const legal = isSwitchLegal(idx);
          const isCursorOn = selectedIndex === idx;

          const hpPercent = (pokemon.currentHp / pokemon.maxHp) * 100;
          let hpColor = "bg-emerald-500";
          if (hpPercent <= 20) hpColor = "bg-red-600";
          else if (hpPercent <= 50) hpColor = "bg-amber-400";

          return (
            <button
              key={`${pokemon.speciesId}-${idx}`}
              type="button"
              disabled={!legal}
              onClick={() => {
                onSelectIndex(idx);
                if (legal) onConfirmSwitch(idx);
              }}
              data-testid={`switch-slot-${idx}`}
              aria-label={`Slot ${idx + 1}: ${pokemon.name}, ${pokemon.currentHp} of ${pokemon.maxHp} HP ${isActive ? "Active" : ""} ${isFainted ? "Fainted" : ""}`}
              className={`relative flex items-center justify-between p-1.5 rounded-lg border text-left transition-all ${
                isCursorOn
                  ? "bg-slate-800 border-cyan-400 ring-2 ring-cyan-400/80 scale-[1.01]"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900"
              } ${!legal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {/* Cursor indicator */}
              {isCursorOn && (
                <span className="absolute left-1 text-[10px] text-cyan-400 font-bold">
                  ▶
                </span>
              )}

              {/* Party Icon & Name/Level Info */}
              <div className="flex items-center gap-2 pl-4">
                <PartyIcon
                  speciesId={pokemon.speciesId}
                  name={pokemon.name}
                  level={pokemon.level}
                  currentHp={pokemon.currentHp}
                  maxHp={pokemon.maxHp}
                  status={pokemon.status}
                  types={pokemon.types}
                  isActive={isActive}
                  isFainted={isFainted}
                  isFocused={isCursorOn}
                  size="md"
                />

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10px] uppercase text-white truncate max-w-[100px]">
                      {pokemon.name}
                    </span>
                    {isActive && (
                      <span className="text-[8px] bg-cyan-700 text-cyan-100 px-1 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                    {isFainted && (
                      <span className="text-[8px] bg-red-900 text-red-200 px-1 rounded font-bold">
                        FAINTED
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] text-slate-400">
                    Lv.{pokemon.level} • {pokemon.types.join("/")}
                  </span>
                </div>
              </div>

              {/* HP Bar & Numbers */}
              <div className="flex flex-col items-end pr-2 w-24">
                <div className="flex items-center gap-1 w-full text-[8px] font-mono">
                  <span className="text-slate-400">HP</span>
                  <div className="relative flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full ${hpColor}`}
                      style={{ width: `${Math.max(0, hpPercent)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[8px] font-mono text-slate-300 mt-0.5">
                  {pokemon.currentHp}/{pokemon.maxHp}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
