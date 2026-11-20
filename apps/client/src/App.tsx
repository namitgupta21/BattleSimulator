import React from "react";
import type { GameConnection } from "./connection/GameConnection.js";
import { GameProvider } from "./state/GameContext.js";
import { ScreenRouter } from "./screens/ScreenRouter.js";

interface AppProps {
  connection?: GameConnection;
}

export const App: React.FC<AppProps> = ({ connection }) => {
  return (
    <GameProvider connection={connection}>
      <ScreenRouter />
    </GameProvider>
  );
};

export default App;
