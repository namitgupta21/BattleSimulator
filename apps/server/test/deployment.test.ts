import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import { createServer } from "../src/server/app.js";
import { InMemoryBattleLogStore } from "../src/store/battle-log-store.js";
import { getClientIp } from "../src/server/socket-handler.js";
import crypto from "node:crypto";

function invokeApp(
  app: any,
  method: string,
  url: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Record<string, any>; body: any }> {
  return new Promise((resolve) => {
    const socket = new EventEmitter() as any;
    socket.remoteAddress = "127.0.0.1";
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    const res = new http.ServerResponse(req);
    const capturedHeaders: Record<string, any> = {};
    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = (name: string, val: any) => {
      capturedHeaders[name.toLowerCase()] = val;
      return origSetHeader(name, val);
    };

    let data = "";
    res.write = (chunk: any) => {
      data += chunk?.toString?.() ?? "";
      return true;
    };
    res.end = (chunk: any) => {
      if (chunk) data += chunk.toString();
      let body: any = data;
      try {
        body = JSON.parse(data);
      } catch {}
      resolve({
        status: res.statusCode || 200,
        headers: capturedHeaders,
        body,
      });
      return res;
    };

    app(req, res);
  });
}

describe("Deployment Hardening & Production API Verification", () => {
  it("GET /healthz returns ok status, uptime, and version", async () => {
    process.env.GIT_SHA = "test-sha-123456";
    const { app } = createServer();
    const res = await invokeApp(app, "GET", "/healthz");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");
    assert.strictEqual(typeof res.body.uptime, "number");
    assert.strictEqual(res.body.version, "test-sha-123456");
  });

  describe("Replay Endpoint Hardening (/replay/:battleId)", () => {
    it("rejects non-UUID / guessable IDs with 400 Bad Request", async () => {
      const { app } = createServer();
      const res = await invokeApp(app, "GET", "/replay/12345");

      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /UUID/i);

      const sequentialRes = await invokeApp(app, "GET", "/replay/battle-1");
      assert.strictEqual(sequentialRes.status, 400);
    });

    it("returns 404 when valid UUID does not exist", async () => {
      const { app } = createServer();
      const nonExistentUuid = crypto.randomUUID();
      const res = await invokeApp(app, "GET", `/replay/${nonExistentUuid}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, "Replay not found");
    });

    it("returns 403 Forbidden when battle is still in-progress (endedAt missing)", async () => {
      const logStore = new InMemoryBattleLogStore();
      const battleId = crypto.randomUUID();

      logStore.save({
        id: battleId,
        roomId: "ROOM1",
        seed: 12345,
        p1Team: [] as any,
        p2Team: [] as any,
        turns: [],
        winner: null,
        endReason: undefined as any,
        createdAt: Date.now(),
      });

      const { app } = createServer({ logStore });
      const res = await invokeApp(app, "GET", `/replay/${battleId}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, "Battle is still in progress");
    });

    it("returns 200 OK with full battle record for finished battles", async () => {
      const logStore = new InMemoryBattleLogStore();
      const battleId = crypto.randomUUID();

      logStore.save({
        id: battleId,
        roomId: "ROOM1",
        seed: 12345,
        p1Team: [{ name: "Pikachu" }] as any,
        p2Team: [{ name: "Squirtle" }] as any,
        turns: [{ turnNumber: 1, actions: {}, events: [] }],
        winner: "p1",
        endReason: "knockout",
        createdAt: Date.now() - 5000,
        endedAt: Date.now(),
      });

      const { app } = createServer({ logStore });
      const res = await invokeApp(app, "GET", `/replay/${battleId}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, battleId);
      assert.strictEqual(res.body.winner, "p1");
      assert.strictEqual(res.body.endReason, "knockout");
    });
  });

  describe("Reverse Proxy & Client IP Extraction", () => {
    it("extracts real client IP from X-Forwarded-For header", () => {
      const mockSocket1 = {
        handshake: {
          headers: {
            "x-forwarded-for": "203.0.113.195, 172.18.0.1",
          },
          address: "172.18.0.1",
        },
      } as any;

      assert.strictEqual(getClientIp(mockSocket1), "203.0.113.195");

      const mockSocketDirect = {
        handshake: {
          headers: {},
          address: "192.168.1.50",
        },
      } as any;

      assert.strictEqual(getClientIp(mockSocketDirect), "192.168.1.50");
    });
  });

  describe("CORS Configuration", () => {
    it("defaults to same-origin (no permissive * CORS header) when CORS_ORIGIN is unset", async () => {
      delete process.env.CORS_ORIGIN;
      const { app } = createServer({ corsOrigin: undefined });
      const res = await invokeApp(app, "GET", "/healthz", {
        Origin: "http://untrusted-site.com",
      });

      assert.strictEqual(res.headers["access-control-allow-origin"], undefined);
    });

    it("respects configured CORS_ORIGIN when set for staging or dev", async () => {
      const { app } = createServer({ corsOrigin: "https://staging.example.com" });
      const res = await invokeApp(app, "GET", "/healthz", {
        Origin: "https://staging.example.com",
      });

      assert.strictEqual(
        res.headers["access-control-allow-origin"],
        "https://staging.example.com"
      );
    });
  });

  describe("Graceful Shutdown", () => {
    it("rejects new room creation when shutting down", () => {
      const { socketHandler } = createServer();
      socketHandler.setShuttingDown(true);

      let emittedError: any = null;
      const mockSocket = {
        on: (event: string, handler: (payload: any) => void) => {
          if (event === "room:create") {
            handler({ playerName: "Ash", teamSize: 3, timerEnabled: false });
          }
        },
        emit: (event: string, data: any) => {
          if (event === "error") {
            emittedError = data;
          }
        },
      } as any;

      socketHandler.registerSocket(mockSocket);
      assert.ok(emittedError !== null);
      assert.strictEqual(emittedError.code, "ROOM_NOT_JOINABLE");
      assert.match(emittedError.message, /restarting/i);
    });
  });
});
