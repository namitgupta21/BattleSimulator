import React, { useState } from "react";
import { ClientEvents } from "@pokemon/protocol";
import { useGame, safeRemoveSession } from "../state/GameContext.js";
import { useRegisterNav } from "../navigation/NavigationContext.js";

export const ResultScreen: React.FC = () => {
  const { state, dispatch, connection } = useGame();
  const [copied, setCopied] = useState(false);

  const mySide = state.room.playerSide;
  const isWinner = state.battle.winner === mySide;
  const isDraw = state.battle.winner === "draw";

  const handleReturnHome = () => {
    try {
      connection.emit(ClientEvents.ROOM_LEAVE, {});
    } catch {}
    safeRemoveSession();
    dispatch({ type: "RESET_BATTLE" });
  };

  useRegisterNav({
    onEnter: handleReturnHome,
    onBack: handleReturnHome,
  }, [handleReturnHome]);

  const handleCopyReplay = async () => {
    if (state.battle.replayLogId) {
      try {
        await navigator.clipboard.writeText(state.battle.replayLogId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
      }
    }
  };

  return (
    <div className="flex flex-col justify-between items-center w-full h-full p-2 text-center select-none text-slate-900">
      {/* Outcome Title Banner */}
      <div className="flex flex-col items-center py-2">
        <div className="text-2xl sm:text-3xl mb-1">
          {isWinner ? "🏆" : isDraw ? "🤝" : "💀"}
        </div>
        <h1
          className={`text-sm sm:text-base font-bold tracking-widest uppercase drop-shadow-sm ${
            isWinner
              ? "text-emerald-800"
              : isDraw
              ? "text-amber-800"
              : "text-red-800"
          }`}
        >
          {isWinner ? "VICTORY!" : isDraw ? "DRAW MATCH!" : "DEFEAT!"}
        </h1>
        <p className="text-[9px] text-slate-800 font-mono mt-1">
          Reason: {state.battle.endReason?.toUpperCase() || "MATCH ENDED"}
        </p>
      </div>

      {/* Replay ID Info Box */}
      {state.battle.replayLogId && (
        <div className="flex flex-col items-center gap-1.5 p-2 rounded bg-slate-900/60 border border-slate-900 text-slate-100 w-full max-w-xs shadow">
          <span className="text-[8px] text-slate-400 font-mono tracking-wider">
            REPLAY LOG ID
          </span>
          <span className="text-[8px] font-mono text-cyan-300 break-all select-all">
            {state.battle.replayLogId}
          </span>
          <button
            type="button"
            onClick={handleCopyReplay}
            className="px-2 py-0.5 text-[8px] rounded bg-cyan-700 hover:bg-cyan-600 font-bold active:scale-95"
          >
            {copied ? "COPIED ID!" : "COPY REPLAY ID"}
          </button>
        </div>
      )}

      {/* Return to Home Action */}
      <div className="w-full max-w-xs pt-2">
        <button
          type="button"
          onClick={handleReturnHome}
          className="w-full py-2.5 rounded-lg border-2 border-slate-950 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow active:scale-95 transition-all"
        >
          RETURN TO HOME
        </button>
      </div>
    </div>
  );
};
