import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room/room.js";
import { BattleOrchestrator } from "../src/battle/orchestrator.js";
import { FakeClock } from "../src/clock/clock.js";
import { InMemoryBattleLogStore } from "../src/store/battle-log-store.js";
import { NativeEngineAdapter } from "@pokemon/engine-binding";
import type { TurnPromptData } from "../src/battle/orchestrator.js";

describe("Illegal and Out-Of-Turn Actions", () => {
  const adapter = new NativeEngineAdapter();
  adapter.loadData();

  it("rejects illegal action indices and duplicate submissions", () => {
    const room = new Room("ILLEG1", { teamSize: 3 });
    room.addPlayer("P1", "sock1");
    room.addPlayer("P2", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);
    room.startBattle();

    let p1Prompt: TurnPromptData | undefined;

    const orchestrator = new BattleOrchestrator(
      room,
      adapter,
      new FakeClock(),
      new InMemoryBattleLogStore(),
      {
        onBattleStart: () => {},
        onTurnPrompt: (side, p) => {
          if (side === "p1") p1Prompt = p;
        },
        onTurnResult: () => {},
        onBattleEnd: () => {},
      },
      123
    );

    orchestrator.start();
    assert.ok(p1Prompt !== undefined);

    // 1. Invalid move index (e.g. index 9 when active Pokemon has at most 4 moves)
    assert.throws(() => {
      orchestrator.submitAction("p1", { type: "move", index: 9 });
    }, /ACTION_ILLEGAL/);

    // 2. Submit legal action once
    orchestrator.submitAction("p1", p1Prompt!.legalActions[0]);

    // 3. Submitting a second action on the same turn should be rejected as out of turn
    assert.throws(() => {
      orchestrator.submitAction("p1", p1Prompt!.legalActions[0]);
    }, /ACTION_OUT_OF_TURN/);
  });
});
