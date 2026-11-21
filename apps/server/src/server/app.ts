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
  corsOrigin?: string | string[] | boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createServer(options: ServerInstanceOptions = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  // Conditional CORS: default to same-origin only (Caddy handles reverse proxy);
  // enable CORS only when CORS_ORIGIN is explicitly configured (e.g. staging or local dev).
  const corsConfig = options.corsOrigin ?? process.env.CORS_ORIGIN;

  if (corsConfig) {
    const allowedList: string[] =
      typeof corsConfig === "string"
        ? corsConfig.split(",").map((s) => s.trim())
        : Array.isArray(corsConfig)
          ? corsConfig
          : [];

    const isWildcard = typeof corsConfig === "string" && corsConfig.trim() === "*";

    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (
        origin &&
        (isWildcard || allowedList.includes("*") || allowedList.includes(origin))
      ) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept"
        );
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      }
      if (req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
      }
      next();
    });
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: corsConfig
      ? {
          origin:
            typeof corsConfig === "string"
              ? corsConfig.includes(",")
                ? corsConfig.split(",").map((s) => s.trim())
                : corsConfig.trim()
              : (corsConfig as any),
        }
      : undefined,
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

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      version: process.env.GIT_SHA || process.env.npm_package_version || "dev",
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/replay/:battleId", async (req, res) => {
    const { battleId } = req.params;
    if (!UUID_REGEX.test(battleId)) {
      res.status(400).json({ error: "Invalid battle ID format: must be a valid UUID" });
      return;
    }

    const record = await logStore.get(battleId);
    if (!record) {
      res.status(404).json({ error: "Replay not found" });
      return;
    }

    // Must strictly serve finished battles only, never in-progress battles
    if (!record.endedAt || !record.endReason) {
      res.status(403).json({ error: "Battle is still in progress" });
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
