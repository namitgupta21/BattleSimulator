import React, { useEffect, useRef } from "react";
import type { OpponentPublicState } from "@pokemon/protocol";
import type { LogEntry } from "../state/types.js";

interface BattleLogPanelProps {
  logs: LogEntry[];
  opponentPublic?: OpponentPublicState | null;
  seed?: number | null;
}

export const BattleLogPanel: React.FC<BattleLogPanelProps> = ({
  logs,
  opponentPublic,
  seed,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const lastOppActiveRef = useRef(opponentPublic?.active ?? null);
  if (opponentPublic?.active) {
    lastOppActiveRef.current = opponentPublic.active;
  }
  const oppActive = opponentPublic?.active ?? lastOppActiveRef.current;

  return (
    <div className="flex flex-col w-full h-full text-[9px] font-mono select-none overflow-hidden">
      {/* Top Intel Overview */}
      <div className="p-2 mb-2 rounded bg-slate-900/40 border border-slate-900/60 text-slate-900">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/30">
          <span className="font-bold">OPPONENT INTEL</span>
          {seed !== null && <span className="opacity-70">Seed: {seed}</span>}
        </div>

        {oppActive ? (
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="font-bold uppercase">{oppActive.name}:</span>
              <span>~{Math.round(oppActive.hpPercent)}% HP</span>
            </div>
            <div>
              <span className="opacity-75">Revealed Moves: </span>
              <span className="font-bold text-slate-950">
                {oppActive.revealedMoves.length > 0
                  ? oppActive.revealedMoves.join(", ")
                  : "None"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-1 opacity-70 italic">Awaiting battle data...</div>
        )}
      </div>

      {/* Log Feed Header */}
      <div className="flex items-center justify-between px-1 pb-1 font-bold text-slate-900 border-b border-slate-800/40">
        <span>EVENT LOG</span>
        <span className="text-[8px] opacity-75">{logs.length} events</span>
      </div>

      {/* Scrollable Events Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-1 py-1 space-y-1 text-slate-950"
      >
        {logs.length === 0 ? (
          <div className="text-center opacity-60 py-4 italic">No events yet.</div>
        ) : (
          logs.map((log) => {
            const isFaint = log.type === "Fainted" || log.text.includes("fainted");
            const isCrit = log.type === "CriticalHit" || log.text.includes("critical");
            const isDamage = log.type === "DamageDealt";

            return (
              <div
                key={log.id}
                className={`p-1 rounded leading-relaxed border ${
                  isFaint
                    ? "bg-red-900/20 border-red-800/40 font-bold text-red-950"
                    : isCrit
                    ? "bg-amber-300/30 border-amber-600/40 font-bold"
                    : isDamage
                    ? "bg-slate-900/10 border-slate-900/20"
                    : "bg-slate-900/5 border-transparent"
                }`}
              >
                {log.text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
