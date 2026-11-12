import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room/room.js";
import { BattleOrchestrator } from "../src/battle/orchestrator.js";
import { SystemClock } from "../src/clock/clock.js";
import { InMemoryBattleLogStore } from "../src/store/battle-log-store.js";
import { NativeEngineAdapter } from "@pokemon/engine-binding";
import type { TurnPromptData } from "../src/battle/orchestrator.js";

describe("Deterministic Battle Replay", () => {
  const adapter = new NativeEngineAdapter();
  adapter.loadData();

  it("stores battle actions and replays deterministically with identical outcome", () => {
    const room = new Room("REPLAY1", { teamSize: 3, timerEnabled: false });
    room.addPlayer("P1", "sock1");
    room.addPlayer("P2", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);
    room.startBattle();

    const logStore = new InMemoryBattleLogStore();
    let promptsP1: TurnPromptData[] = [];
    let promptsP2: TurnPromptData[] = [];
    let battleId = "";

    const orchestrator = new BattleOrchestrator(
      room,
      adapter,
      new SystemClock(),
      logStore,
      {
        onBattleStart: () => {},
        onTurnPrompt: (side, p) => {
          if (side === "p1") promptsP1.push(p);
          else promptsP2.push(p);
        },
        onTurnResult: () => {},
        onBattleEnd: (e) => {
          battleId = e.replayLogId;
        },
      },
      777
    );

    orchestrator.start();

    // Play up to 3 rounds of actions/switches
    for (let t = 0; t < 3; t++) {
      if (orchestrator.isBattleFinished()) break;
      const act1 = promptsP1[promptsP1.length - 1]?.legalActions?.[0];
      const act2 = promptsP2[promptsP2.length - 1]?.legalActions?.[0];
      if (act1) orchestrator.submitAction("p1", act1);
      if (act2) orchestrator.submitAction("p2", act2);
    }

    // Forfeit to conclude and record
    if (!orchestrator.isBattleFinished()) {
      orchestrator.forfeitBattle("p2", "forfeit");
    }

    const record = logStore.get(battleId);
    assert.ok(record !== null);
    assert.ok(record.turns.length > 0);

    // Replay simulation using saved seed and teams
    const replaySession = adapter.createBattle(record.seed, record.p1Team, record.p2Team);

    for (const turn of record.turns) {
      const state = replaySession.getState();
      let replayRes: any;
      if (state.phase.startsWith("ForcedSwitch")) {
        replayRes = replaySession.resolveForcedSwitches(
          (turn.actions.p1 as any) ?? null,
          (turn.actions.p2 as any) ?? null
        );
      } else if (turn.actions.p1 && turn.actions.p2) {
        replayRes = replaySession.step(
          turn.actions.p1 as any,
          turn.actions.p2 as any
        );
      } else {
        continue;
      }

      // Assert event counts and types match turn-for-turn
      assert.strictEqual(replayRes.events.length, turn.events.length);
      for (let i = 0; i < replayRes.events.length; i++) {
        assert.strictEqual(replayRes.events[i].type, turn.events[i].type);
        assert.strictEqual(replayRes.events[i].side, turn.events[i].side);
      }
    }
  });
});
