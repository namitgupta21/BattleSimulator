import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room/room.js";
import { BattleOrchestrator } from "../src/battle/orchestrator.js";
import { FakeClock } from "../src/clock/clock.js";
import { InMemoryBattleLogStore } from "../src/store/battle-log-store.js";
import { NativeEngineAdapter } from "@pokemon/engine-binding";
import type { BattleEndData, TurnPromptData } from "../src/battle/orchestrator.js";

describe("Move Timer & Timeout Forfeit", () => {
  const adapter = new NativeEngineAdapter();
  adapter.loadData();

  it("causes immediate forfeit when move timer expires (using FakeClock)", () => {
    const clock = new FakeClock(1000);
    const room = new Room("TIMER1", { teamSize: 3, timerEnabled: true });
    room.addPlayer("P1", "sock1");
    room.addPlayer("P2", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);
    room.startBattle();

    const logStore = new InMemoryBattleLogStore();
    let latestPromptP1: TurnPromptData | undefined;
    let endedPayload: BattleEndData | undefined;

    const orchestrator = new BattleOrchestrator(
      room,
      adapter,
      clock,
      logStore,
      {
        onBattleStart: () => {},
        onTurnPrompt: (side, p) => {
          if (side === "p1") latestPromptP1 = p;
        },
        onTurnResult: () => {},
        onBattleEnd: (p) => {
          endedPayload = p;
        },
      },
      42
    );

    orchestrator.start();

    // Turn prompt sent with 90s deadline
    assert.ok(latestPromptP1 !== undefined);
    assert.strictEqual(latestPromptP1.deadline, 1000 + 90000); // 91000

    // P1 submits their move
    orchestrator.submitAction("p1", latestPromptP1.legalActions[0]);

    // P2 fails to submit their move in time
    assert.strictEqual(endedPayload, undefined);

    // Fast-forward fake clock by 90,000 ms
    clock.tick(90000);

    // P2 timed out -> immediate forfeit!
    assert.ok(endedPayload !== undefined);
    const end = endedPayload as BattleEndData;
    assert.strictEqual(end.winner, "p1");
    assert.strictEqual(end.reason, "timeout");

    // Room is marked Finished
    assert.strictEqual(room.state, "Finished");

    // Recorded in BattleLogStore
    const record = logStore.get(end.replayLogId);
    assert.ok(record !== null);
    assert.strictEqual(record?.winner, "p1");
    assert.strictEqual(record?.endReason, "timeout");
  });

  it("does not forfeit when timerEnabled is false", () => {
    const clock = new FakeClock(1000);
    const room = new Room("NOTIMER", { teamSize: 3, timerEnabled: false });
    room.addPlayer("P1", "sock1");
    room.addPlayer("P2", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);
    room.startBattle();

    const logStore = new InMemoryBattleLogStore();
    let promptP1: TurnPromptData | undefined;
    let endedPayload: BattleEndData | undefined;

    const orchestrator = new BattleOrchestrator(
      room,
      adapter,
      clock,
      logStore,
      {
        onBattleStart: () => {},
        onTurnPrompt: (_s, p) => {
          promptP1 = p;
        },
        onTurnResult: () => {},
        onBattleEnd: (p) => {
          endedPayload = p;
        },
      },
      77
    );

    orchestrator.start();

    assert.strictEqual(promptP1?.deadline, undefined);

    // Advance clock by 10 minutes (600,000 ms)
    clock.tick(600000);

    // Battle should NOT have ended
    assert.strictEqual(endedPayload, undefined);
    assert.strictEqual(orchestrator.isBattleFinished(), false);
  });
});
