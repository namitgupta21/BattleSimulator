import React from "react";
import { useGame } from "../state/GameContext.js";
import { PokedexShell } from "../shell/PokedexShell.js";
import { BattleLogPanel } from "../log/BattleLogPanel.js";
import { HomeScreen } from "./HomeScreen.js";
import { CreateJoinScreen } from "./CreateJoinScreen.js";
import { LobbyScreen } from "./LobbyScreen.js";
import { BattleScreen } from "./BattleScreen.js";
import { ResultScreen } from "./ResultScreen.js";
import { useKeyboardControls } from "../navigation/useKeyboardControls.js";
import { NavigationProvider, useNavigation } from "../navigation/NavigationContext.js";

const ScreenRouterInner: React.FC = () => {
  const { state, dispatch } = useGame();
  const { handlers } = useNavigation();

  const handleGlobalBack = () => {
    if (handlers.onBack) {
      handlers.onBack();
    } else if (state.screen === "create-join") {
      dispatch({ type: "SET_SCREEN", screen: "home" });
    }
  };

  const effectiveHandlers = {
    ...handlers,
    onBack: handleGlobalBack,
  };

  const { activeKey } = useKeyboardControls(effectiveHandlers);

  const renderActiveScreen = () => {
    switch (state.screen) {
      case "home":
        return <HomeScreen />;
      case "create-join":
        return <CreateJoinScreen />;
      case "lobby":
        return <LobbyScreen />;
      case "battle":
        return <BattleScreen />;
      case "result":
        return <ResultScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const rightPanel = (
    <BattleLogPanel
      logs={state.battle.logEntries}
      opponentPublic={state.battle.opponentPublic}
      seed={state.battle.seed}
    />
  );

  return (
    <PokedexShell
      rightPanelContent={rightPanel}
      onUp={effectiveHandlers.onUp}
      onDown={effectiveHandlers.onDown}
      onLeft={effectiveHandlers.onLeft}
      onRight={effectiveHandlers.onRight}
      onEnter={effectiveHandlers.onEnter}
      onBack={effectiveHandlers.onBack}
      activeKey={activeKey}
      announcement={state.battle.currentDialogue}
    >
      {renderActiveScreen()}
    </PokedexShell>
  );
};

export const ScreenRouter: React.FC = () => {
  return (
    <NavigationProvider>
      <ScreenRouterInner />
    </NavigationProvider>
  );
};
