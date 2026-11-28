import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PokemonSprite } from "../src/battle/PokemonSprite.js";
import {
  ANIMATION_DURATIONS_MS,
  setAnimationSpeedMultiplier,
  syncAnimationCssVariables,
} from "../src/battle/animationConfig.js";
import { GameProvider } from "../src/state/GameContext.js";
import { ScreenRouter } from "../src/screens/ScreenRouter.js";
import type { GameConnection, ConnectionStatus } from "../src/connection/GameConnection.js";
import { ServerEvents, type PlayerPokemon } from "@pokemon/protocol";

const mockTeam: PlayerPokemon[] = [
  {
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
    ],
  },
];

class MockConn implements GameConnection {
  private listeners = new Map<string, Set<(data: any) => void>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  public emitted: Array<{ event: string; data: any }> = [];
  public status: ConnectionStatus = "connected";
  async connect() {}
  disconnect() {}
  getStatus() {
    return this.status;
  }
  getSocketId() {
    return "sock-1";
  }
  on(event: any, handler: any) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }
  emit(event: any, data: any) {
    this.emitted.push({ event, data });
  }
  onConnectionChange(cb: (s: ConnectionStatus) => void) {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }
  trigger(event: string, data: any) {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

describe("PokemonSprite Animation States & Reduced Motion", () => {
  let matchesReduced = false;

  beforeEach(() => {
    matchesReduced = false;
    setAnimationSpeedMultiplier(1);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesReduced,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    setAnimationSpeedMultiplier(1);
    vi.restoreAllMocks();
  });

  it("syncs CSS custom properties with animationConfig constants and speedMultiplier", () => {
    syncAnimationCssVariables(false, 1);
    const rootStyle = document.documentElement.style;
    expect(rootStyle.getPropertyValue("--entrance-ms")).toBe(`${ANIMATION_DURATIONS_MS.entrance}ms`);
    expect(rootStyle.getPropertyValue("--switch-out-ms")).toBe(`${ANIMATION_DURATIONS_MS.switchOut}ms`);
    expect(rootStyle.getPropertyValue("--hit-ms")).toBe(`${ANIMATION_DURATIONS_MS.hit}ms`);
    expect(rootStyle.getPropertyValue("--faint-ms")).toBe(`${ANIMATION_DURATIONS_MS.faint}ms`);
    expect(rootStyle.getPropertyValue("--hp-transition-ms")).toBe(`${ANIMATION_DURATIONS_MS.faint}ms`);

    setAnimationSpeedMultiplier(0);
    expect(rootStyle.getPropertyValue("--entrance-ms")).toBe("0ms");
    expect(rootStyle.getPropertyValue("--faint-ms")).toBe("0ms");
    expect(rootStyle.getPropertyValue("--hp-transition-ms")).toBe("0ms");
  });

  it("applies distinct entrance, leaving, fainted, and hit CSS classes per side", () => {
    const { rerender } = render(
      <PokemonSprite speciesId="25" name="Pikachu" variant="back" side="player" animationState="entering" />
    );
    let container = screen.getByTestId("pokemon-sprite-container");
    expect(container.className).toContain("sprite-anim-entering-player");
    expect(container).toHaveAttribute("data-animation-state", "entering");

    rerender(
      <PokemonSprite speciesId="7" name="Squirtle" variant="front" side="opponent" animationState="entering" />
    );
    container = screen.getByTestId("pokemon-sprite-container");
    expect(container.className).toContain("sprite-anim-entering-opponent");

    rerender(
      <PokemonSprite speciesId="7" name="Squirtle" variant="front" side="opponent" animationState="leaving" />
    );
    expect(screen.getByTestId("pokemon-sprite-container").className).toContain("sprite-anim-leaving");

    rerender(
      <PokemonSprite speciesId="7" name="Squirtle" variant="front" side="opponent" animationState="fainted" />
    );
    expect(screen.getByTestId("pokemon-sprite-container").className).toContain("sprite-anim-fainted");

    rerender(
      <PokemonSprite speciesId="7" name="Squirtle" variant="front" side="opponent" animationState="idle" isHit={true} />
    );
    container = screen.getByTestId("pokemon-sprite-container");
    expect(container.className).toContain("sprite-anim-hit");
    expect(container).toHaveAttribute("data-hit", "true");
  });

  it("adds sprite-reduced-motion and syncs reduced CSS fade duration when prefers-reduced-motion is active", () => {
    matchesReduced = true;
    render(
      <PokemonSprite speciesId="25" name="Pikachu" variant="front" side="opponent" animationState="entering" />
    );

    const container = screen.getByTestId("pokemon-sprite-container");
    expect(container.className).toContain("sprite-reduced-motion");
    expect(document.documentElement.style.getPropertyValue("--entrance-ms")).toBe(
      `${ANIMATION_DURATIONS_MS.reducedMotionFade}ms`
    );
    expect(document.documentElement.style.getPropertyValue("--hit-ms")).toBe("0ms");
  });

  it("enables move buttons immediately once instant playback finishes and snaps to idle on reconnect resync", () => {
    setAnimationSpeedMultiplier(0);
    sessionStorage.setItem(
      "pokemon_battle_session",
      JSON.stringify({ roomCode: "RESYNC", playerSide: "p1", sessionToken: "tok" })
    );

    const conn = new MockConn();
    render(
      <GameProvider connection={conn}>
        <ScreenRouter />
      </GameProvider>
    );

    act(() => {
      conn.trigger(ServerEvents.ROOM_JOINED, {
        roomCode: "RESYNC",
        playerSide: "p1",
        sessionToken: "tok",
        config: { teamSize: 1, timerEnabled: true, turnDurationSeconds: 90 },
      });
      conn.trigger(ServerEvents.BATTLE_START, {
        seed: 99,
        playerSide: "p1",
        activeIndex: 0,
        team: mockTeam,
        opponentPublic: {
          active: {
            speciesId: "squirtle",
            name: "Squirtle",
            level: 50,
            types: ["water"],
            hpPercent: 80,
            status: "NONE",
            statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
            revealedMoves: [],
          },
          totalTeamSize: 1,
          aliveCount: 1,
          faintedCount: 0,
        },
      });
      conn.trigger(ServerEvents.TURN_PROMPT, {
        turnNumber: 3,
        phase: "ActionSelection",
        legalActions: [{ type: "move", index: 0 }],
        serverTime: Date.now(),
        deadline: Date.now() + 80000,
      });
    });

    // Should snap directly to idle with move buttons immediately enabled (no dialogue lock, no entrance replay)
    const moveBtn = screen.getByRole("button", { name: /Move 1: Thunderbolt/i });
    expect(moveBtn).not.toBeDisabled();

    const containers = screen.getAllByTestId("pokemon-sprite-container");
    for (const c of containers) {
      expect(c).toHaveAttribute("data-animation-state", "idle");
    }
    sessionStorage.clear();
  });
});
