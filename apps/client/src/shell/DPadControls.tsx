import React from "react";
import type { ControlButton } from "../navigation/useKeyboardControls.js";

interface DPadControlsProps {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onBack?: () => void;
  onToggleLog?: () => void;
  onToggleScanlines?: () => void;
  onToggleTheme?: () => void;
  activeKey?: ControlButton | null;
  unreadLogCount?: number;
  isLogOpen?: boolean;
}

export const DPadControls: React.FC<DPadControlsProps> = ({
  onUp,
  onDown,
  onLeft,
  onRight,
  onEnter,
  onBack,
  onToggleLog,
  onToggleScanlines,
  onToggleTheme,
  activeKey,
  unreadLogCount = 0,
  isLogOpen = false,
}) => {
  return (
    <div className="flex flex-col w-full px-2 pt-0.5 pb-1 flex-shrink-0">
      {/* Utility Bar: Mode / Log / Theme Toggles */}
      <div className="flex items-center justify-between mb-1 sm:mb-1.5 px-1 text-[9px] sm:text-[10px]">
        <div className="flex gap-1.5 sm:gap-2">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle LCD Theme"
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95 transition-all text-[8px] sm:text-[10px]"
            >
              LCD COLOR
            </button>
          )}
          {onToggleScanlines && (
            <button
              type="button"
              onClick={onToggleScanlines}
              aria-label="Toggle CRT Scanlines"
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95 transition-all text-[8px] sm:text-[10px]"
            >
              SCANLINES
            </button>
          )}
        </div>

        {/* Mobile Log Button with Unread Badge */}
        {onToggleLog && (
          <button
            type="button"
            onClick={onToggleLog}
            aria-label="Toggle Battle Log Panel"
            className="relative px-3 sm:px-3.5 py-1 sm:py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow border border-amber-600 active:scale-95 transition-all text-[9px] sm:text-[10px] md:hidden"
          >
            {isLogOpen ? "CLOSE LOG" : "LOG"}
            {unreadLogCount > 0 && !isLogOpen && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[8px] bg-red-600 text-white font-bold rounded-full border border-white animate-bounce">
                {unreadLogCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Main Physical Controls: D-Pad on Left, Action Buttons on Right */}
      <div className="flex items-center justify-between px-2">
        {/* Directional Pad (D-Pad) */}
        <div
          role="group"
          aria-label="Directional Pad"
          className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center select-none"
        >
          {/* Background Cross Frame */}
          <div className="absolute w-8 sm:w-9 h-24 sm:h-28 bg-slate-900 rounded-md shadow-md border border-slate-950" />
          <div className="absolute w-24 sm:w-28 h-8 sm:h-9 bg-slate-900 rounded-md shadow-md border border-slate-950" />
          <div className="absolute w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-slate-800/80 z-10 pointer-events-none" />

          {/* Up */}
          <button
            type="button"
            onClick={onUp}
            aria-label="D-Pad Up"
            className={`absolute top-0 w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-950 z-20 rounded-t-md transition-colors ${
              activeKey === "up" ? "bg-slate-950 text-cyan-400 shadow-inner" : "bg-slate-800"
            }`}
          >
            ▲
          </button>

          {/* Down */}
          <button
            type="button"
            onClick={onDown}
            aria-label="D-Pad Down"
            className={`absolute bottom-0 w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-950 z-20 rounded-b-md transition-colors ${
              activeKey === "down" ? "bg-slate-950 text-cyan-400 shadow-inner" : "bg-slate-800"
            }`}
          >
            ▼
          </button>

          {/* Left */}
          <button
            type="button"
            onClick={onLeft}
            aria-label="D-Pad Left"
            className={`absolute left-0 w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-950 z-20 rounded-l-md transition-colors ${
              activeKey === "left" ? "bg-slate-950 text-cyan-400 shadow-inner" : "bg-slate-800"
            }`}
          >
            ◀
          </button>

          {/* Right */}
          <button
            type="button"
            onClick={onRight}
            aria-label="D-Pad Right"
            className={`absolute right-0 w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-950 z-20 rounded-r-md transition-colors ${
              activeKey === "right" ? "bg-slate-950 text-cyan-400 shadow-inner" : "bg-slate-800"
            }`}
          >
            ▶
          </button>
        </div>

        {/* Action Buttons: ENTER (A) & BACK (B) */}
        <div className="flex items-center gap-3 sm:gap-4 pr-1">
          {/* BACK / B Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back or Cancel (B)"
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-slate-950 shadow-md font-bold text-white text-xs flex items-center justify-center transition-all ${
                activeKey === "back"
                  ? "bg-red-800 translate-y-0.5 shadow-inner"
                  : "bg-red-600 hover:bg-red-500 active:translate-y-0.5"
              }`}
            >
              B
            </button>
            <span className="text-[8px] sm:text-[9px] text-slate-300 font-bold tracking-wider">BACK</span>
          </div>

          {/* ENTER / A Button */}
          <div className="flex flex-col items-center gap-1 -mt-3 sm:-mt-4">
            <button
              type="button"
              onClick={onEnter}
              aria-label="Enter or Confirm (A)"
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-slate-950 shadow-md font-bold text-slate-950 text-xs flex items-center justify-center transition-all ${
                activeKey === "enter"
                  ? "bg-emerald-600 text-white translate-y-0.5 shadow-inner"
                  : "bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5"
              }`}
            >
              A
            </button>
            <span className="text-[8px] sm:text-[9px] text-slate-300 font-bold tracking-wider">ENTER</span>
          </div>
        </div>
      </div>
    </div>
  );
};
