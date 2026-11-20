import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartyIcon } from "../src/battle/PartyIcon.js";

describe("PartyIcon Component", () => {
  it("renders with full accessible label and active badge when healthy and active", () => {
    render(
      <PartyIcon
        speciesId="25"
        name="Pikachu"
        currentHp={100}
        maxHp={100}
        isActive={true}
      />
    );

    const root = screen.getByRole("img", { name: "Pikachu, 100% HP, active" });
    expect(root).toBeInTheDocument();
    expect(root.className).toContain("border-emerald-500");
    expect(screen.getByTestId("party-icon-active-badge")).toBeInTheDocument();
  });

  it("applies amber border for hurt Pokémon (21-50% HP) with status tag", () => {
    render(
      <PartyIcon
        speciesId="4"
        name="Charmander"
        currentHp={40}
        maxHp={100}
        status="BRN"
      />
    );

    const root = screen.getByRole("img", { name: "Charmander, 40% HP, BRN" });
    expect(root).toBeInTheDocument();
    expect(root.className).toContain("border-amber-400");
    expect(screen.getByTestId("party-icon-status-badge")).toHaveTextContent("BRN");
  });

  it("applies red border for critical Pokémon (<=20% HP)", () => {
    render(
      <PartyIcon
        speciesId="1"
        name="Bulbasaur"
        currentHp={15}
        maxHp={100}
      />
    );

    const root = screen.getByRole("img", { name: "Bulbasaur, 15% HP" });
    expect(root).toBeInTheDocument();
    expect(root.className).toContain("border-red-600");
  });

  it("renders fainted state with grayscale, fainted label, and red X mark", () => {
    render(
      <PartyIcon
        speciesId="7"
        name="Squirtle"
        currentHp={0}
        maxHp={100}
        isFainted={true}
      />
    );

    const root = screen.getByRole("img", { name: "Squirtle, fainted" });
    expect(root).toBeInTheDocument();
    expect(root.className).toContain("grayscale");
    expect(screen.getByTestId("party-icon-fainted-x")).toHaveTextContent("✕");
  });

  it("supports interactive keyboard and D-pad focus highlight", () => {
    const onClick = vi.fn();
    render(
      <PartyIcon
        speciesId="1"
        name="Bulbasaur"
        currentHp={100}
        maxHp={100}
        isFocused={true}
        onClick={onClick}
      />
    );

    const btn = screen.getByRole("button", { name: "Bulbasaur, 100% HP" });
    expect(btn.className).toContain("ring-2 ring-cyan-400");

    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("falls back to original vector SVG token on image error", () => {
    render(
      <PartyIcon
        speciesId="6"
        name="Charizard"
        currentHp={100}
        maxHp={100}
        types={["fire"]}
      />
    );

    const img = screen.getByTestId("party-icon-img");
    // Exhaust candidates
    fireEvent.error(img);
    fireEvent.error(screen.getByTestId("party-icon-img"));

    expect(screen.getByTestId("party-icon-svg-fallback")).toBeInTheDocument();
    expect(screen.getByText("#6")).toBeInTheDocument();
  });

  it("strictly hides identity and renders neutral token for unrevealed opponent Pokémon", () => {
    render(<PartyIcon isAnonymous={true} />);

    const root = screen.getByRole("img", { name: "Unrevealed reserve Pokémon" });
    expect(root).toBeInTheDocument();

    // Must NOT contain any image tag pointing to an identifiable species
    expect(screen.queryByTestId("party-icon-img")).not.toBeInTheDocument();

    // Must render neutral anonymous token
    expect(screen.getByTestId("party-icon-anonymous")).toBeInTheDocument();

    // Ensure no species name or dex number leaks into the DOM
    expect(screen.queryByText(/pikachu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/#/)).not.toBeInTheDocument();
  });
});
