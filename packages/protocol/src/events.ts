import { z } from "zod";
import * as schemas from "./schemas.js";

export const ClientEvents = {
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_RECONNECT: "room:reconnect",
  PLAYER_READY: "player:ready",
  BATTLE_ACTION: "battle:action",
  BATTLE_SWITCH: "battle:switch",
  BATTLE_FORFEIT: "battle:forfeit",
} as const;

export const ServerEvents = {
  ROOM_JOINED: "room:joined",
  ROOM_STATE: "room:state",
  BATTLE_START: "battle:start",
  TURN_PROMPT: "turn:prompt",
  TURN_RESULT: "turn:result",
  BATTLE_END: "battle:end",
  ERROR: "error",
} as const;

export type ClientEventMap = {
  [ClientEvents.ROOM_CREATE]: z.infer<typeof schemas.RoomCreateSchema>;
  [ClientEvents.ROOM_JOIN]: z.infer<typeof schemas.RoomJoinSchema>;
  [ClientEvents.ROOM_RECONNECT]: z.infer<typeof schemas.RoomReconnectSchema>;
  [ClientEvents.PLAYER_READY]: z.infer<typeof schemas.PlayerReadySchema>;
  [ClientEvents.BATTLE_ACTION]: z.infer<typeof schemas.BattleActionSchema>;
  [ClientEvents.BATTLE_SWITCH]: z.infer<typeof schemas.BattleSwitchSchema>;
  [ClientEvents.BATTLE_FORFEIT]: z.infer<typeof schemas.BattleForfeitSchema>;
};

export type ServerEventMap = {
  [ServerEvents.ROOM_JOINED]: z.infer<typeof schemas.RoomJoinedPayloadSchema>;
  [ServerEvents.ROOM_STATE]: z.infer<typeof schemas.RoomStatePayloadSchema>;
  [ServerEvents.BATTLE_START]: z.infer<typeof schemas.BattleStartPayloadSchema>;
  [ServerEvents.TURN_PROMPT]: z.infer<typeof schemas.TurnPromptPayloadSchema>;
  [ServerEvents.TURN_RESULT]: z.infer<typeof schemas.TurnResultPayloadSchema>;
  [ServerEvents.BATTLE_END]: z.infer<typeof schemas.BattleEndPayloadSchema>;
  [ServerEvents.ERROR]: z.infer<typeof schemas.ProtocolErrorSchema>;
};
