import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room/room.js";
import { BattleOrchestrator } from "../src/battle/orchestrator.js";
import { FakeClock } from "../src/clock/clock.js";
import { InMemoryBattleLogStore } from "../src/store/battle-log-store.js";
import { NativeEngineAdapter } from "@pokemon/engine-binding";
import type { BattleEndData, TurnPromptData } from "../src/battle/orchestrator.js";

describe("Disconnect & Reconnect Grace Period", () => {
  const adapter = new NativeEngineAdapter();
  adapter.loadData();

  it("allows player to reconnect within grace period and resume turn", () => {
    const clock = new FakeClock(1000);
    const room = new Room("RECON1", { teamSize: 3, timerEnabled: true });
    room.addPlayer("P1", "sock1");
    room.addPlayer("P2", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);
    room.startBattle();

    let disconnectNotified = false;
    let reconnectNotified = false;
    let resPrompt: TurnPromptData | undefined;

    const orchestrator = new BattleOrchestrator(
      room,
      adapter,
      clock,
      new InMemoryBattleLogStore(),
      {
        onBattleStart: () => {},
        onTurnPrompt: (side, p) => {
          if (side === "p2") resPrompt = p;
        },
        onTurnResult: () => {},
        onBattleEnd: () => {},
        onPlayerDisconnected: (s) => {
          if (s === "p2") disconnectNotified = true;
        },
        onPlayerReconnected: (s) => {
          if (s === "p2") reconnectNotified = true;
        },
      },
      88
    );

    orchestrator.start();

    // P2 disconnects
    orchestrator.handleDisconnect("p2");
    assert.strictEqual(disconnectNotified, true);
    assert.strictEqual(room.p2?.isConnected, false);

    // 10 seconds pass (grace period is 30s)
    clock.tick(10000);
    assert.strictEqual(orchestrator.isBattleFinished(), false);

    // P2 reconnects
    orchestrator.handleReconnect("p2");
    assert.strictEqual(reconnectNotified, true);
    assert.strictEqual(room.p2?.isConnected, true);

    // P2 receives refreshed prompt with remaining time
    assert.ok(resPrompt !== undefined);
    assert.strictEqual(resPrompt.remainingMs, 80000); // 90000 - 10000
  });

  it("forfeits player if grace period expires during disconnect", () => {
    const clock = new FakeClock(1000);
    const room = new Room("RECON2", { teamSize: 3, timerEnabled: false }); // timer disabled so 30s grace governs
    room.addPlayer("P1", "sock1");
    room.addPlayer("P2", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);
    room.startBattle();

    let endPayload: BattleEndData | undefined;

    const orchestrator = new BattleOrchestrator(
      room,
      adapter,
      clock,
      new InMemoryBattleLogStore(),
      {
        onBattleStart: () => {},
        onTurnPrompt: () => {},
        onTurnResult: () => {},
        onBattleEnd: (p) => {
          endPayload = p;
        },
      },
      99
    );

    orchestrator.start();

    // P2 disconnects
    orchestrator.handleDisconnect("p2");

    // Advance clock past the 30-second grace period
    clock.tick(30000);

    // Player 2 forfeits for disconnect
    assert.ok(endPayload !== undefined);
    const end = endPayload as BattleEndData;
    assert.strictEqual(end.winner, "p1");
    assert.strictEqual(end.reason, "disconnect");
  });
});
