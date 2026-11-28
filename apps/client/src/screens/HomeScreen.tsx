import React, { useState } from "react";
import { useGame } from "../state/GameContext.js";
import { useMenuNavigation } from "../navigation/useMenuNavigation.js";
import { useRegisterNav } from "../navigation/NavigationContext.js";

const DISABLED_MENU_INDICES = [1]; // Single Player is coming soon

export const HomeScreen: React.FC = () => {
  const { state, dispatch } = useGame();
  const [name, setName] = useState(state.playerName);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    dispatch({ type: "SET_PLAYER_NAME", name: val });
  };

  const menu = useMenuNavigation({
    itemCount: 2,
    columns: 1,
    disabledIndices: DISABLED_MENU_INDICES,
    onSelect: (idx) => {
      if (idx === 0) {
        dispatch({ type: "SET_SCREEN", screen: "create-join" });
      }
    },
  });

  useRegisterNav({
    onUp: menu.moveUp,
    onDown: menu.moveDown,
    onEnter: menu.select,
  }, [menu.moveUp, menu.moveDown, menu.select]);

  return (
    <div className="flex flex-col justify-between w-full h-full p-2 select-none text-slate-900">
      {/* Title Header */}
      <div className="flex flex-col items-center justify-center py-2 text-center">
        <h1 className="text-xs sm:text-sm font-bold tracking-widest text-slate-950 uppercase drop-shadow-sm">
          POKÉMON GEN 1
        </h1>
        <h2 className="text-[9px] sm:text-[10px] tracking-wider text-slate-800 mt-0.5">
          HANDHELD BATTLE SIMULATOR
        </h2>
      </div>

      {/* Mode Menu */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto my-auto">
        {/* Name Input Box */}
        <div className="flex flex-col w-full gap-1">
          <label
            htmlFor="player-name-input"
            className="text-[9px] font-bold tracking-wider text-slate-800"
          >
            TRAINER NAME:
          </label>
          <input
            id="player-name-input"
            type="text"
            maxLength={20}
            value={name}
            onChange={handleNameChange}
            placeholder="Enter your name"
            className="w-full px-2.5 py-1.5 rounded bg-slate-950 text-cyan-300 font-pixel text-[10px] border-2 border-slate-800 focus:outline-none focus:border-cyan-400 shadow-inner"
          />
        </div>

        {/* Menu Buttons */}
        <div className="flex flex-col gap-2 w-full pt-1">
          {/* Multiplayer */}
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "create-join" })}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-left font-bold text-[10px] transition-all cursor-pointer ${
              menu.selectedIndex === 0
                ? "bg-emerald-600 text-white border-slate-950 ring-2 ring-emerald-400 shadow"
                : "bg-slate-900/80 text-slate-200 border-slate-900 hover:bg-slate-800"
            }`}
          >
            <span>{menu.selectedIndex === 0 ? "▶ MULTIPLAYER BATTLE" : "  MULTIPLAYER BATTLE"}</span>
            <span className="text-[8px] bg-emerald-500/30 px-1 py-0.5 rounded">ONLINE</span>
          </button>

          {/* Single Player (Disabled / Coming Soon) */}
          <button
            type="button"
            disabled
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-slate-800 bg-slate-900/40 text-slate-500 font-bold text-[10px] cursor-not-allowed opacity-50"
          >
            <span>  SINGLE PLAYER</span>
            <span className="text-[7px] bg-slate-800 px-1 py-0.5 rounded">SOON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
