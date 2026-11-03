import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { createServer } from "../src/server/app.js";
import {
  ClientEvents,
  ServerEvents,
  type BattleEndPayloadSchema,
  type TurnPromptPayloadSchema,
} from "@pokemon/protocol";
import { z } from "zod";

type TurnPrompt = z.infer<typeof TurnPromptPayloadSchema>;
type BattleEnd = z.infer<typeof BattleEndPayloadSchema>;

describe("Socket.IO End-to-End Battle Integration", () => {
  it("two scripted Socket.IO clients create/join a room and play a battle to completion", async () => {
    const { httpServer, io } = createServer();

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    const port = (httpServer.address() as any).port;
    const serverUrl = `http://127.0.0.1:${port}`;

    const client1: ClientSocket = ioClient(serverUrl, { reconnection: false });
    const client2: ClientSocket = ioClient(serverUrl, { reconnection: false });

    try {
      // Connect both clients
      await Promise.all([
        new Promise<void>((resolve) => client1.on("connect", () => resolve())),
        new Promise<void>((resolve) => client2.on("connect", () => resolve())),
      ]);

      // Client 1 creates room
      const roomCreatedPromise = new Promise<any>((resolve) => {
        client1.once(ServerEvents.ROOM_JOINED, resolve);
      });

      client1.emit(ClientEvents.ROOM_CREATE, {
        playerName: "Red",
        teamSize: 1, // Fast 1v1 battle
        timerEnabled: true,
      });

      const p1Joined = await roomCreatedPromise;
      assert.strictEqual(p1Joined.playerSide, "p1");
      const roomCode = p1Joined.roomCode;
      assert.ok(roomCode);

      // Client 2 joins room
      const roomJoinedPromise = new Promise<any>((resolve) => {
        client2.once(ServerEvents.ROOM_JOINED, resolve);
      });

      client2.emit(ClientEvents.ROOM_JOIN, {
        roomCode,
        playerName: "Blue",
      });

      const p2Joined = await roomJoinedPromise;
      assert.strictEqual(p2Joined.playerSide, "p2");

      // Promise for battle completion
      let battleEndPayload: BattleEnd | undefined;
      const battleEndPromise = new Promise<BattleEnd>((resolve) => {
        const handler = (payload: BattleEnd) => {
          battleEndPayload = payload;
          resolve(payload);
        };
        client1.once(ServerEvents.BATTLE_END, handler);
        client2.once(ServerEvents.BATTLE_END, handler);
      });

      // Scripted turn responders for both clients
      const setupAutoPlayer = (client: ClientSocket) => {
        client.on(ServerEvents.TURN_PROMPT, (prompt: TurnPrompt) => {
          if (battleEndPayload) return;
          if (prompt.legalActions.length > 0) {
            const chosen = prompt.legalActions[0];
            if (prompt.phase.startsWith("ForcedSwitch")) {
              client.emit(ClientEvents.BATTLE_SWITCH, { index: chosen.index });
            } else {
              client.emit(ClientEvents.BATTLE_ACTION, { action: chosen });
            }
          }
        });
      };

      setupAutoPlayer(client1);
      setupAutoPlayer(client2);

      // Both players declare ready
      client1.emit(ClientEvents.PLAYER_READY, { ready: true });
      client2.emit(ClientEvents.PLAYER_READY, { ready: true });

      // Wait for battle to finish
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("Battle did not finish within timeout")), 15000);
        timeoutHandle.unref();
      });

      const endResult = await Promise.race([
        battleEndPromise,
        timeoutPromise,
      ]);
      clearTimeout(timeoutHandle!);

      assert.ok(endResult !== undefined);
      assert.ok(["p1", "p2", "draw"].includes(endResult.winner));
      assert.ok(endResult.replayLogId.length > 0);
    } finally {
      client1.disconnect();
      client2.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
  });
});
