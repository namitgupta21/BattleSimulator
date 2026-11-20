import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { ClientEvents, ServerEvents, type ClientEventMap } from "@pokemon/protocol";
import type { GameConnection } from "../connection/GameConnection.js";
import { SocketIoGameConnection } from "../connection/SocketIoGameConnection.js";
import { battleReducer, initialBattleViewState } from "./battleReducer.js";
import type { BattleAction, BattleViewState } from "./types.js";

interface GameContextValue {
  state: BattleViewState;
  dispatch: React.Dispatch<BattleAction>;
  connection: GameConnection;
}

const GameContext = createContext<GameContextValue | null>(null);

export const STORAGE_SESSION_KEY = "pokemon_battle_session";

export interface StoredSession {
  roomCode: string;
  playerSide: "p1" | "p2";
  sessionToken: string;
}

function safeGetSession(): StoredSession | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const raw = sessionStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function safeSetSession(session: StoredSession): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {}
}

function safeRemoveSession(): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch {}
}

export function GameProvider({
  children,
  connection: injectedConnection,
}: {
  children: React.ReactNode;
  connection?: GameConnection;
}) {
  const [state, dispatch] = useReducer(battleReducer, initialBattleViewState);
  const connectionRef = useRef<GameConnection | null>(null);
  if (!connectionRef.current) {
    connectionRef.current = injectedConnection || new SocketIoGameConnection();
  }
  const conn = connectionRef.current;

  // Persist session to sessionStorage
  useEffect(() => {
    if (state.room.roomCode && state.room.sessionToken && state.room.playerSide) {
      safeSetSession({
        roomCode: state.room.roomCode,
        playerSide: state.room.playerSide,
        sessionToken: state.room.sessionToken,
      });
    }
  }, [state.room.roomCode, state.room.sessionToken, state.room.playerSide]);

  // Clean up session storage on match end or returning to home
  useEffect(() => {
    if (state.screen === "result" || state.screen === "home") {
      if (state.battle.winner || state.room.roomCode === null) {
        safeRemoveSession();
      }
    }
  }, [state.screen, state.battle.winner, state.room.roomCode]);

  // Setup connection event listeners
  useEffect(() => {
    const attemptReconnect = () => {
      const session = safeGetSession();
      if (session && session.roomCode && session.sessionToken) {
        const reconnectPayload: ClientEventMap[typeof ClientEvents.ROOM_RECONNECT] = {
          roomCode: session.roomCode,
          sessionToken: session.sessionToken,
        };
        try {
          conn.emit(ClientEvents.ROOM_RECONNECT, reconnectPayload);
        } catch {}
      }
    };

    const unsubStatus = conn.onConnectionChange((status) => {
      dispatch({ type: "SET_CONNECTION_STATUS", status });
      if (status === "connected") {
        attemptReconnect();
      }
    });

    const unsubJoined = conn.on(ServerEvents.ROOM_JOINED, (payload) => {
      dispatch({ type: "ROOM_JOINED", payload });
    });

    const unsubRoomState = conn.on(ServerEvents.ROOM_STATE, (payload) => {
      dispatch({ type: "ROOM_STATE", payload });
    });

    const unsubStart = conn.on(ServerEvents.BATTLE_START, (payload) => {
      dispatch({ type: "BATTLE_START", payload });
    });

    const unsubPrompt = conn.on(ServerEvents.TURN_PROMPT, (payload) => {
      dispatch({ type: "TURN_PROMPT", payload });
    });

    const unsubResult = conn.on(ServerEvents.TURN_RESULT, (payload) => {
      dispatch({ type: "TURN_RESULT", payload });
    });

    const unsubEnd = conn.on(ServerEvents.BATTLE_END, (payload) => {
      dispatch({ type: "BATTLE_END", payload });
    });

    const unsubError = conn.on(ServerEvents.ERROR, (payload) => {
      dispatch({ type: "ERROR_RECEIVED", payload });
      if (payload.code === "ROOM_NOT_FOUND" || payload.code === "UNAUTHORIZED") {
        safeRemoveSession();
      }
    });

    // Auto-connect socket
    conn.connect().catch((err) => {
      console.warn("Connection could not be established:", err);
    });

    return () => {
      unsubStatus();
      unsubJoined();
      unsubRoomState();
      unsubStart();
      unsubPrompt();
      unsubResult();
      unsubEnd();
      unsubError();
    };
  }, [conn]);

  return (
    <GameContext.Provider value={{ state, dispatch, connection: conn }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}
