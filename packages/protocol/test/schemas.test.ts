import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RoomCreateSchema,
  RoomJoinSchema,
  BattleActionSchema,
  TurnPromptPayloadSchema,
  OpponentPublicPokemonSchema,
  ErrorCode
} from "../src/index.js";

describe("Protocol Validation Schemas", () => {
  test("RoomCreateSchema validates correctly", () => {
    const valid = RoomCreateSchema.safeParse({
      playerName: "Red",
      teamSize: 6,
      timerEnabled: true,
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.playerName, "Red");
      assert.equal(valid.data.teamSize, 6);
      assert.equal(valid.data.timerEnabled, true);
    }

    const emptyName = RoomCreateSchema.safeParse({
      playerName: "   ",
      timerEnabled: true,
    });
    assert.equal(emptyName.success, false);

    const invalidTeam = RoomCreateSchema.safeParse({
      playerName: "Blue",
      teamSize: 7,
      timerEnabled: true,
    });
    assert.equal(invalidTeam.success, false);
  });

  test("RoomJoinSchema normalizes room code", () => {
    const valid = RoomJoinSchema.safeParse({
      roomCode: "pkmn7x",
      playerName: "Blue",
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.roomCode, "PKMN7X");
    }
  });

  test("BattleActionSchema validates move and switch actions", () => {
    const validMove = BattleActionSchema.safeParse({
      action: { type: "move", index: 0 },
    });
    assert.equal(validMove.success, true);

    const validSwitch = BattleActionSchema.safeParse({
      action: { type: "switch", index: 3 },
    });
    assert.equal(validSwitch.success, true);

    const invalidType = BattleActionSchema.safeParse({
      action: { type: "item", index: 0 },
    });
    assert.equal(invalidType.success, false);

    const negativeIndex = BattleActionSchema.safeParse({
      action: { type: "move", index: -1 },
    });
    assert.equal(negativeIndex.success, false);
  });

  test("TurnPromptPayloadSchema accepts legal actions and serverTime", () => {
    const valid = TurnPromptPayloadSchema.safeParse({
      turnNumber: 1,
      phase: "ActionSelection",
      legalActions: [
        { type: "move", index: 0 },
        { type: "switch", index: 1 },
      ],
      serverTime: 1700000000000,
      deadline: 1700000090000,
      remainingMs: 90000,
    });
    assert.equal(valid.success, true);
  });

  test("OpponentPublicPokemonSchema restricts visible fields and rejects invalid hpPercent", () => {
    const valid = OpponentPublicPokemonSchema.safeParse({
      speciesId: "pikachu",
      name: "Pikachu",
      level: 50,
      types: ["Electric"],
      hpPercent: 85.5,
      status: "NONE",
      statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
      revealedMoves: ["Thunderbolt"],
    });
    assert.equal(valid.success, true);

    const overMaxHpPercent = OpponentPublicPokemonSchema.safeParse({
      speciesId: "pikachu",
      name: "Pikachu",
      level: 50,
      types: ["Electric"],
      hpPercent: 120, // Invalid!
      status: "NONE",
      statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
      revealedMoves: [],
    });
    assert.equal(overMaxHpPercent.success, false);
  });
});
