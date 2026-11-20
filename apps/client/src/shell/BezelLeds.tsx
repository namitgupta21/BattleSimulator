import React from "react";
import type { ConnectionStatus } from "../connection/GameConnection.js";

interface BezelLedsProps {
  connectionStatus: ConnectionStatus;
  waitingForOpponent?: boolean;
  opponentDisconnected?: boolean;
}

export const BezelLeds: React.FC<BezelLedsProps> = ({
  connectionStatus,
  waitingForOpponent = false,
  opponentDisconnected = false,
}) => {
  const isConnected = connectionStatus === "connected";
  const isErrorOrDc = connectionStatus === "disconnected" || opponentDisconnected;

  return (
    <div className="flex items-center justify-between w-full px-2 py-1 mb-2 border-b-2 border-pokedex-darkred">
      {/* Big Blue Scanner Lens */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-200 border-2 border-slate-900 shadow-md">
          <div
            className={`w-7 h-7 rounded-full bg-cyan-400 border border-cyan-200 transition-all duration-300 shadow-inner ${
              isConnected ? "shadow-cyan-300/80 animate-pulse" : "opacity-75"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-white ml-1 mt-1 opacity-90" />
          </div>
        </div>
      </div>

      {/* Triad of indicator LEDs: Red, Yellow, Green */}
      <div className="flex items-center gap-3 pr-2">
        {/* Red LED: Disconnected / Warning */}
        <div
          title={isErrorOrDc ? "Disconnected / Warning" : "System normal"}
          className={`w-3.5 h-3.5 rounded-full border border-slate-900 transition-all ${
            isErrorOrDc
              ? "bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"
              : "bg-red-950 opacity-40"
          }`}
        />

        {/* Yellow LED: Waiting for Opponent / Busy */}
        <div
          title={waitingForOpponent ? "Waiting for opponent action" : "Idle"}
          className={`w-3.5 h-3.5 rounded-full border border-slate-900 transition-all ${
            waitingForOpponent
              ? "bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse"
              : "bg-amber-950 opacity-40"
          }`}
        />

        {/* Green LED: Connected & Ready */}
        <div
          title={isConnected && !waitingForOpponent ? "Ready to input" : "Connected"}
          className={`w-3.5 h-3.5 rounded-full border border-slate-900 transition-all ${
            isConnected && !waitingForOpponent
              ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
              : isConnected
              ? "bg-emerald-600 opacity-60"
              : "bg-emerald-950 opacity-40"
          }`}
        />
      </div>
    </div>
  );
};
