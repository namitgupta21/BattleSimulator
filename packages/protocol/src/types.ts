import { ErrorCode } from "./errors.js";

export type PlayerSide = "p1" | "p2";

export type RoomState =
  | "WaitingForPlayers"
  | "Ready"
  | "InProgress"
  | "Finished"
  | "Abandoned";

export type BattlePhase =
  | "ActionSelection"
  | "ForcedSwitchP1"
  | "ForcedSwitchP2"
  | "ForcedSwitchBoth"
  | "GameOver";

export type ActionType = "move" | "switch";

export interface Action {
  type: ActionType;
  index: number;
}

export type BattleEndReason =
  | "knockout"
  | "timeout"
  | "disconnect"
  | "forfeit";

export type StatusEffect =
  | "NONE"
  | "PAR"
  | "BRN"
  | "PSN"
  | "SLP"
  | "FRZ"
  | "CONF";

export interface MoveSlot {
  id: string;
  name: string;
  type: string;
  currentPp: number;
  maxPp: number;
  basePower: number;
  accuracy: number;
}

export interface StatStages {
  attack: number;
  defense: number;
  special: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export interface PlayerPokemon {
  speciesId: string;
  name: string;
  level: number;
  types: string[];
  currentHp: number;
  maxHp: number;
  status: StatusEffect;
  statStages: StatStages;
  moves: MoveSlot[];
}

export interface OpponentPublicPokemon {
  speciesId: string;
  name: string;
  level: number;
  types: string[];
  hpPercent: number; // 0-100% visible
  status: StatusEffect;
  statStages: StatStages;
  revealedMoves: string[]; // only moves actually used in battle
}

export interface OpponentPublicState {
  active: OpponentPublicPokemon | null;
  totalTeamSize: number;
  aliveCount: number;
  faintedCount: number;
}

export interface RoomConfig {
  teamSize: number;
  timerEnabled: boolean;
  turnDurationSeconds: number; // Fixed at 90
}

export interface RoomPlayerInfo {
  name: string;
  side: PlayerSide;
  isConnected: boolean;
  isReady: boolean;
}

export interface BattleEventData {
  type: string;
  side: PlayerSide;
  pokemon?: string;
  move?: string;
  intValue1?: number;
  intValue2?: number;
  doubleValue?: number;
  status?: string;
  message?: string;
}
