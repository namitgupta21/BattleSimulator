import crypto from "node:crypto";
import type { PlayerSide, RoomConfig, RoomState } from "@pokemon/protocol";
import { ErrorCode } from "@pokemon/protocol";

export interface RoomPlayer {
  id: string;
  name: string;
  side: PlayerSide;
  sessionToken: string;
  socketId: string;
  isConnected: boolean;
  isReady: boolean;
}

export class Room {
  readonly id: string;
  readonly config: RoomConfig;
  private _state: RoomState = "WaitingForPlayers";
  p1?: RoomPlayer;
  p2?: RoomPlayer;
  createdAt: number;

  constructor(id: string, config?: Partial<RoomConfig>) {
    this.id = id.toUpperCase();
    this.config = {
      teamSize: config?.teamSize ?? 3,
      timerEnabled: config?.timerEnabled ?? true,
      turnDurationSeconds: 90,
    };
    this.createdAt = Date.now();
  }

  get state(): RoomState {
    return this._state;
  }

  isFull(): boolean {
    return Boolean(this.p1 && this.p2);
  }

  addPlayer(name: string, socketId: string): RoomPlayer {
    if (this._state !== "WaitingForPlayers" && this._state !== "Ready") {
      throw new Error(ErrorCode.ROOM_NOT_JOINABLE);
    }

    if (!this.p1) {
      this.p1 = {
        id: crypto.randomUUID(),
        name,
        side: "p1",
        sessionToken: crypto.randomUUID(),
        socketId,
        isConnected: true,
        isReady: false,
      };
      return this.p1;
    }

    if (!this.p2) {
      this.p2 = {
        id: crypto.randomUUID(),
        name,
        side: "p2",
        sessionToken: crypto.randomUUID(),
        socketId,
        isConnected: true,
        isReady: false,
      };
      return this.p2;
    }

    throw new Error(ErrorCode.ROOM_FULL);
  }

  setPlayerReady(side: PlayerSide, isReady: boolean): void {
    const player = side === "p1" ? this.p1 : this.p2;
    if (!player) {
      throw new Error(ErrorCode.ROOM_NOT_FOUND);
    }
    player.isReady = isReady;

    if (this.p1?.isReady && this.p2?.isReady) {
      this._state = "Ready";
    } else if (this._state === "Ready") {
      this._state = "WaitingForPlayers";
    }
  }

  startBattle(): void {
    if (this._state !== "Ready" && !(this.p1?.isReady && this.p2?.isReady)) {
      throw new Error("Cannot start battle: both players must be ready");
    }
    this._state = "InProgress";
  }

  finishBattle(): void {
    this._state = "Finished";
  }

  abandonRoom(): void {
    this._state = "Abandoned";
  }

  getPlayerByToken(token: string): RoomPlayer | undefined {
    if (this.p1?.sessionToken === token) return this.p1;
    if (this.p2?.sessionToken === token) return this.p2;
    return undefined;
  }

  getPlayerBySocketId(socketId: string): RoomPlayer | undefined {
    if (this.p1?.socketId === socketId) return this.p1;
    if (this.p2?.socketId === socketId) return this.p2;
    return undefined;
  }

  getPlayer(side: PlayerSide): RoomPlayer | undefined {
    return side === "p1" ? this.p1 : this.p2;
  }

  getOpponent(side: PlayerSide): RoomPlayer | undefined {
    return side === "p1" ? this.p2 : this.p1;
  }
}
