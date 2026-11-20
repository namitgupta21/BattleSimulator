import React, { useState } from "react";
import { ClientEvents, type ClientEventMap } from "@pokemon/protocol";
import { useGame } from "../state/GameContext.js";
import { useRegisterNav } from "../navigation/NavigationContext.js";

export const CreateJoinScreen: React.FC = () => {
  const { state, dispatch, connection } = useGame();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [teamSize, setTeamSize] = useState<number>(3);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [joinCode, setJoinCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const ensureConnected = async () => {
    if (connection.getStatus() !== "connected") {
      await connection.connect();
    }
  };

  const handleCreate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    dispatch({ type: "CLEAR_ERROR" });

    try {
      await ensureConnected();
      const payload: ClientEventMap[typeof ClientEvents.ROOM_CREATE] = {
        playerName: state.playerName || "Trainer",
        teamSize,
        timerEnabled,
      };
      connection.emit(ClientEvents.ROOM_CREATE, payload);
    } catch {
      dispatch({
        type: "ERROR_RECEIVED",
        payload: { code: "ERR_CONNECTION", message: "Failed to connect to game server" },
      });
    } finally {
      setTimeout(() => setIsSubmitting(false), 1500);
    }
  };

  const handleJoin = async () => {
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode || isSubmitting) return;
    setIsSubmitting(true);
    dispatch({ type: "CLEAR_ERROR" });

    try {
      await ensureConnected();
      const payload: ClientEventMap[typeof ClientEvents.ROOM_JOIN] = {
        roomCode: cleanCode,
        playerName: state.playerName || "Trainer",
      };
      connection.emit(ClientEvents.ROOM_JOIN, payload);
    } catch {
      dispatch({
        type: "ERROR_RECEIVED",
        payload: { code: "ERR_CONNECTION", message: "Failed to connect to game server" },
      });
    } finally {
      setTimeout(() => setIsSubmitting(false), 1500);
    }
  };

  useRegisterNav({
    onLeft: () => setMode("create"),
    onRight: () => setMode("join"),
    onEnter: () => {
      if (mode === "create") handleCreate();
      else handleJoin();
    },
    onBack: () => dispatch({ type: "SET_SCREEN", screen: "home" }),
  }, [mode, teamSize, timerEnabled, joinCode, isSubmitting]);

  return (
    <div className="flex flex-col justify-between w-full h-full p-2 select-none text-slate-900">
      {/* Top Tabs: Create Room vs Join Room */}
      <div className="flex w-full rounded-lg bg-slate-950 p-1 border-2 border-slate-900 gap-1">
        <button
          type="button"
          onClick={() => {
            setMode("create");
            dispatch({ type: "CLEAR_ERROR" });
          }}
          className={`flex-1 py-1 text-[9px] font-bold rounded transition-all ${mode === "create"
              ? "bg-emerald-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-white"
            }`}
        >
          CREATE ROOM
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("join");
            dispatch({ type: "CLEAR_ERROR" });
          }}
          className={`flex-1 py-1 text-[9px] font-bold rounded transition-all ${mode === "join"
              ? "bg-cyan-400 text-slate-950 shadow"
              : "text-slate-400 hover:text-white"
            }`}
        >
          JOIN BY CODE
        </button>
      </div>

      {/* Error Message Display */}
      {state.ui.errorMessage && (
        <div className="flex items-center justify-between p-2 my-1 rounded bg-red-900/90 text-white text-[9px] border border-red-700 animate-pulse">
          <span>{state.ui.errorMessage}</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "CLEAR_ERROR" })}
            className="px-1 text-red-200 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mode Body */}
      <div className="flex flex-col gap-3 my-auto w-full max-w-xs mx-auto py-2">
        {mode === "create" ? (
          <>
            {/* Team Size Selection */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-950">TEAM SIZE:</span>
              <div className="flex gap-1.5">
                {[1, 3, 6].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setTeamSize(size)}
                    className={`w-8 h-7 text-[10px] font-bold rounded border-2 transition-all ${teamSize === size
                        ? "bg-emerald-600 text-white border-slate-950 shadow"
                        : "bg-slate-900/60 text-slate-800 border-slate-800"
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Move Timer Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-950">90s MOVE TIMER:</span>
              <button
                type="button"
                onClick={() => setTimerEnabled(!timerEnabled)}
                className={`px-3 py-1 text-[9px] font-bold rounded border-2 transition-all ${timerEnabled
                    ? "bg-cyan-600 text-white border-slate-950"
                    : "bg-slate-900/60 text-slate-800 border-slate-800"
                  }`}
              >
                {timerEnabled ? "ON (90s)" : "OFF"}
              </button>
            </div>

            {/* Submit Create */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreate}
              className="w-full py-2.5 mt-2 rounded-lg border-2 border-slate-950 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[10px] shadow transition-all"
            >
              {isSubmitting ? "CREATING..." : "START NEW ROOM"}
            </button>
          </>
        ) : (
          <>
            {/* Join Code Input */}
            <div className="flex flex-col gap-1">
              <label htmlFor="join-code-input" className="text-[9px] font-bold text-slate-950">
                ENTER 6-CHAR ROOM CODE:
              </label>
              <input
                id="join-code-input"
                type="text"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. HHNHJD"
                className="w-full px-3 py-2 text-center rounded bg-slate-950 text-cyan-300 font-pixel text-xs tracking-widest border-2 border-slate-800 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Submit Join */}
            <button
              type="button"
              disabled={!joinCode.trim() || isSubmitting}
              onClick={handleJoin}
              className="w-full py-2.5 mt-2 rounded-lg border-2 border-slate-950 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-[10px] shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "JOINING..." : "ENTER ROOM"}
            </button>
          </>
        )}
      </div>

      {/* Bottom Back Button */}
      <div className="flex justify-between items-center pt-1 border-t border-slate-800/40">
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}
          className="px-3 py-1 rounded bg-slate-900/60 hover:bg-slate-900 text-slate-800 hover:text-slate-100 text-[9px] font-bold"
        >
          ◀ BACK [B]
        </button>
        <span className="text-[8px] text-slate-800 font-mono">
          Ready to battle
        </span>
      </div>
    </div>
  );
};
