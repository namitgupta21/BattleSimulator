import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BattleEventSequencer, type VisualPlaybackSnapshot } from "../src/battle/eventSequencer.js";
import {
  ANIMATION_DURATIONS_MS,
  getAnimationSpeedMultiplier,
  setAnimationSpeedMultiplier,
} from "../src/battle/animationConfig.js";
import type { OpponentPublicState, PlayerPokemon } from "@pokemon/protocol";

const makeMon = (speciesId: string, name: string, hp = 100, maxHp = 100): PlayerPokemon => ({
  speciesId,
  name,
  level: 50,
  types: ["electric"],
  currentHp: hp,
  maxHp,
  status: "NONE",
  statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
  moves: [],
});

const makeOpp = (
  speciesId: string,
  name: string,
  hpPercent = 100,
  aliveCount = 2,
  faintedCount = 0
): OpponentPublicState => ({
  active: {
    speciesId,
    name,
    level: 50,
    types: ["water"],
    hpPercent,
    status: "NONE",
    statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
    revealedMoves: [],
  },
  totalTeamSize: aliveCount + faintedCount,
  aliveCount,
  faintedCount,
});

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

describe("BattleEventSequencer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAnimationSpeedMultiplier(1);
  });

  afterEach(() => {
    setAnimationSpeedMultiplier(1);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for sprite readiness before playing battle start entrance (~400ms)", async () => {
    let resolvePlayerSprite!: () => void;
    let resolveOppSprite!: () => void;
    const waitMock = vi.fn((poke: { name?: string }) => {
      return new Promise<void>((resolve) => {
        if (poke.name === "Pikachu") resolvePlayerSprite = resolve;
        else resolveOppSprite = resolve;
      });
    });

    const snapshots: VisualPlaybackSnapshot[] = [];
    const seq = new BattleEventSequencer((s) => snapshots.push({ ...s }), waitMock);
    const onComplete = vi.fn();

    seq.playBattleStart({
      playerTeam: [makeMon("pikachu", "Pikachu")],
      playerActiveIndex: 0,
      opponentPublic: makeOpp("squirtle", "Squirtle"),
      onComplete,
    });

    // While sprites are loading, sprites stay idle (entrance animation has NOT started yet)
    expect(seq.getSnapshot().isPlaying).toBe(true);
    expect(seq.getSnapshot().playerAnimState).toBe("idle");
    expect(seq.getSnapshot().opponentAnimState).toBe("idle");
    expect(seq.getSnapshot().playerEntrySeq).toBe(0);

    // Sprites finish loading -> now entrance starts and entrySeq increments
    resolvePlayerSprite();
    resolveOppSprite();
    await flushMicrotasks();

    expect(seq.getSnapshot().playerAnimState).toBe("entering");
    expect(seq.getSnapshot().opponentAnimState).toBe("entering");
    expect(seq.getSnapshot().playerEntrySeq).toBe(1);
    expect(seq.getSnapshot().opponentEntrySeq).toBe(1);

    // At 399ms, still entering
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.entrance - 1);
    expect(seq.getSnapshot().playerAnimState).toBe("entering");
    expect(onComplete).not.toHaveBeenCalled();

    // At 400ms, completes to idle
    await vi.advanceTimersByTimeAsync(1);
    expect(seq.getSnapshot().playerAnimState).toBe("idle");
    expect(seq.getSnapshot().opponentAnimState).toBe("idle");
    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);

    seq.destroy();
  });

  it("plays damage hit (250ms), faint (500ms with synced HP=0 & delayed bench update), and switch (200ms leave -> 400ms enter) in exact order", async () => {
    const instantWait = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, instantWait);

    const prevTeam = [makeMon("pikachu", "Pikachu", 100, 100), makeMon("charizard", "Charizard", 150, 150)];
    const prevOpp = makeOpp("squirtle", "Squirtle", 100, 2, 0);

    const nextTeam = [makeMon("pikachu", "Pikachu", 0, 100), makeMon("charizard", "Charizard", 150, 150)];
    const nextOpp: OpponentPublicState = {
      ...makeOpp("blastoise", "Blastoise", 100, 2, 0),
      revealedBench: [
        {
          speciesId: "squirtle",
          name: "Squirtle",
          level: 50,
          types: ["water"],
          hpPercent: 60,
          status: "NONE",
          statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
          revealedMoves: [],
        },
      ],
    };

    const onComplete = vi.fn();
    seq.playTurnResult({
      prevPlayerTeam: prevTeam,
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: prevOpp,
      nextPlayerTeam: nextTeam,
      nextPlayerActiveIndex: 1,
      nextOpponentPublic: nextOpp,
      mySide: "p1",
      events: [
        { type: "DamageDealt", side: "p2", pokemon: "Squirtle", intValue1: 40 },
        { type: "SwitchedIn", side: "p2", pokemon: "Blastoise" },
        { type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 100, intValue2: 0 },
        { type: "Fainted", side: "p1", pokemon: "Pikachu" },
        { type: "SwitchedIn", side: "p1", pokemon: "Charizard" },
      ],
      onComplete,
    });

    await flushMicrotasks();

    // Step 1: DamageDealt on p2 -> opponentHit true for 250ms
    expect(seq.getSnapshot().opponentHit).toBe(true);
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.hit);
    expect(seq.getSnapshot().opponentHit).toBe(false);

    // Step 2: SwitchedIn p2 -> Squirtle leaves for 200ms first
    expect(seq.getSnapshot().opponentAnimState).toBe("leaving");
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.switchOut);
    await flushMicrotasks();

    // Now Blastoise enters for 400ms
    expect(seq.getSnapshot().opponentPublic?.active?.name).toBe("Blastoise");
    expect(seq.getSnapshot().opponentAnimState).toBe("entering");
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.entrance);
    expect(seq.getSnapshot().opponentAnimState).toBe("idle");

    // Step 3: DamageDealt on p1 -> playerHit for 250ms
    await flushMicrotasks();
    expect(seq.getSnapshot().playerHit).toBe(true);
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.hit);
    expect(seq.getSnapshot().playerHit).toBe(false);

    // Step 4: Fainted p1 -> Pikachu animates fainted (500ms) + active HP = 0,
    // BUT bench icon (playerTeam[0].currentHp) stays > 0 until faint animation completes!
    await flushMicrotasks();
    expect(seq.getSnapshot().playerAnimState).toBe("fainted");
    expect(seq.getSnapshot().playerActiveHpOverride).toBe(0);
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(100);

    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.faint - 1);
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(100);

    await vi.advanceTimersByTimeAsync(1);
    // Faint finished -> bench icon updates to 0 HP!
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(0);

    // Step 5: SwitchedIn p1 -> because Pikachu fainted, NO leaving phase; goes straight to Charizard entering (400ms)
    await flushMicrotasks();
    expect(seq.getSnapshot().playerActiveIndex).toBe(1);
    expect(seq.getSnapshot().playerAnimState).toBe("entering");
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.entrance);

    expect(seq.getSnapshot().playerAnimState).toBe("idle");
    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);

    seq.destroy();
  });

  it("skipping playback immediately produces the exact same final state as playing in full", async () => {
    const instantWait = vi.fn().mockResolvedValue(undefined);
    const params = {
      prevPlayerTeam: [makeMon("pikachu", "Pikachu", 100, 100), makeMon("charizard", "Charizard", 150, 150)],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100, 2, 0),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu", 0, 100), makeMon("charizard", "Charizard", 150, 150)],
      nextPlayerActiveIndex: 1,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 40, 2, 0),
      mySide: "p1" as const,
      events: [
        { type: "DamageDealt", side: "p2" as const, pokemon: "Squirtle", intValue1: 60 },
        { type: "Fainted", side: "p1" as const, pokemon: "Pikachu" },
        { type: "SwitchedIn", side: "p1" as const, pokemon: "Charizard" },
      ],
    };

    const fullSeq = new BattleEventSequencer(() => {}, instantWait);
    fullSeq.playTurnResult(params);
    await vi.runAllTimersAsync();
    const fullFinal = fullSeq.getSnapshot();

    const skippedSeq = new BattleEventSequencer(() => {}, instantWait);
    skippedSeq.playTurnResult(params);
    skippedSeq.skip();
    const skippedFinal = skippedSeq.getSnapshot();

    expect(skippedFinal).toEqual(fullFinal);
    expect(vi.getTimerCount()).toBe(0);

    fullSeq.destroy();
    skippedSeq.destroy();
  });

  it("executes instantaneously with zero timers when speedMultiplier is 0", () => {
    setAnimationSpeedMultiplier(0);
    expect(getAnimationSpeedMultiplier()).toBe(0);

    const waitMock = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, waitMock);
    const onComplete = vi.fn();

    seq.playBattleStart({
      playerTeam: [makeMon("pikachu", "Pikachu")],
      playerActiveIndex: 0,
      opponentPublic: makeOpp("squirtle", "Squirtle"),
      onComplete,
    });

    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(seq.getSnapshot().playerAnimState).toBe("idle");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(waitMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    seq.destroy();
  });

  it("uses reduced-motion duration (REDUCED_MOTION_FADE_MS) and skips hit wait when prefersReducedMotion is true", async () => {
    const instantWait = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, instantWait);
    const onComplete = vi.fn();

    seq.playTurnResult({
      prevPlayerTeam: [makeMon("pikachu", "Pikachu", 100, 100)],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100, 1, 0),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu", 0, 100)],
      nextPlayerActiveIndex: 0,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 100, 1, 0),
      mySide: "p1",
      prefersReducedMotion: true,
      events: [
        { type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 100, intValue2: 0 },
        { type: "Fainted", side: "p1", pokemon: "Pikachu" },
      ],
      onComplete,
    });

    await flushMicrotasks();
    // Should finish in REDUCED_MOTION_FADE_MS (100ms), NOT 500ms + 250ms
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.reducedMotionFade);
    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);

    seq.destroy();
  });

  it("cancels pending timers on destroy() and when new turn events arrive mid-playback", async () => {
    const instantWait = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, instantWait);
    const firstTurnDone = vi.fn();
    const secondTurnDone = vi.fn();

    seq.playTurnResult({
      prevPlayerTeam: [makeMon("pikachu", "Pikachu", 100, 100)],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu", 70, 100)],
      nextPlayerActiveIndex: 0,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      mySide: "p1",
      events: [{ type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 30, intValue2: 70 }],
      onComplete: firstTurnDone,
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Mid-playback, Turn 2 events arrive! Turn 1 timers must be cancelled immediately
    seq.playTurnResult({
      prevPlayerTeam: [makeMon("pikachu", "Pikachu", 70, 100)],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu", 50, 100)],
      nextPlayerActiveIndex: 0,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      mySide: "p1",
      events: [{ type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 20, intValue2: 50 }],
      onComplete: secondTurnDone,
    });

    await vi.runAllTimersAsync();
    expect(firstTurnDone).not.toHaveBeenCalled();
    expect(secondTurnDone).toHaveBeenCalledTimes(1);

    // Verify unmount cleanup cancels any active timer
    const battleStartDone = vi.fn();
    seq.playBattleStart({
      playerTeam: [makeMon("pikachu", "Pikachu")],
      playerActiveIndex: 0,
      opponentPublic: makeOpp("squirtle", "Squirtle"),
      onComplete: battleStartDone,
    });
    await flushMicrotasks();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    seq.destroy();
    expect(vi.getTimerCount()).toBe(0);
    await vi.runAllTimersAsync();
    expect(battleStartDone).not.toHaveBeenCalled();
  });

  it("never triggers opponent entrance animation or sprite wait for an unrevealed opponent Pokémon", async () => {
    const waitMock = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, waitMock);

    // Suppose SwitchedIn mentions "Mewtwo", but server's nextOpponentPublic still only lists "Squirtle"
    seq.playTurnResult({
      prevPlayerTeam: [makeMon("pikachu", "Pikachu")],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu")],
      nextPlayerActiveIndex: 0,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      mySide: "p1",
      events: [{ type: "SwitchedIn", side: "p2", pokemon: "Mewtwo" }],
    });

    await vi.runAllTimersAsync();
    expect(waitMock).not.toHaveBeenCalled();
    expect(seq.getSnapshot().opponentEntrySeq).toBe(0);
    expect(seq.getSnapshot().opponentPublic?.active?.name).toBe("Squirtle");

    seq.destroy();
  });

  it("snaps straight to idle with zero replay when isResync is true", () => {
    const waitMock = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, waitMock);
    const onComplete = vi.fn();

    seq.playBattleStart({
      playerTeam: [makeMon("pikachu", "Pikachu", 65, 100)],
      playerActiveIndex: 0,
      opponentPublic: makeOpp("squirtle", "Squirtle", 50),
      isResync: true,
      onComplete,
    });

    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(seq.getSnapshot().playerAnimState).toBe("idle");
    expect(seq.getSnapshot().opponentAnimState).toBe("idle");
    expect(seq.getSnapshot().playerEntrySeq).toBe(0);
    expect(waitMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);

    seq.destroy();
  });

  it("reduces HP sequentially in exact move order rather than simultaneously", async () => {
    const instantWait = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, instantWait);

    // Scenario: Foe moves first (damages player), then Player moves second (damages foe)
    seq.playTurnResult({
      prevPlayerTeam: [makeMon("pikachu", "Pikachu", 100, 100)],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu", 65, 100)],
      nextPlayerActiveIndex: 0,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 40),
      mySide: "p1",
      events: [
        { type: "MoveUsed", side: "p2", pokemon: "Squirtle", move: "water-gun" },
        { type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 35, intValue2: 65 },
        { type: "MoveUsed", side: "p1", pokemon: "Pikachu", move: "thunderbolt" },
        { type: "DamageDealt", side: "p2", pokemon: "Squirtle", intValue1: 60 },
      ],
    });

    // Initially neither HP has changed (reading Foe's MoveUsed beat)
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(100);
    expect(seq.getSnapshot().opponentPublic?.active?.hpPercent).toBe(100);

    // Advance past Move 1 dialogue beat -> Player HP drops to 65 while Foe HP is STILL 100!
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.moveBeat);
    await flushMicrotasks();
    expect(seq.getSnapshot().playerActiveHpOverride).toBe(65);
    expect(seq.getSnapshot().playerHit).toBe(true);
    expect(seq.getSnapshot().opponentPublic?.active?.hpPercent).toBe(100);
    expect(seq.getSnapshot().opponentHit).toBe(false);

    // Advance past Move 1 hit (250ms) -> Player hit ends; Move 2 dialogue beat runs while Foe HP is STILL 100!
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.hit);
    await flushMicrotasks();
    expect(seq.getSnapshot().playerHit).toBe(false);
    expect(seq.getSnapshot().opponentPublic?.active?.hpPercent).toBe(100);

    // Advance past Move 2 dialogue beat -> NOW Foe HP drops to 40!
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.moveBeat);
    await flushMicrotasks();
    expect(seq.getSnapshot().opponentActiveHpOverride).toBe(40);
    expect(seq.getSnapshot().opponentHit).toBe(true);

    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.hit);
    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(65);
    expect(seq.getSnapshot().opponentPublic?.active?.hpPercent).toBe(40);

    seq.destroy();
  });

  it("pauses on each stage when autoAdvance is false and steps one event per advance() call", async () => {
    const instantWait = vi.fn().mockResolvedValue(undefined);
    const seq = new BattleEventSequencer(() => {}, instantWait);
    const onComplete = vi.fn();

    seq.playTurnResult({
      prevPlayerTeam: [makeMon("pikachu", "Pikachu", 100, 100)],
      prevPlayerActiveIndex: 0,
      prevOpponentPublic: makeOpp("squirtle", "Squirtle", 100),
      nextPlayerTeam: [makeMon("pikachu", "Pikachu", 80, 100)],
      nextPlayerActiveIndex: 0,
      nextOpponentPublic: makeOpp("squirtle", "Squirtle", 55),
      mySide: "p1",
      autoAdvance: false,
      events: [
        { type: "MoveUsed", side: "p1", pokemon: "Pikachu", move: "thunderbolt" },
        { type: "DamageDealt", side: "p2", pokemon: "Squirtle", intValue1: 45 },
        { type: "MoveUsed", side: "p2", pokemon: "Squirtle", move: "water-gun" },
        { type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 20, intValue2: 80 },
      ],
      onComplete,
    });

    await flushMicrotasks();
    // Paused on Event 1 (MoveUsed p1) — waiting for user Enter!
    expect(seq.getSnapshot().currentDialogue).toContain("Pikachu used thunderbolt");
    expect(seq.getSnapshot().opponentPublic?.active?.hpPercent).toBe(100);
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(100);

    // User presses Enter -> Event 2 (DamageDealt p2): ONLY Squirtle takes damage & shakes!
    seq.advance();
    await flushMicrotasks();
    expect(seq.getSnapshot().currentDialogue).toContain("Foe took 45 damage");
    expect(seq.getSnapshot().opponentActiveHpOverride).toBe(55);
    expect(seq.getSnapshot().opponentHit).toBe(true);
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(100);
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.hit);
    await flushMicrotasks();
    expect(seq.getSnapshot().opponentHit).toBe(false);
    // Still paused on "Foe took 45 damage!" until user presses Enter!
    expect(seq.getSnapshot().currentDialogue).toContain("Foe took 45 damage");

    // User presses Enter -> Event 3 (MoveUsed p2)
    seq.advance();
    await flushMicrotasks();
    expect(seq.getSnapshot().currentDialogue).toContain("Squirtle used water-gun");
    expect(seq.getSnapshot().playerTeam[0].currentHp).toBe(100);

    // User presses Enter -> Event 4 (DamageDealt p1): NOW Pikachu takes damage!
    seq.advance();
    await flushMicrotasks();
    expect(seq.getSnapshot().currentDialogue).toContain("You took 20 damage");
    expect(seq.getSnapshot().playerActiveHpOverride).toBe(80);
    expect(seq.getSnapshot().playerHit).toBe(true);
    await vi.advanceTimersByTimeAsync(ANIMATION_DURATIONS_MS.hit);

    // User presses Enter after final step -> completes turn and unlocks MoveGrid
    seq.advance();
    await flushMicrotasks();
    expect(seq.getSnapshot().isPlaying).toBe(false);
    expect(seq.getSnapshot().currentDialogue).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);

    seq.destroy();
  });
});
