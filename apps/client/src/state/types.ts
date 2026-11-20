import type {
  BattleEventData,
  OpponentPublicState,
  PlayerPokemon,
  RoomConfig,
  RoomPlayerInfo,
  ServerEventMap,
  BattlePhase,
} from "@pokemon/protocol";
import type { ConnectionStatus } from "../connection/GameConnection.js";

export type ScreenType = "home" | "create-join" | "lobby" | "battle" | "result";

export type LcdTheme = "classic" | "cyber";

export interface LogEntry {
  id: string;
  turnNumber: number;
  text: string;
  side?: "p1" | "p2";
  type?: string;
}

export type TurnPromptPayload = ServerEventMap["turn:prompt"];
export type RoomStatePayload = ServerEventMap["room:state"];

export interface BattleViewState {
  screen: ScreenType;
  connectionStatus: ConnectionStatus;
  playerName: string;

  room: {
    roomCode: string | null;
    playerSide: "p1" | "p2" | null;
    sessionToken: string | null;
    config: RoomConfig | null;
    state: RoomStatePayload["state"] | null;
    players: RoomPlayerInfo[];
  };

  battle: {
    seed: number | null;
    turnNumber: number;
    phase: BattlePhase;
    myTeam: PlayerPokemon[];
    activePokemonIndex: number;
    opponentPublic: OpponentPublicState | null;
    turnPrompt: TurnPromptPayload | null;
    isSubmitting: boolean;
    waitingForOpponent: boolean;
    eventQueue: BattleEventData[];
    currentDialogue: string | null;
    logEntries: LogEntry[];
    unreadLogCount: number;
    isLogOpen: boolean;
    winner: "p1" | "p2" | "draw" | null;
    endReason: string | null;
    replayLogId: string | null;
    opponentDisconnected: boolean;
    opponentGraceDeadline: number | null;
    activeTab: "moves" | "switch";
  };

  ui: {
    theme: LcdTheme;
    scanlinesEnabled: boolean;
    errorMessage: string | null;
  };
}

export type BattleAction =
  | { type: "SET_CONNECTION_STATUS"; status: ConnectionStatus }
  | { type: "SET_PLAYER_NAME"; name: string }
  | { type: "SET_SCREEN"; screen: ScreenType }
  | { type: "ROOM_JOINED"; payload: { roomCode: string; playerSide: "p1" | "p2"; sessionToken: string; config: RoomConfig } }
  | { type: "ROOM_STATE"; payload: RoomStatePayload }
  | { type: "BATTLE_START"; payload: { seed: number; playerSide?: "p1" | "p2"; activeIndex?: number; team: PlayerPokemon[]; opponentPublic: OpponentPublicState } }
  | { type: "TURN_PROMPT"; payload: TurnPromptPayload }
  | { type: "TURN_RESULT"; payload: { turnNumber: number; playerSide?: "p1" | "p2"; activeIndex?: number; events: BattleEventData[]; yourTeam: PlayerPokemon[]; opponentPublic: OpponentPublicState } }
  | { type: "BATTLE_END"; payload: { winner: "p1" | "p2" | "draw"; reason: string; replayLogId: string } }
  | { type: "ERROR_RECEIVED"; payload: { code: string; message: string } }
  | { type: "CLEAR_ERROR" }
  | { type: "ACTION_SUBMITTED" }
  | { type: "CANCEL_ACTION" }
  | { type: "ADVANCE_EVENT" }
  | { type: "SKIP_EVENTS" }
  | { type: "TOGGLE_LOG" }
  | { type: "SET_LOG_OPEN"; open: boolean }
  | { type: "SET_ACTIVE_TAB"; tab: "moves" | "switch" }
  | { type: "SET_THEME"; theme: LcdTheme }
  | { type: "TOGGLE_SCANLINES" }
  | { type: "RESET_BATTLE" };
