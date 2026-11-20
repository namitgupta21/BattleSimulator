import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoveGrid } from "../src/battle/MoveGrid.js";
import { SwitchMenu } from "../src/battle/SwitchMenu.js";
import { TurnCountdown } from "../src/battle/TurnCountdown.js";
import { MobileLogDrawer } from "../src/shell/MobileLogDrawer.js";
import type { MoveSlot, PlayerPokemon } from "@pokemon/protocol";

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
        onSelectIndex={() => {}}
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
        onSelectIndex={() => {}}
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
