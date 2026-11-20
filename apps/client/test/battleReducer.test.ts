import { describe, it, expect } from "vitest";
import { battleReducer, initialBattleViewState } from "../src/state/battleReducer.js";
import type { BattleViewState, TurnPromptPayload } from "../src/state/types.js";
import type {
  PlayerPokemon,
  OpponentPublicState,
} from "@pokemon/protocol";

const mockPokemon: PlayerPokemon = {
  speciesId: "pikachu",
  name: "Pikachu",
  level: 50,
  types: ["electric"],
  currentHp: 100,
  maxHp: 100,
  status: "NONE",
  statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
  moves: [
    { id: "thunderbolt", name: "Thunderbolt", type: "electric", currentPp: 15, maxPp: 15, basePower: 95, accuracy: 100 },
    { id: "quick-attack", name: "Quick Attack", type: "normal", currentPp: 30, maxPp: 30, basePower: 40, accuracy: 100 },
  ],
};

const mockOpponent: OpponentPublicState = {
  active: {
    speciesId: "squirtle",
    name: "Squirtle",
    level: 50,
    types: ["water"],
    hpPercent: 100,
    status: "NONE",
    statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
    revealedMoves: ["water-gun"],
  },
  totalTeamSize: 3,
  aliveCount: 3,
  faintedCount: 0,
};

describe("battleReducer", () => {
  it("transitions to lobby on ROOM_JOINED", () => {
    const state = battleReducer(initialBattleViewState, {
      type: "ROOM_JOINED",
      payload: {
        roomCode: "TEST12",
        playerSide: "p1",
        sessionToken: "token-abc",
        config: { teamSize: 3, timerEnabled: true, turnDurationSeconds: 90 },
      },
    });

    expect(state.screen).toBe("lobby");
    expect(state.room.roomCode).toBe("TEST12");
    expect(state.room.playerSide).toBe("p1");
    expect(state.room.sessionToken).toBe("token-abc");
  });

  it("initializes battle state on BATTLE_START", () => {
    let state = battleReducer(initialBattleViewState, {
      type: "ROOM_JOINED",
      payload: {
        roomCode: "TEST12",
        playerSide: "p1",
        sessionToken: "token-abc",
        config: { teamSize: 3, timerEnabled: true, turnDurationSeconds: 90 },
      },
    });

    state = battleReducer(state, {
      type: "BATTLE_START",
      payload: {
        seed: 42,
        team: [mockPokemon],
        opponentPublic: mockOpponent,
      },
    });

    expect(state.screen).toBe("battle");
    expect(state.battle.seed).toBe(42);
    expect(state.battle.myTeam).toHaveLength(1);
    expect(state.battle.activePokemonIndex).toBe(0);
    expect(state.battle.logEntries).toHaveLength(1);
    expect(state.battle.logEntries[0].text).toContain("Battle started!");
  });

  it("processes normal turn execution and damage in TURN_RESULT", () => {
    let state: BattleViewState = {
      ...initialBattleViewState,
      screen: "battle",
      room: {
        ...initialBattleViewState.room,
        playerSide: "p1",
      },
      battle: {
        ...initialBattleViewState.battle,
        myTeam: [mockPokemon],
        opponentPublic: mockOpponent,
      },
    };

    const damagedPokemon: PlayerPokemon = {
      ...mockPokemon,
      currentHp: 75,
    };

    state = battleReducer(state, {
      type: "TURN_RESULT",
      payload: {
        turnNumber: 1,
        events: [
          { type: "MoveUsed", side: "p2", pokemon: "Squirtle", move: "water-gun" },
          { type: "DamageDealt", side: "p1", intValue1: 25 },
        ],
        yourTeam: [damagedPokemon],
        opponentPublic: mockOpponent,
      },
    });

    expect(state.battle.myTeam[0].currentHp).toBe(75);
    expect(state.battle.logEntries).toHaveLength(2);
    expect(state.battle.logEntries[0].text).toContain("Squirtle used water-gun");
    expect(state.battle.logEntries[1].text).toContain("You took 25 damage");
  });

  it("updates activePokemonIndex on SwitchedIn event for own side", () => {
    const secondPokemon: PlayerPokemon = {
      ...mockPokemon,
      speciesId: "charizard",
      name: "Charizard",
    };

    let state: BattleViewState = {
      ...initialBattleViewState,
      screen: "battle",
      room: {
        ...initialBattleViewState.room,
        playerSide: "p1",
      },
      battle: {
        ...initialBattleViewState.battle,
        myTeam: [mockPokemon, secondPokemon],
        activePokemonIndex: 0,
      },
    };

    state = battleReducer(state, {
      type: "TURN_RESULT",
      payload: {
        turnNumber: 2,
        events: [
          { type: "SwitchedIn", side: "p1", pokemon: "Charizard" },
        ],
        yourTeam: [mockPokemon, secondPokemon],
        opponentPublic: mockOpponent,
      },
    });

    expect(state.battle.activePokemonIndex).toBe(1);
  });

  it("handles forced switch phase and switches activeTab to switch", () => {
    let state: BattleViewState = {
      ...initialBattleViewState,
      screen: "battle",
      room: {
        ...initialBattleViewState.room,
        playerSide: "p1",
      },
      battle: {
        ...initialBattleViewState.battle,
        myTeam: [mockPokemon],
        activeTab: "moves",
      },
    };

    const forcedPrompt: TurnPromptPayload = {
      turnNumber: 3,
      phase: "ForcedSwitchP1",
      legalActions: [{ type: "switch", index: 1 }],
      serverTime: Date.now(),
    };

    state = battleReducer(state, {
      type: "TURN_PROMPT",
      payload: forcedPrompt,
    });

    expect(state.battle.phase).toBe("ForcedSwitchP1");
    expect(state.battle.activeTab).toBe("switch");
    expect(state.battle.currentDialogue).toBeNull();
  });

  it("handles ACTION_SUBMITTED and CANCEL_ACTION smoothly", () => {
    let state: BattleViewState = {
      ...initialBattleViewState,
      screen: "battle",
    };

    state = battleReducer(state, { type: "ACTION_SUBMITTED" });
    expect(state.battle.isSubmitting).toBe(true);
    expect(state.battle.waitingForOpponent).toBe(true);
    expect(state.battle.currentDialogue).toBe("Waiting for opponent...");

    state = battleReducer(state, { type: "CANCEL_ACTION" });
    expect(state.battle.isSubmitting).toBe(false);
    expect(state.battle.waitingForOpponent).toBe(false);
    expect(state.battle.currentDialogue).toBeNull();
  });

  it("handles BATTLE_END and transitions to result screen", () => {
    let state: BattleViewState = {
      ...initialBattleViewState,
      screen: "battle",
      room: {
        ...initialBattleViewState.room,
        playerSide: "p1",
      },
    };

    state = battleReducer(state, {
      type: "BATTLE_END",
      payload: {
        winner: "p1",
        reason: "knockout",
        replayLogId: "replay-uuid-1234",
      },
    });

    expect(state.screen).toBe("result");
    expect(state.battle.winner).toBe("p1");
    expect(state.battle.endReason).toBe("knockout");
    expect(state.battle.replayLogId).toBe("replay-uuid-1234");
  });

  it("sets 30s grace deadline when opponent disconnects mid-battle", () => {
    let state: BattleViewState = {
      ...initialBattleViewState,
      screen: "battle",
      room: {
        ...initialBattleViewState.room,
        playerSide: "p1",
      },
      battle: {
        ...initialBattleViewState.battle,
        opponentDisconnected: false,
      },
    };

    state = battleReducer(state, {
      type: "ROOM_STATE",
      payload: {
        state: "InProgress",
        players: [
          { name: "Red", side: "p1", isConnected: true, isReady: true },
          { name: "Blue", side: "p2", isConnected: false, isReady: true },
        ],
      },
    });

    expect(state.battle.opponentDisconnected).toBe(true);
    expect(state.battle.opponentGraceDeadline).toBeGreaterThan(Date.now());
  });
});
