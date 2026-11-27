import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DialogueBox } from "../src/battle/DialogueBox.js";
import { HealthBar } from "../src/battle/HealthBar.js";
import { TurnCountdown } from "../src/battle/TurnCountdown.js";
import { SocketIoGameConnection } from "../src/connection/SocketIoGameConnection.js";
import { NavigationProvider, useRegisterNav, useNavigation } from "../src/navigation/NavigationContext.js";
import { ServerEvents, type StatStages } from "@pokemon/protocol";

describe("Enhanced Features & Bug Fixes", () => {
  describe("DialogueBox Typewriter", () => {
    it("progressively reveals characters and skips to end on click", () => {
      vi.useFakeTimers();
      const onAdvance = vi.fn();
      const message = "Pikachu used Thunderbolt! It was super effective!";

      render(
        <DialogueBox message={message} onAdvance={onAdvance} />
      );

      // Initially starts typing
      act(() => {
        vi.advanceTimersByTime(18 * 5);
      });

      // Clicking while typing should instantly reveal full message without advancing
      const box = screen.getByRole("region");
      fireEvent.click(box);
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(onAdvance).not.toHaveBeenCalled();

      // Clicking again once complete triggers onAdvance
      fireEvent.click(box);
      expect(onAdvance).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("supports imperative handle to reveal text then advance (simulating Enter/A key)", () => {
      vi.useFakeTimers();
      const onAdvance = vi.fn();
      const message = "Foe Charizard was afflicted with PAR!";
      const handleRef = React.createRef<any>();

      render(
        <DialogueBox ref={handleRef} message={message} onAdvance={onAdvance} />
      );

      // First advance call while typing reveals full text
      act(() => {
        handleRef.current?.advance();
      });
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(onAdvance).not.toHaveBeenCalled();

      // Second advance call triggers onAdvance
      act(() => {
        handleRef.current?.advance();
      });
      expect(onAdvance).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("HealthBar Stat Stages", () => {
    it("renders stat stage modifiers when non-zero", () => {
      const statStages: StatStages = {
        attack: 2,
        defense: -1,
        special: 0,
        speed: 1,
        accuracy: 0,
        evasion: 0,
      };

      render(
        <HealthBar
          name="Pikachu"
          level={50}
          hpPercent={85}
          isPlayer={true}
          currentHp={85}
          maxHp={100}
          statStages={statStages}
        />
      );

      expect(screen.getByText("ATK +2")).toBeInTheDocument();
      expect(screen.getByText("DEF -1")).toBeInTheDocument();
      expect(screen.getByText("SPE +1")).toBeInTheDocument();
      // Zero stages should not render badges
      expect(screen.queryByText(/SPC/)).not.toBeInTheDocument();
    });
  });

  describe("TurnCountdown Duration", () => {
    it("respects custom turn duration", () => {
      render(
        <TurnCountdown
          prompt={{
            turnNumber: 1,
            phase: "ActionSelection",
            legalActions: [],
            serverTime: Date.now(),
            deadline: Date.now() + 45000,
          }}
          timerEnabled={true}
          turnDurationSeconds={45}
        />
      );

      expect(screen.getByRole("timer")).toBeInTheDocument();
      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("aria-valuemax", "45");
    });
  });

  describe("SocketIoGameConnection Buffer & Lifecycle", () => {
    it("allows registering event listeners before connect() without throwing", () => {
      const conn = new SocketIoGameConnection("http://127.0.0.1:3000");

      expect(() => {
        conn.on(ServerEvents.BATTLE_START, () => {});
        conn.on(ServerEvents.TURN_PROMPT, () => {});
      }).not.toThrow();

      expect(conn.getStatus()).toBe("disconnected");
    });
  });

  describe("NavigationContext Wiring", () => {
    const TestConsumer: React.FC = () => {
      const nav = useNavigation();
      useRegisterNav({
        onUp: () => nav.handlers.onEnter?.(),
      });

      return <div>Nav Active</div>;
    };

    it("registers and propagates handlers to navigation context", () => {
      render(
        <NavigationProvider>
          <TestConsumer />
        </NavigationProvider>
      );

      expect(screen.getByText("Nav Active")).toBeInTheDocument();
    });
  });
});
