import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import { NativeEngineAdapter } from "@pokemon/engine-binding";
import type { EngineAdapter } from "@pokemon/engine-binding";
import { SystemClock } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { InMemoryRoomStore } from "../store/room-store.js";
import type { RoomStore } from "../store/room-store.js";
import { InMemoryBattleLogStore } from "../store/battle-log-store.js";
import type { BattleLogStore } from "../store/battle-log-store.js";
import { SocketHandler } from "./socket-handler.js";

export interface ServerInstanceOptions {
  adapter?: EngineAdapter;
  clock?: Clock;
  roomStore?: RoomStore;
  logStore?: BattleLogStore;
}

export function createServer(options: ServerInstanceOptions = {}) {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const clock = options.clock ?? new SystemClock();
  const roomStore = options.roomStore ?? new InMemoryRoomStore();
  const logStore = options.logStore ?? new InMemoryBattleLogStore();
  const adapter = options.adapter ?? new NativeEngineAdapter();

  adapter.loadData();

  const socketHandler = new SocketHandler(io, roomStore, logStore, adapter, clock);

  io.on("connection", (socket) => {
    socketHandler.registerSocket(socket);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/replay/:battleId", (req, res) => {
    const record = logStore.get(req.params.battleId);
    if (!record) {
      res.status(404).json({ error: "Replay not found" });
      return;
    }
    res.json(record);
  });

  return {
    app,
    httpServer,
    io,
    clock,
    roomStore,
    logStore,
    adapter,
    socketHandler,
  };
}
