import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BattleSanitizer } from "../src/battle/fog-of-war.js";
import type { EngineTeamData } from "@pokemon/engine-binding";

describe("Hidden Information & Fog of War", () => {
  const sampleEngineTeam: EngineTeamData = {
    activeIndex: 0,
    pokemon: [
      {
        speciesId: "charizard",
        name: "Charizard",
        level: 50,
        currentHp: 120,
        maxHp: 153,
        status: "NONE",
        sleepTurns: 0,
        statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
        moves: [
          { id: "flamethrower", currentPp: 15, maxPp: 15 },
          { id: "slash", currentPp: 20, maxPp: 20 },
          { id: "earthquake", currentPp: 10, maxPp: 10 },
          { id: "swords_dance", currentPp: 30, maxPp: 30 },
        ],
      },
      {
        speciesId: "snorlax",
        name: "Snorlax",
        level: 50,
        currentHp: 230,
        maxHp: 230,
        status: "NONE",
        sleepTurns: 0,
        statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
        moves: [
          { id: "body_slam", currentPp: 15, maxPp: 15 },
          { id: "rest", currentPp: 10, maxPp: 10 },
        ],
      },
      {
        speciesId: "alakazam",
        name: "Alakazam",
        level: 50,
        currentHp: 0,
        maxHp: 130,
        status: "NONE",
        sleepTurns: 0,
        statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
        moves: [
          { id: "psychic", currentPp: 10, maxPp: 10 },
        ],
      },
    ],
  };

  it("proves opponent public view never leaks exact HP, bench details, or unrevealed moves", () => {
    const revealedMoves = new Set<string>(["flamethrower"]);
    const opponentView = BattleSanitizer.getOpponentPublicState(sampleEngineTeam, revealedMoves);

    // 1. Team counts are present, but individual bench details are strictly stripped
    assert.strictEqual(opponentView.totalTeamSize, 3);
    assert.strictEqual(opponentView.aliveCount, 2);
    assert.strictEqual(opponentView.faintedCount, 1);
    assert.strictEqual((opponentView as any).pokemon, undefined);
    assert.strictEqual((opponentView as any).bench, undefined);

    // 2. Active Pokemon has hpPercent, not raw currentHp/maxHp numbers
    assert.ok(opponentView.active !== null);
    assert.strictEqual(opponentView.active?.speciesId, "charizard");
    assert.strictEqual(opponentView.active?.hpPercent, 79); // Math.ceil(120 / 153 * 100)
    assert.strictEqual((opponentView.active as any).currentHp, undefined);
    assert.strictEqual((opponentView.active as any).maxHp, undefined);

    // 3. Active Pokemon exposes ONLY revealed moves
    assert.deepStrictEqual(opponentView.active?.revealedMoves, ["flamethrower"]);
    assert.strictEqual((opponentView.active as any).moves, undefined);

    // Ensure hidden moves (slash, earthquake, swords_dance) and bench pokemon (snorlax, alakazam) never appear anywhere
    const serialized = JSON.stringify(opponentView);
    assert.strictEqual(serialized.includes("slash"), false, "Unrevealed move 'slash' must not appear");
    assert.strictEqual(serialized.includes("earthquake"), false, "Unrevealed move 'earthquake' must not appear");
    assert.strictEqual(serialized.includes("swords_dance"), false, "Unrevealed move 'swords_dance' must not appear");
    assert.strictEqual(serialized.includes("snorlax"), false, "Bench pokemon 'snorlax' must not appear");
    assert.strictEqual(serialized.includes("alakazam"), false, "Bench pokemon 'alakazam' must not appear");
  });
});
