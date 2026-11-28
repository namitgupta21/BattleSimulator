import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MoveGrid } from "../src/battle/MoveGrid.js";
import { SwitchMenu } from "../src/battle/SwitchMenu.js";
import { TurnCountdown } from "../src/battle/TurnCountdown.js";
import { MobileLogDrawer } from "../src/shell/MobileLogDrawer.js";
import { GameProvider } from "../src/state/GameContext.js";
import { ScreenRouter } from "../src/screens/ScreenRouter.js";
import type { GameConnection, ConnectionStatus } from "../src/connection/GameConnection.js";
import { ClientEvents, ServerEvents, type MoveSlot, type PlayerPokemon } from "@pokemon/protocol";

const mockMoves: MoveSlot[] = [
  { id: "thunderbolt", name: "Thunderbolt", type: "electric", currentPp: 15, maxPp: 15, basePower: 95, accuracy: 100 },
  { id: "quick-attack", name: "Quick Attack", type: "normal", currentPp: 30, maxPp: 30, basePower: 40, accuracy: 100 },
  { id: "thunder-wave", name: "Thunder Wave", type: "electric", currentPp: 20, maxPp: 20, basePower: 0, accuracy: 100 },
  { id: "surf", name: "Surf", type: "water", currentPp: 0, maxPp: 15, basePower: 95, accuracy: 100 }, // 0 PP
];

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
    moves: mockMoves,
  },
  {
    speciesId: "charizard",
    name: "Charizard",
    level: 50,
    types: ["fire", "flying"],
    currentHp: 150,
    maxHp: 150,
    status: "NONE",
    statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
    moves: [],
  },
  {
    speciesId: "blastoise",
    name: "Blastoise",
    level: 50,
    types: ["water"],
    currentHp: 0, // Fainted
    maxHp: 160,
    status: "NONE",
    statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
    moves: [],
  },
];

describe("MoveGrid", () => {
  it("renders 4 color-coded move tabs and Switch button", () => {
    const onConfirm = vi.fn();
    const onOpenSwitch = vi.fn();

    render(
      <MoveGrid
        moves={mockMoves}
        legalActions={[
          { type: "move", index: 0 },
          { type: "move", index: 1 },
          { type: "move", index: 2 },
          { type: "switch", index: 1 },
        ]}
        selectedIndex={0}
        onSelectIndex={() => { }}
        onConfirm={onConfirm}
        onOpenSwitch={onOpenSwitch}
      />
    );

    expect(screen.getByText("THUNDERBOLT")).toBeInTheDocument();
    expect(screen.getByText("QUICK ATTACK")).toBeInTheDocument();
    expect(screen.getByText("THUNDER WAVE")).toBeInTheDocument();
    expect(screen.getByText("SURF")).toBeInTheDocument();

    // 0 PP move is disabled
    const surfButton = screen.getByRole("button", { name: /Move 4: Surf/i });
    expect(surfButton).toBeDisabled();

    // Switch button is present
    const switchBtn = screen.getByRole("button", { name: /Switch Pokémon Roster/i });
    expect(switchBtn).toBeInTheDocument();

    fireEvent.click(switchBtn);
    expect(onOpenSwitch).toHaveBeenCalled();
  });
});

describe("SwitchMenu", () => {
  it("renders roster with active and fainted indicators and handles cancelling", () => {
    const onCancel = vi.fn();
    const onConfirmSwitch = vi.fn();

    render(
      <SwitchMenu
        team={mockTeam}
        activeIndex={0}
        legalActions={[{ type: "switch", index: 1 }]}
        selectedIndex={1}
        onSelectIndex={() => { }}
        onConfirmSwitch={onConfirmSwitch}
        onCancel={onCancel}
        isForcedSwitch={false}
      />
    );

    // Active Pokémon has ACTIVE badge and is disabled from switching
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    const activeSlot = screen.getByRole("button", { name: /Slot 1: Pikachu/i });
    expect(activeSlot).toBeDisabled();

    // Fainted Pokémon has FAINTED badge and is disabled
    expect(screen.getByText("FAINTED")).toBeInTheDocument();
    const faintedSlot = screen.getByRole("button", { name: /Slot 3: Blastoise/i });
    expect(faintedSlot).toBeDisabled();

    // Legal switch slot can be clicked
    const legalSlot = screen.getByRole("button", { name: /Slot 2: Charizard/i });
    expect(legalSlot).not.toBeDisabled();
    fireEvent.click(legalSlot);
    expect(onConfirmSwitch).toHaveBeenCalledWith(1);

    // Cancel button works
    const cancelBtn = screen.getByRole("button", { name: /Cancel switch/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("TurnCountdown", () => {
  it("renders countdown when timerEnabled is true", () => {
    const now = Date.now();
    const { container } = render(
      <TurnCountdown
        timerEnabled={true}
        prompt={{
          turnNumber: 1,
          phase: "ActionSelection",
          legalActions: [],
          serverTime: now,
          deadline: now + 90000,
        }}
      />
    );

    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText(/90s/)).toBeInTheDocument();
  });

  it("renders nothing when timerEnabled is false", () => {
    const now = Date.now();
    const { container } = render(
      <TurnCountdown
        timerEnabled={false}
        prompt={{
          turnNumber: 1,
          phase: "ActionSelection",
          legalActions: [],
          serverTime: now,
          deadline: now + 90000,
        }}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe("MobileLogDrawer", () => {
  it("renders children when open and calls onClose", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MobileLogDrawer isOpen={false} onClose={onClose}>
        <div>Drawer Content</div>
      </MobileLogDrawer>
    );

    expect(screen.queryByText("Drawer Content")).not.toBeInTheDocument();

    rerender(
      <MobileLogDrawer isOpen={true} onClose={onClose}>
        <div>Drawer Content</div>
      </MobileLogDrawer>
    );

    expect(screen.getByText("Drawer Content")).toBeInTheDocument();
    const closeBtn = screen.getByRole("button", { name: /Close Battle Log/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

class MockGameConnection implements GameConnection {
  private listeners = new Map<string, Set<(data: any) => void>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  public emitted: Array<{ event: string; data: any }> = [];
  public status: ConnectionStatus = "connected";

  async connect() {
    this.status = "connected";
    this.statusListeners.forEach((cb) => cb("connected"));
  }
  disconnect() {
    this.status = "disconnected";
    this.statusListeners.forEach((cb) => cb("disconnected"));
  }
  getStatus() {
    return this.status;
  }
  getSocketId() {
    return "mock-sock-1";
  }
  on(event: any, handler: any) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }
  emit(event: any, data: any) {
    this.emitted.push({ event, data });
  }
  onConnectionChange(callback: (status: ConnectionStatus) => void) {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }
  trigger(event: string, data: any) {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

describe("BattleScreen Enter & Move/Switch Integration", () => {
  beforeEach(() => {
    window.sessionStorage?.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances initial dialogue with Enter, enters MoveGrid, selects moves (including Move 2 click), and switches Pokémon", async () => {
    const conn = new MockGameConnection();
    render(
      <GameProvider connection={conn}>
        <ScreenRouter />
      </GameProvider>
    );

    // Emit ROOM_JOINED, BATTLE_START, and TURN_PROMPT
    act(() => {
      conn.trigger(ServerEvents.ROOM_JOINED, {
        roomCode: "ABC123",
        playerSide: "p1",
        sessionToken: "tok-1",
        config: { teamSize: 3, timerEnabled: false, turnDurationSeconds: 90 },
      });
      conn.trigger(ServerEvents.BATTLE_START, {
        seed: 42,
        playerSide: "p1",
        activeIndex: 0,
        team: mockTeam,
        opponentPublic: {
          active: {
            speciesId: "squirtle",
            name: "Squirtle",
            level: 50,
            types: ["water"],
            hpPercent: 100,
            status: "NONE",
            statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
            revealedMoves: [],
          },
          totalTeamSize: 3,
          aliveCount: 3,
          faintedCount: 0,
        },
      });
      conn.trigger(ServerEvents.TURN_PROMPT, {
        turnNumber: 1,
        phase: "ActionSelection",
        legalActions: [
          { type: "move", index: 0 },
          { type: "move", index: 1 },
          { type: "move", index: 2 },
          { type: "switch", index: 1 },
        ],
        serverTime: Date.now(),
      });
    });

    expect(screen.getByText("Battle has begun! What will you do?")).toBeInTheDocument();

    // First Enter completes typewriter; second Enter advances past BattleStart dialogue -> unlocks MoveGrid
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    expect(screen.getByText("THUNDERBOLT")).toBeInTheDocument();
    expect(screen.getByText("QUICK ATTACK")).toBeInTheDocument();

    // Clicking Move 2 ("Quick Attack") must immediately emit move index 1 (not stale index 0)
    fireEvent.click(screen.getByRole("button", { name: /Move 2: Quick Attack/i }));
    expect(conn.emitted).toContainEqual({
      event: ClientEvents.BATTLE_ACTION,
      data: { action: { type: "move", index: 1 } },
    });

    // Cancel action via B/Escape and open Switch Menu
    conn.emitted = [];
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.getByText("THUNDERBOLT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Switch Pokémon Roster/i }));
    expect(screen.getByTestId("switch-menu")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(conn.emitted).toContainEqual({
      event: ClientEvents.BATTLE_ACTION,
      data: { action: { type: "switch", index: 1 } },
    });

    // Cancel waiting action, then close Switch menu via B/Escape to reach MoveGrid and open forfeit modal
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    fireEvent.click(screen.getByRole("button", { name: /Forfeit Battle/i }));
    const forfeitDialog = screen.getByRole("dialog");
    expect(forfeitDialog.parentElement).toBe(document.body);
  });

  it("completes Turn 1 playback and unlocks Turn 2 moves/switching inside React.StrictMode", async () => {
    vi.useFakeTimers();
    const conn = new MockGameConnection();

    render(
      <React.StrictMode>
        <GameProvider connection={conn}>
          <ScreenRouter />
        </GameProvider>
      </React.StrictMode>
    );

    act(() => {
      conn.trigger(ServerEvents.ROOM_JOINED, {
        roomCode: "STR123",
        playerSide: "p1",
        sessionToken: "tok-strict",
        config: { teamSize: 3, timerEnabled: false, turnDurationSeconds: 90 },
      });
      conn.trigger(ServerEvents.BATTLE_START, {
        seed: 7,
        playerSide: "p1",
        activeIndex: 0,
        team: mockTeam,
        opponentPublic: {
          active: {
            speciesId: "squirtle",
            name: "Squirtle",
            level: 50,
            types: ["water"],
            hpPercent: 100,
            status: "NONE",
            statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
            revealedMoves: [],
          },
          totalTeamSize: 3,
          aliveCount: 3,
          faintedCount: 0,
        },
      });
      conn.trigger(ServerEvents.TURN_PROMPT, {
        turnNumber: 1,
        phase: "ActionSelection",
        legalActions: [
          { type: "move", index: 0 },
          { type: "move", index: 1 },
          { type: "switch", index: 1 },
        ],
        serverTime: Date.now(),
      });
    });

    // Wait past BattleStart sprite timeout (600ms) + entrance (400ms) + typewriter, then press Enter once to dismiss
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByRole("region")).toHaveTextContent("Battle has begun! What will you do?");
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    expect(screen.getByRole("button", { name: /Move 1: Thunderbolt/i })).not.toBeDisabled();

    // Submit Move 1
    fireEvent.click(screen.getByRole("button", { name: /Move 1: Thunderbolt/i }));
    expect(conn.emitted).toContainEqual({
      event: ClientEvents.BATTLE_ACTION,
      data: { action: { type: "move", index: 0 } },
    });

    // Receive Turn 1 result and Turn 2 prompt
    act(() => {
      conn.trigger(ServerEvents.TURN_RESULT, {
        turnNumber: 2,
        playerSide: "p1",
        activeIndex: 0,
        events: [
          { type: "MoveUsed", side: "p1", pokemon: "Pikachu", move: "thunderbolt" },
          { type: "DamageDealt", side: "p2", pokemon: "Squirtle", intValue1: 45 },
          { type: "MoveUsed", side: "p2", pokemon: "Squirtle", move: "water-gun" },
          { type: "DamageDealt", side: "p1", pokemon: "Pikachu", intValue1: 20, intValue2: 80 },
        ],
        yourTeam: [{ ...mockTeam[0], currentHp: 80 }, mockTeam[1], mockTeam[2]],
        opponentPublic: {
          active: {
            speciesId: "squirtle",
            name: "Squirtle",
            level: 50,
            types: ["water"],
            hpPercent: 55,
            status: "NONE",
            statStages: { attack: 0, defense: 0, special: 0, speed: 0, accuracy: 0, evasion: 0 },
            revealedMoves: ["water-gun"],
          },
          totalTeamSize: 3,
          aliveCount: 3,
          faintedCount: 0,
        },
      });
      conn.trigger(ServerEvents.TURN_PROMPT, {
        turnNumber: 2,
        phase: "ActionSelection",
        legalActions: [
          { type: "move", index: 0 },
          { type: "move", index: 1 },
          { type: "switch", index: 1 },
        ],
        serverTime: Date.now(),
      });
    });

    // Step 1: Finish typing "Pikachu used thunderbolt!" while both HPs remain 100%
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(screen.getByRole("region")).toHaveTextContent(/Pikachu used thunderbolt/i);
    expect(screen.getByRole("progressbar", { name: "Squirtle's HP" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("progressbar", { name: "Pikachu's HP" })).toHaveAttribute("aria-valuenow", "100");

    // Step through remaining 3 events using Enter (once per completed step)
    for (let step = 0; step < 3; step++) {
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter" });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });
      if (step === 0) {
        // After Foe took damage step, ONLY Squirtle HP dropped to 55%; Pikachu HP is still 100!
        expect(screen.getByRole("progressbar", { name: "Squirtle's HP" })).toHaveAttribute("aria-valuenow", "55");
        expect(screen.getByRole("progressbar", { name: "Pikachu's HP" })).toHaveAttribute("aria-valuenow", "100");
      }
    }

    // Final Enter advances past "You took 20 damage!" -> Turn 2 moves unlock!
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    conn.emitted = [];
    const move2 = screen.getByRole("button", { name: /Move 2: Quick Attack/i });
    expect(move2).not.toBeDisabled();
    fireEvent.click(move2);
    expect(conn.emitted).toContainEqual({
      event: ClientEvents.BATTLE_ACTION,
      data: { action: { type: "move", index: 1 } },
    });

    vi.useRealTimers();
  });
});
