import React from "react";
import type { OpponentPublicState, PlayerPokemon } from "@pokemon/protocol";
import { HealthBar } from "./HealthBar.js";
import { PokemonSprite } from "./PokemonSprite.js";
import { PartyIcon } from "./PartyIcon.js";

interface ArenaViewProps {
  playerPokemon?: PlayerPokemon;
  playerTeam?: PlayerPokemon[];
  activePokemonIndex?: number;
  opponentPublic?: OpponentPublicState | null;
  onSelectBenchSlot?: (index: number) => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({
  playerPokemon,
  playerTeam = [],
  activePokemonIndex = 0,
  opponentPublic,
  onSelectBenchSlot,
}) => {
  const lastOpponentRef = React.useRef(opponentPublic?.active ?? null);
  if (opponentPublic?.active) {
    lastOpponentRef.current = opponentPublic.active;
  }
  const oppActive = opponentPublic?.active ?? lastOpponentRef.current;

  return (
    <div className="relative flex flex-col justify-between w-full flex-1 p-1 sm:p-2 select-none overflow-hidden min-h-[110px] sm:min-h-[130px]">
      {/* ================= OPPONENT ROW (TOP) ================= */}
      <div className="flex items-start justify-between w-full">
        {/* Opponent Status Box & Bench Reserve Strip */}
        <div className="flex flex-col gap-1 z-10 max-w-[55%]">
          {oppActive ? (
            <HealthBar
              name={oppActive.name}
              level={oppActive.level}
              hpPercent={oppActive.hpPercent}
              status={oppActive.status}
              isPlayer={false}
              statStages={oppActive.statStages}
            />
          ) : (
            <div className="text-[9px] text-slate-800 font-mono italic">
              (No active opponent)
            </div>
          )}

          {/* Opponent Anonymous Bench Tokens (Strictly hidden info) */}
          {opponentPublic && (
            <div
              data-testid="opponent-bench-strip"
              className="flex items-center gap-1 pl-0.5 text-[8px] text-slate-800"
            >
              <span className="font-bold text-[7px] tracking-tight text-slate-800">FOE BENCH:</span>
              <div className="flex items-center gap-0.5">
                {Array.from({
                  length: Math.max(
                    0,
                    opponentPublic.aliveCount - (oppActive && oppActive.hpPercent > 0 ? 1 : 0)
                  ),
                }).map((_, i) => (
                  <PartyIcon
                    key={`opp-alive-${i}`}
                    isAnonymous={true}
                    size="sm"
                    className="w-5 h-5 !rounded-full"
                  />
                ))}
                {Array.from({
                  length: Math.max(
                    0,
                    opponentPublic.faintedCount - (oppActive && oppActive.hpPercent <= 0 ? 1 : 0)
                  ),
                }).map((_, i) => (
                  <PartyIcon
                    key={`opp-faint-${i}`}
                    isAnonymous={true}
                    isFainted={true}
                    size="sm"
                    className="w-5 h-5 !rounded-full"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Opponent Sprite + Platform */}
        <div className="relative flex flex-col items-center mr-1 sm:mr-4">
          <div className="relative z-10">
            {oppActive ? (
              <PokemonSprite
                speciesId={oppActive.speciesId}
                name={oppActive.name}
                variant="front"
                isFainted={oppActive.hpPercent <= 0}
                className="w-20 h-20 sm:w-24 sm:h-24"
              />
            ) : (
              <div className="w-20 h-20" />
            )}
          </div>
          {/* Platform ellipse */}
          <div className="w-20 h-4 sm:w-24 sm:h-5 -mt-3 sm:-mt-4 bg-slate-900/30 rounded-full blur-[1px]" />
        </div>
      </div>

      {/* ================= PLAYER ROW (BOTTOM) ================= */}
      <div className="flex items-end justify-between w-full mt-1">
        {/* Player Sprite + Platform (Back View) */}
        <div className="relative flex flex-col items-center ml-1 sm:ml-4">
          <div className="relative z-10">
            {playerPokemon ? (
              <PokemonSprite
                speciesId={playerPokemon.speciesId}
                name={playerPokemon.name}
                variant="back"
                isFainted={playerPokemon.currentHp <= 0}
                className="w-20 h-20 sm:w-24 sm:h-24"
              />
            ) : (
              <div className="w-20 h-20" />
            )}
          </div>
          {/* Platform ellipse */}
          <div className="w-20 h-4 sm:w-24 sm:h-5 -mt-3 sm:-mt-4 bg-slate-900/30 rounded-full blur-[1px]" />
        </div>

        {/* Player Status Box & Player Bench Strip */}
        <div className="flex flex-col items-end gap-1 z-10 max-w-[58%]">
          {/* Player Bench Party Strip */}
          {playerTeam.length > 0 && (
            <div
              data-testid="player-bench-strip"
              className="flex items-center gap-1 p-0.5 rounded bg-slate-900/40 border border-slate-900/60 overflow-x-auto max-w-full"
            >
              <span className="font-bold text-[7px] text-slate-900 font-mono px-0.5">TEAM:</span>
              <div className="flex items-center gap-1">
                {playerTeam.map((poke, idx) => (
                  <PartyIcon
                    key={`${poke.speciesId}-${idx}`}
                    speciesId={poke.speciesId}
                    name={poke.name}
                    level={poke.level}
                    currentHp={poke.currentHp}
                    maxHp={poke.maxHp}
                    status={poke.status}
                    types={poke.types}
                    isActive={idx === activePokemonIndex}
                    isFainted={poke.currentHp <= 0}
                    size="sm"
                    onClick={onSelectBenchSlot ? () => onSelectBenchSlot(idx) : undefined}
                    className="w-6 h-6 sm:w-7 sm:h-7"
                  />
                ))}
              </div>
            </div>
          )}

          {playerPokemon ? (
            <HealthBar
              name={playerPokemon.name}
              level={playerPokemon.level}
              currentHp={playerPokemon.currentHp}
              maxHp={playerPokemon.maxHp}
              hpPercent={(playerPokemon.currentHp / playerPokemon.maxHp) * 100}
              status={playerPokemon.status}
              isPlayer={true}
              statStages={playerPokemon.statStages}
            />
          ) : (
            <div className="text-[9px] text-slate-800 font-mono italic">
              (No active Pokémon)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
