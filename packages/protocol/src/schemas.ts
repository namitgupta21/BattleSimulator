import { z } from "zod";
import { ErrorCode } from "./errors.js";

// Client -> Server Schemas
export const RoomCreateSchema = z.object({
  playerName: z.string().trim().min(1, "Player name cannot be empty").max(30, "Player name too long"),
  teamSize: z.number().int().min(1).max(6).optional().default(6),
  timerEnabled: z.boolean().default(true),
});

export const RoomJoinSchema = z.object({
  roomCode: z.string().trim().toUpperCase().min(3).max(12),
  playerName: z.string().trim().min(1, "Player name cannot be empty").max(30, "Player name too long"),
});

export const RoomReconnectSchema = z.object({
  roomCode: z.string().trim().toUpperCase().min(3).max(12),
  sessionToken: z.string().trim().min(1, "Session token required"),
});

export const PlayerReadySchema = z.object({
  ready: z.boolean(),
});

export const BattleActionSchema = z.object({
  action: z.object({
    type: z.enum(["move", "switch"]),
    index: z.number().int().min(0).max(5),
  }),
});

export const BattleSwitchSchema = z.object({
  index: z.number().int().min(0).max(5),
});

export const BattleForfeitSchema = z.object({}).optional();

// Server -> Client Payloads
export const RoomConfigSchema = z.object({
  teamSize: z.number().int().min(1).max(6),
  timerEnabled: z.boolean(),
  turnDurationSeconds: z.number().int().default(90),
});

export const RoomPlayerInfoSchema = z.object({
  name: z.string(),
  side: z.enum(["p1", "p2"]),
  isConnected: z.boolean(),
  isReady: z.boolean(),
});

export const RoomJoinedPayloadSchema = z.object({
  roomCode: z.string(),
  playerSide: z.enum(["p1", "p2"]),
  sessionToken: z.string(),
  config: RoomConfigSchema,
});

export const RoomStatePayloadSchema = z.object({
  state: z.enum(["WaitingForPlayers", "Ready", "InProgress", "Finished", "Abandoned"]),
  players: z.array(RoomPlayerInfoSchema),
});

export const MoveSlotSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  currentPp: z.number().int().min(0),
  maxPp: z.number().int().min(0),
  basePower: z.number().int(),
  accuracy: z.number().int(),
});

export const StatStagesSchema = z.object({
  attack: z.number().int(),
  defense: z.number().int(),
  special: z.number().int(),
  speed: z.number().int(),
  accuracy: z.number().int(),
  evasion: z.number().int(),
});

export const PlayerPokemonSchema = z.object({
  speciesId: z.string(),
  name: z.string(),
  level: z.number().int(),
  types: z.array(z.string()),
  currentHp: z.number().int().min(0),
  maxHp: z.number().int().min(1),
  status: z.enum(["NONE", "PAR", "BRN", "PSN", "SLP", "FRZ", "CONF"]),
  statStages: StatStagesSchema,
  moves: z.array(MoveSlotSchema),
});

export const OpponentPublicPokemonSchema = z.object({
  speciesId: z.string(),
  name: z.string(),
  level: z.number().int(),
  types: z.array(z.string()),
  hpPercent: z.number().min(0).max(100),
  status: z.enum(["NONE", "PAR", "BRN", "PSN", "SLP", "FRZ", "CONF"]),
  statStages: StatStagesSchema,
  revealedMoves: z.array(z.string()),
});

export const OpponentPublicStateSchema = z.object({
  active: OpponentPublicPokemonSchema.nullable(),
  totalTeamSize: z.number().int(),
  aliveCount: z.number().int(),
  faintedCount: z.number().int(),
});

export const BattleStartPayloadSchema = z.object({
  seed: z.number(),
  team: z.array(PlayerPokemonSchema),
  opponentPublic: OpponentPublicStateSchema,
});

export const TurnPromptPayloadSchema = z.object({
  turnNumber: z.number().int(),
  phase: z.enum(["ActionSelection", "ForcedSwitchP1", "ForcedSwitchP2", "ForcedSwitchBoth", "GameOver"]),
  legalActions: z.array(
    z.object({
      type: z.enum(["move", "switch"]),
      index: z.number().int(),
    })
  ),
  serverTime: z.number(),
  deadline: z.number().optional(),
  remainingMs: z.number().optional(),
});

export const BattleEventSchema = z.object({
  type: z.string(),
  side: z.enum(["p1", "p2"]),
  pokemon: z.string().optional(),
  move: z.string().optional(),
  intValue1: z.number().optional(),
  intValue2: z.number().optional(),
  doubleValue: z.number().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
});

export const TurnResultPayloadSchema = z.object({
  turnNumber: z.number().int(),
  events: z.array(BattleEventSchema),
  yourTeam: z.array(PlayerPokemonSchema),
  opponentPublic: OpponentPublicStateSchema,
});

export const BattleEndPayloadSchema = z.object({
  winner: z.enum(["p1", "p2", "draw"]),
  reason: z.enum(["knockout", "timeout", "disconnect", "forfeit"]),
  replayLogId: z.string(),
});

export const ProtocolErrorSchema = z.object({
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
});
