import React from "react";
import { useGame } from "../state/GameContext.js";
import { BezelLeds } from "./BezelLeds.js";
import { DPadControls } from "./DPadControls.js";
import { MobileLogDrawer } from "./MobileLogDrawer.js";
import { ScreenFrame } from "./ScreenFrame.js";
import type { ControlButton } from "../navigation/useKeyboardControls.js";

interface PokedexShellProps {
  children: React.ReactNode;
  rightPanelContent?: React.ReactNode;
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onBack?: () => void;
  activeKey?: ControlButton | null;
  announcement?: string | null;
}

export const PokedexShell: React.FC<PokedexShellProps> = ({
  children,
  rightPanelContent,
  onUp,
  onDown,
  onLeft,
  onRight,
  onEnter,
  onBack,
  activeKey,
  announcement,
}) => {
  const { state, dispatch } = useGame();

  const handleToggleLog = () => {
    dispatch({ type: "TOGGLE_LOG" });
  };

  const handleToggleScanlines = () => {
    dispatch({ type: "TOGGLE_SCANLINES" });
  };

  const handleToggleTheme = () => {
    const next = state.ui.theme === "classic" ? "cyber" : "classic";
    dispatch({ type: "SET_THEME", theme: next });
  };

  return (
    <div
      data-theme={state.ui.theme}
      className="flex items-center justify-center w-screen h-screen overflow-hidden bg-slate-950 p-2 sm:p-4"
    >
      {/* Outer Pokédex Clamshell Unit */}
      <div className="relative flex flex-col md:flex-row w-full max-w-4xl h-[98dvh] max-h-[740px] bg-pokedex-red rounded-2xl border-4 border-slate-900 shadow-2xl chassis-bevel overflow-hidden">
        {/* ================= LEFT HALF (Main Device) ================= */}
        <div className="flex flex-col flex-1 min-h-0 h-full p-2 sm:p-2.5 overflow-hidden">
          {/* Top Bezel: Scanner Lens & Triad LEDs */}
          <div className="flex-shrink-0">
            <BezelLeds
              connectionStatus={state.connectionStatus}
              waitingForOpponent={state.battle.waitingForOpponent}
              opponentDisconnected={state.battle.opponentDisconnected}
            />
          </div>

          {/* Main LCD Screen Frame */}
          <ScreenFrame
            scanlinesEnabled={state.ui.scanlinesEnabled}
            announcement={announcement}
          >
            {children}
          </ScreenFrame>

          {/* Bottom Physical Controls */}
          <DPadControls
            onUp={onUp}
            onDown={onDown}
            onLeft={onLeft}
            onRight={onRight}
            onEnter={onEnter}
            onBack={onBack}
            onToggleLog={handleToggleLog}
            onToggleScanlines={handleToggleScanlines}
            onToggleTheme={handleToggleTheme}
            activeKey={activeKey}
            unreadLogCount={state.battle.unreadLogCount}
            isLogOpen={state.battle.isLogOpen}
          />
        </div>

        {/* ================= CENTER HINGE (Wide Viewports) ================= */}
        <div className="hidden md:flex flex-col items-center justify-between w-6 h-full bg-pokedex-darkred border-x-2 border-slate-950 shadow-inner py-4 flex-shrink-0">
          <div className="w-3 h-10 rounded-full bg-slate-900/60" />
          <div className="w-3 h-24 rounded-full bg-slate-900/40" />
          <div className="w-3 h-10 rounded-full bg-slate-900/60" />
        </div>

        {/* ================= RIGHT HALF (Battle Log & Info Panel) ================= */}
        <div className="hidden md:flex flex-col flex-1 min-h-0 h-full p-2.5 sm:p-3 bg-pokedex-red border-l border-pokedex-darkred overflow-hidden">
          {/* Right Header Bar */}
          <div className="flex items-center justify-between px-2 py-1 mb-2 border-b-2 border-pokedex-darkred">
            <span className="text-[10px] font-bold text-white tracking-widest">
              BATTLE RECORD & INTEL
            </span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-900" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" />
            </div>
          </div>

          {/* Right Screen Frame */}
          <ScreenFrame
            scanlinesEnabled={state.ui.scanlinesEnabled}
            announcement={null}
          >
            {rightPanelContent || (
              <div className="flex items-center justify-center h-full text-center text-xs opacity-60">
                Log and battle intelligence will appear here once battle starts.
              </div>
            )}
          </ScreenFrame>

          {/* Right Bottom Decorative Slits & Attribution */}
          <div className="flex justify-between items-center px-4 py-2 text-[8px] text-slate-300/80">
            <span className="font-mono tracking-wider">POKÉDEX MODEL GEN-1 • Non-commercial fan project • Sprites via PokeAPI</span>
            <div className="flex gap-1">
              <div className="w-5 h-1 rounded bg-slate-900/80" />
              <div className="w-5 h-1 rounded bg-slate-900/80" />
            </div>
          </div>
        </div>

        {/* ================= MOBILE SLIDE-OVER LOG DRAWER ================= */}
        <MobileLogDrawer
          isOpen={state.battle.isLogOpen}
          onClose={handleToggleLog}
        >
          <ScreenFrame scanlinesEnabled={state.ui.scanlinesEnabled}>
            {rightPanelContent}
          </ScreenFrame>
        </MobileLogDrawer>
      </div>
    </div>
  );
};
