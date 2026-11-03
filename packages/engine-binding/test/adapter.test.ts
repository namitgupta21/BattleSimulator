import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { NativeEngineAdapter } from "../src/adapter.js";

describe("NativeEngineAdapter and BattleSession", () => {
  const adapter = new NativeEngineAdapter();
  const dataLoaded = adapter.loadData();

  it("successfully loads game data from ./data", () => {
    assert.strictEqual(dataLoaded, true, "Data should be loaded successfully");
  });

  it("generates deterministic teams for identical seeds", () => {
    const teamA = adapter.generateTeam(1337, 3, 50);
    const teamB = adapter.generateTeam(1337, 3, 50);
    const teamC = adapter.generateTeam(9999, 3, 50);

    assert.strictEqual(teamA.pokemon.length, 3);
    assert.deepStrictEqual(teamA, teamB, "Same seed must produce identical teams");
    assert.notDeepStrictEqual(teamA, teamC, "Different seeds must produce different teams");
  });

  it("strictly enforces that the engine timer is disabled and never applies its own timer", () => {
    const t1 = adapter.generateTeam(101, 3, 50);
    const t2 = adapter.generateTeam(102, 3, 50);

    // Factory creates battle session without any timer configuration parameter
    const battle = adapter.createBattle(42, t1, t2);

    // Assert that engine timer is contractually disabled
    assert.strictEqual(battle.isEngineTimerEnabled, false);

    // Assert execution is instantaneous and non-blocking (free of wall-clock time)
    const start = Date.now();
    const legal1 = battle.getLegalActions("p1");
    const legal2 = battle.getLegalActions("p2");
    const result = battle.step(legal1[0], legal2[0]);
    const durationMs = Date.now() - start;

    assert.ok(durationMs < 50, `Turn resolution should take <50ms without wall-clock timer, took ${durationMs}ms`);
    assert.ok(result.events.length > 0, "Turn should produce battle events");
    assert.ok(result.nextState.turnNumber >= 1);
    assert.ok(["ActionSelection", "ForcedSwitchP1", "ForcedSwitchP2", "ForcedSwitchBoth", "GameOver"].includes(result.nextState.phase));
  });

  it("retrieves legal actions and switches for both sides", () => {
    const t1 = adapter.generateTeam(201, 3, 50);
    const t2 = adapter.generateTeam(202, 3, 50);
    const battle = adapter.createBattle(77, t1, t2);

    const p1Actions = battle.getLegalActions("p1");
    const p2Actions = battle.getLegalActions("p2");

    assert.ok(p1Actions.length > 0);
    assert.ok(p2Actions.length > 0);

    // Should include both move actions and switch actions (bench has 2 pokemon)
    const p1Moves = p1Actions.filter((a) => a.type === "move");
    const p1Switches = p1Actions.filter((a) => a.type === "switch");

    assert.ok(p1Moves.length >= 1 && p1Moves.length <= 4);
    assert.strictEqual(p1Switches.length, 2, "Bench should have 2 switch targets");
  });
});
