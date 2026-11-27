import React, { useState } from "react";
import { ClientEvents, type ClientEventMap } from "@pokemon/protocol";
import { useGame, safeRemoveSession } from "../state/GameContext.js";
import { useRegisterNav } from "../navigation/NavigationContext.js";

export const LobbyScreen: React.FC = () => {
  const { state, dispatch, connection } = useGame();
  const [copied, setCopied] = useState(false);

  const roomCode = state.room.roomCode || "------";
  const mySide = state.room.playerSide;
  const p1Player = state.room.players.find((p) => p.side === "p1");
  const p2Player = state.room.players.find((p) => p.side === "p2");
  const me = mySide === "p1" ? p1Player : p2Player;

  const isReady = me?.isReady ?? false;

  const handleToggleReady = () => {
    const payload: ClientEventMap[typeof ClientEvents.PLAYER_READY] = {
      ready: !isReady,
    };
    connection.emit(ClientEvents.PLAYER_READY, payload);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleLeave = () => {
    try {
      connection.emit(ClientEvents.ROOM_LEAVE, {});
    } catch {}
    safeRemoveSession();
    dispatch({ type: "RESET_BATTLE" });
  };

  useRegisterNav({
    onEnter: handleToggleReady,
    onBack: handleLeave,
  }, [handleToggleReady, handleLeave]);

  return (
    <div className="flex flex-col justify-between w-full h-full p-2 select-none text-slate-900">
      {/* Header: Room Code with Copy Button */}
      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-950 text-white border-2 border-slate-900 shadow">
        <span className="text-[8px] text-slate-400 font-mono tracking-widest">
          ROOM CODE
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-base sm:text-lg font-pixel tracking-widest text-cyan-300">
            {roomCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy Room Code"
            className="px-2 py-0.5 text-[8px] rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold transition-all active:scale-95"
          >
            {copied ? "COPIED!" : "COPY"}
          </button>
        </div>
      </div>

      {/* Players Presence Box */}
      <div className="flex flex-col gap-2 my-auto w-full max-w-xs mx-auto">
        <span className="text-[9px] font-bold text-slate-950 tracking-wider">
          PLAYERS IN ROOM:
        </span>

        {/* Player 1 Slot */}
        <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-900 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-800">[P1]</span>
            <span className="font-bold uppercase text-slate-950">
              {state.room.players.find((p) => p.side === "p1")?.name || "Waiting..."}
            </span>
            {mySide === "p1" && (
              <span className="text-[8px] text-cyan-700 font-bold">(YOU)</span>
            )}
          </div>
          <div>
            {state.room.players.find((p) => p.side === "p1")?.isReady ? (
              <span className="px-1.5 py-0.5 text-[8px] rounded bg-emerald-600 text-white font-bold">
                READY
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[8px] rounded bg-slate-700 text-slate-300">
                WAITING
              </span>
            )}
          </div>
        </div>

        {/* Player 2 Slot */}
        <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-900 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-800">[P2]</span>
            <span className="font-bold uppercase text-slate-950">
              {p2Player?.name || "Awaiting opponent..."}
            </span>
            {mySide === "p2" && (
              <span className="text-[8px] text-cyan-700 font-bold">(YOU)</span>
            )}
          </div>
          <div>
            {p2Player?.isReady ? (
              <span className="px-1.5 py-0.5 text-[8px] rounded bg-emerald-600 text-white font-bold">
                READY
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[8px] rounded bg-slate-700 text-slate-300">
                WAITING
              </span>
            )}
          </div>
        </div>

        {/* Room Rules Summary */}
        {state.room.config && (
          <div className="text-[8px] text-slate-800 font-mono text-center pt-1">
            Rules: {state.room.config.teamSize}v{state.room.config.teamSize} •{" "}
            {state.room.config.timerEnabled ? "90s Timer" : "No Timer"}
          </div>
        )}
      </div>

      {/* Action Controls: Ready Up & Leave */}
      <div className="flex gap-2 w-full pt-1">
        <button
          type="button"
          onClick={handleLeave}
          className="flex-1 py-2.5 sm:py-3 rounded-lg border-2 border-red-900/60 bg-red-100 hover:bg-red-200 text-red-900 font-bold text-[9px] sm:text-[10px] active:scale-95 transition-all"
        >
          LEAVE
        </button>

        <button
          type="button"
          onClick={handleToggleReady}
          className={`flex-[2] py-2.5 sm:py-3 rounded-lg border-2 border-slate-950 font-bold text-[10px] text-white shadow transition-all active:scale-95 ${
            isReady
              ? "bg-amber-600 hover:bg-amber-500"
              : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {isReady ? "CANCEL READY" : "I AM READY!"}
        </button>
      </div>
    </div>
  );
};
