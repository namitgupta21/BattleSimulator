import type { Server, Socket } from "socket.io";
import {
  BattleActionSchema,
  BattleForfeitSchema,
  BattleSwitchSchema,
  ClientEvents,
  ErrorCode,
  PlayerReadySchema,
  RoomCreateSchema,
  RoomJoinSchema,
  RoomReconnectSchema,
  ServerEvents,
} from "@pokemon/protocol";
import type { EngineAdapter } from "@pokemon/engine-binding";
import type { Clock } from "../clock/clock.js";
import type { RoomStore } from "../store/room-store.js";
import type { BattleLogStore } from "../store/battle-log-store.js";
import { Room } from "../room/room.js";
import { BattleOrchestrator } from "../battle/orchestrator.js";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export class SocketHandler {
  private orchestrators = new Map<string, BattleOrchestrator>();

  constructor(
    private readonly io: Server,
    private readonly roomStore: RoomStore,
    private readonly logStore: BattleLogStore,
    private readonly adapter: EngineAdapter,
    private readonly clock: Clock
  ) {}

  getOrchestrator(roomId: string): BattleOrchestrator | undefined {
    return this.orchestrators.get(roomId.toUpperCase());
  }

  setOrchestrator(roomId: string, orch: BattleOrchestrator): void {
    this.orchestrators.set(roomId.toUpperCase(), orch);
  }

  registerSocket(socket: Socket): void {
    socket.on(ClientEvents.ROOM_CREATE, (rawPayload: unknown) => {
      const parsed = RoomCreateSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BAD_REQUEST,
          message: parsed.error.issues[0]?.message ?? "Invalid create room payload",
        });
        return;
      }

      const { playerName, teamSize, timerEnabled } = parsed.data;
      let roomCode = generateRoomCode();
      while (this.roomStore.get(roomCode)) {
        roomCode = generateRoomCode();
      }

      const room = new Room(roomCode, { teamSize, timerEnabled });
      const p1 = room.addPlayer(playerName, socket.id);
      this.roomStore.save(room);

      socket.join(room.id);

      socket.emit(ServerEvents.ROOM_JOINED, {
        roomCode: room.id,
        playerSide: "p1",
        sessionToken: p1.sessionToken,
        config: room.config,
      });

      this.broadcastRoomState(room);
    });

    socket.on(ClientEvents.ROOM_JOIN, (rawPayload: unknown) => {
      const parsed = RoomJoinSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BAD_REQUEST,
          message: parsed.error.issues[0]?.message ?? "Invalid join room payload",
        });
        return;
      }

      const { roomCode, playerName } = parsed.data;
      const room = this.roomStore.get(roomCode);
      if (!room) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: `Room ${roomCode} not found`,
        });
        return;
      }

      if (room.isFull()) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.ROOM_FULL,
          message: `Room ${roomCode} is full`,
        });
        return;
      }

      try {
        const p2 = room.addPlayer(playerName, socket.id);
        this.roomStore.save(room);

        socket.join(room.id);

        socket.emit(ServerEvents.ROOM_JOINED, {
          roomCode: room.id,
          playerSide: "p2",
          sessionToken: p2.sessionToken,
          config: room.config,
        });

        this.broadcastRoomState(room);
      } catch (err: any) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.ROOM_FULL,
          message: err.message,
        });
      }
    });

    socket.on(ClientEvents.ROOM_RECONNECT, (rawPayload: unknown) => {
      const parsed = RoomReconnectSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BAD_REQUEST,
          message: parsed.error.issues[0]?.message ?? "Invalid reconnect payload",
        });
        return;
      }

      const { roomCode, sessionToken } = parsed.data;
      const room = this.roomStore.get(roomCode);
      if (!room) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: `Room ${roomCode} not found`,
        });
        return;
      }

      const player = room.getPlayerByToken(sessionToken);
      if (!player) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.UNAUTHORIZED,
          message: "Invalid session token",
        });
        return;
      }

      player.socketId = socket.id;
      player.isConnected = true;
      socket.join(room.id);

      socket.emit(ServerEvents.ROOM_JOINED, {
        roomCode: room.id,
        playerSide: player.side,
        sessionToken: player.sessionToken,
        config: room.config,
      });

      this.broadcastRoomState(room);

      const orchestrator = this.orchestrators.get(room.id);
      if (orchestrator && !orchestrator.isBattleFinished()) {
        orchestrator.handleReconnect(player.side);
      }
    });

    socket.on(ClientEvents.PLAYER_READY, (rawPayload: unknown) => {
      const parsed = PlayerReadySchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BAD_REQUEST,
          message: "Invalid ready payload",
        });
        return;
      }

      const room = this.roomStore.findBySocketId(socket.id);
      if (!room) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: "Not in a room",
        });
        return;
      }

      const player = room.getPlayerBySocketId(socket.id);
      if (!player) return;

      room.setPlayerReady(player.side, parsed.data.ready);
      this.roomStore.save(room);
      this.broadcastRoomState(room);

      if (room.state === "Ready") {
        room.startBattle();
        this.roomStore.save(room);
        this.broadcastRoomState(room);

        this.startBattleForRoom(room);
      }
    });

    socket.on(ClientEvents.BATTLE_ACTION, (rawPayload: unknown) => {
      const parsed = BattleActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BAD_REQUEST,
          message: parsed.error.issues[0]?.message ?? "Invalid battle action",
        });
        return;
      }

      const room = this.roomStore.findBySocketId(socket.id);
      if (!room) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: "Not in a room",
        });
        return;
      }

      const player = room.getPlayerBySocketId(socket.id);
      if (!player) return;

      const orchestrator = this.orchestrators.get(room.id);
      if (!orchestrator || orchestrator.isBattleFinished()) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BATTLE_NOT_FOUND,
          message: "Battle is not in progress",
        });
        return;
      }

      try {
        orchestrator.submitAction(player.side, parsed.data.action);
      } catch (err: any) {
        socket.emit(ServerEvents.ERROR, {
          code: err.message.startsWith("ERR_") ? err.message : ErrorCode.ACTION_ILLEGAL,
          message: err.message,
        });
      }
    });

    socket.on(ClientEvents.BATTLE_SWITCH, (rawPayload: unknown) => {
      const parsed = BattleSwitchSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.BAD_REQUEST,
          message: "Invalid battle switch payload",
        });
        return;
      }

      const room = this.roomStore.findBySocketId(socket.id);
      if (!room) return;
      const player = room.getPlayerBySocketId(socket.id);
      if (!player) return;

      const orchestrator = this.orchestrators.get(room.id);
      if (!orchestrator || orchestrator.isBattleFinished()) return;

      try {
        orchestrator.submitForcedSwitch(player.side, {
          type: "switch",
          index: parsed.data.index,
        });
      } catch (err: any) {
        socket.emit(ServerEvents.ERROR, {
          code: err.message.startsWith("ERR_") ? err.message : ErrorCode.ACTION_ILLEGAL,
          message: err.message,
        });
      }
    });

    socket.on(ClientEvents.BATTLE_FORFEIT, () => {
      const room = this.roomStore.findBySocketId(socket.id);
      if (!room) return;
      const player = room.getPlayerBySocketId(socket.id);
      if (!player) return;

      const orchestrator = this.orchestrators.get(room.id);
      if (orchestrator && !orchestrator.isBattleFinished()) {
        orchestrator.forfeitBattle(player.side, "forfeit");
      }
    });

    socket.on("disconnect", () => {
      const room = this.roomStore.findBySocketId(socket.id);
      if (!room) return;

      const player = room.getPlayerBySocketId(socket.id);
      if (!player) return;

      player.isConnected = false;
      this.broadcastRoomState(room);

      const orchestrator = this.orchestrators.get(room.id);
      if (orchestrator && !orchestrator.isBattleFinished()) {
        orchestrator.handleDisconnect(player.side);
      }
    });
  }

  startBattleForRoom(room: Room, injectedSeed?: number): BattleOrchestrator {
    const orchestrator = new BattleOrchestrator(
      room,
      this.adapter,
      this.clock,
      this.logStore,
      {
        onBattleStart: (side, payload) => {
          const player = room.getPlayer(side);
          if (player?.socketId) {
            this.io.to(player.socketId).emit(ServerEvents.BATTLE_START, payload);
          }
        },
        onTurnPrompt: (side, payload) => {
          const player = room.getPlayer(side);
          if (player?.socketId) {
            this.io.to(player.socketId).emit(ServerEvents.TURN_PROMPT, payload);
          }
        },
        onTurnResult: (side, payload) => {
          const player = room.getPlayer(side);
          if (player?.socketId) {
            this.io.to(player.socketId).emit(ServerEvents.TURN_RESULT, payload);
          }
        },
        onBattleEnd: (payload) => {
          this.io.to(room.id).emit(ServerEvents.BATTLE_END, payload);
          this.broadcastRoomState(room);
        },
      },
      injectedSeed
    );

    this.orchestrators.set(room.id, orchestrator);
    orchestrator.start();
    return orchestrator;
  }

  private broadcastRoomState(room: Room): void {
    const players = [];
    if (room.p1) {
      players.push({
        name: room.p1.name,
        side: "p1" as const,
        isConnected: room.p1.isConnected,
        isReady: room.p1.isReady,
      });
    }
    if (room.p2) {
      players.push({
        name: room.p2.name,
        side: "p2" as const,
        isConnected: room.p2.isConnected,
        isReady: room.p2.isReady,
      });
    }

    this.io.to(room.id).emit(ServerEvents.ROOM_STATE, {
      state: room.state,
      players,
    });
  }
}
