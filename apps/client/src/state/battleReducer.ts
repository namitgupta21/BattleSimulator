import type { BattleEventData, RoomPlayerInfo } from "@pokemon/protocol";
import type { BattleAction, BattleViewState, LcdTheme, LogEntry } from "./types.js";

function safeGetStorage(key: string, fallback: string): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key) || fallback;
    }
  } catch {}
  return fallback;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch {}
}

const initialTheme = safeGetStorage("pokemon_theme", "classic");
const validatedTheme: LcdTheme = initialTheme === "cyber" ? "cyber" : "classic";

export const initialBattleViewState: BattleViewState = {
  screen: "home",
  connectionStatus: "disconnected",
  playerName: safeGetStorage("pokemon_player_name", "Trainer"),

  room: {
    roomCode: null,
    playerSide: null,
    sessionToken: null,
    config: null,
    state: null,
    players: [],
  },

  battle: {
    seed: null,
    turnNumber: 0,
    phase: "ActionSelection",
    myTeam: [],
    activePokemonIndex: 0,
    opponentPublic: null,
    turnPrompt: null,
    isSubmitting: false,
    waitingForOpponent: false,
    eventQueue: [],
    currentDialogue: null,
    logEntries: [],
    unreadLogCount: 0,
    isLogOpen: false,
    winner: null,
    endReason: null,
    replayLogId: null,
    opponentDisconnected: false,
    opponentGraceDeadline: null,
    activeTab: "moves",
  },

  ui: {
    theme: validatedTheme,
    scanlinesEnabled: true,
    errorMessage: null,
  },
};

export function formatEventText(event: BattleEventData, mySide: "p1" | "p2" | null): string {
  const isMine = event.side === mySide;
  const sideLabel = isMine ? "Your" : "Foe's";
  const actor = isMine ? "You" : "Foe";

  switch (event.type) {
    case "TurnStarted":
    case "TurnEnded":
      return "";
    case "MoveUsed":
      return `${actor} sent out move: ${event.pokemon} used ${event.move}!`;
    case "DamageDealt":
      return `${actor} took ${event.intValue1 ?? 0} damage!`;
    case "CriticalHit":
      return `A critical hit!`;
    case "Fainted":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"} fainted!`;
    case "SwitchedIn":
      return `${actor} sent out ${event.pokemon}!`;
    case "StatusApplied":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"} was afflicted with ${event.status}!`;
    case "StatStageChanged":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"}'s ${event.stat ?? "stat"} ${(event.intValue1 ?? 0) > 0 ? "rose" : "fell"}!`;
    case "MoveMissed":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"}'s attack missed!`;
    case "Effectiveness":
      return (event.intValue1 ?? 0) > 100
        ? "It's super effective!"
        : (event.intValue1 ?? 0) < 100
        ? "It's not very effective..."
        : "Effectiveness triggered";
    case "StatusDamage":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"} was hurt by ${event.status || "status"}!`;
    case "StatusBlockedAction":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"} is ${event.status || "unable to move"}!`;
    case "StatusHealed":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"} was cured of ${event.status}!`;
    case "PokemonHealed":
      return `${sideLabel} ${event.pokemon ?? "Pokémon"} regained health!`;
    default:
      return event.message || `${event.type} triggered`;
  }
}

export function battleReducer(state: BattleViewState, action: BattleAction): BattleViewState {
  switch (action.type) {
    case "SET_CONNECTION_STATUS":
      return {
        ...state,
        connectionStatus: action.status,
      };

    case "SET_PLAYER_NAME":
      safeSetStorage("pokemon_player_name", action.name);
      return {
        ...state,
        playerName: action.name,
      };

    case "SET_SCREEN":
      return {
        ...state,
        screen: action.screen,
      };

    case "ROOM_JOINED": {
      const nextScreen = state.screen === "battle" ? "battle" : "lobby";
      return {
        ...state,
        screen: nextScreen,
        room: {
          ...state.room,
          roomCode: action.payload.roomCode,
          playerSide: action.payload.playerSide,
          sessionToken: action.payload.sessionToken,
          config: action.payload.config,
        },
        ui: {
          ...state.ui,
          errorMessage: null,
        },
      };
    }

    case "ROOM_STATE": {
      const opp = action.payload.players.find((p: RoomPlayerInfo) => p.side !== state.room.playerSide);
      const oppDisconnected = opp ? !opp.isConnected : false;
      const wasOppDisconnected = state.battle.opponentDisconnected;

      let graceDeadline = state.battle.opponentGraceDeadline;
      if (oppDisconnected && !wasOppDisconnected && state.screen === "battle") {
        graceDeadline = Date.now() + 30000;
      } else if (!oppDisconnected) {
        graceDeadline = null;
      }

      const isAbandoned = action.payload.state === "Abandoned";
      const shouldSwitchToBattle =
        action.payload.state === "InProgress" && state.screen !== "battle";

      // Disconnect / Reconnect logging
      const disconnectLogs: LogEntry[] = [];
      if (oppDisconnected && !wasOppDisconnected && state.screen === "battle") {
        disconnectLogs.push({
          id: `dc-${Date.now()}`,
          turnNumber: state.battle.turnNumber,
          text: "[DISCONNECT] Opponent disconnected! (30s grace)",
        });
      } else if (!oppDisconnected && wasOppDisconnected && state.screen === "battle") {
        disconnectLogs.push({
          id: `rc-${Date.now()}`,
          turnNumber: state.battle.turnNumber,
          text: "[RECONNECT] Opponent reconnected!",
        });
      }

      return {
        ...state,
        screen: shouldSwitchToBattle ? "battle" : state.screen,
        room: {
          ...state.room,
          state: action.payload.state,
          players: action.payload.players,
        },
        battle: {
          ...state.battle,
          opponentDisconnected: oppDisconnected,
          opponentGraceDeadline: graceDeadline,
          logEntries: disconnectLogs.length > 0 ? [...state.battle.logEntries, ...disconnectLogs] : state.battle.logEntries,
          unreadLogCount: state.battle.isLogOpen ? 0 : state.battle.unreadLogCount + disconnectLogs.length,
        },
        ui: {
          ...state.ui,
          errorMessage: isAbandoned ? "The match was abandoned." : state.ui.errorMessage,
        },
      };
    }

    case "BATTLE_START": {
      const resolvedSide = action.payload.playerSide ?? state.room.playerSide;
      const startLog: LogEntry = {
        id: `start-${Date.now()}`,
        turnNumber: 0,
        text: `Battle started! (Seed: ${action.payload.seed})`,
      };

      return {
        ...state,
        screen: "battle",
        room: {
          ...state.room,
          playerSide: resolvedSide,
        },
        battle: {
          ...state.battle,
          seed: action.payload.seed,
          myTeam: action.payload.team,
          activePokemonIndex: action.payload.activeIndex ?? 0,
          opponentPublic: action.payload.opponentPublic,
          turnNumber: 1,
          phase: "ActionSelection",
          turnPrompt: null,
          isSubmitting: false,
          waitingForOpponent: false,
          eventQueue: [],
          currentDialogue: "Battle has begun! What will you do?",
          logEntries: [startLog],
          unreadLogCount: state.battle.isLogOpen ? 0 : 1,
          winner: null,
          endReason: null,
          replayLogId: null,
          activeTab: "moves",
        },
        ui: {
          ...state.ui,
          errorMessage: null,
        },
      };
    }

    case "TURN_PROMPT": {
      const isForcedSwitch =
        action.payload.phase.startsWith("ForcedSwitch") &&
        ((state.room.playerSide === "p1" && action.payload.phase !== "ForcedSwitchP2") ||
          (state.room.playerSide === "p2" && action.payload.phase !== "ForcedSwitchP1"));

      const hasPendingEvents = state.battle.eventQueue.length > 0;

      // If events are still playing, do not overwrite current dialogue
      let nextDialogue = state.battle.currentDialogue;
      if (!hasPendingEvents) {
        if (isForcedSwitch) {
          nextDialogue = null;
        } else if (action.payload.legalActions.length === 0) {
          nextDialogue = "Waiting for opponent...";
        } else if (action.payload.turnNumber > 1 || state.battle.turnNumber > 1) {
          nextDialogue = null;
        }
      }

      return {
        ...state,
        battle: {
          ...state.battle,
          turnNumber: action.payload.turnNumber,
          phase: action.payload.phase,
          turnPrompt: action.payload,
          isSubmitting: false,
          waitingForOpponent: !isForcedSwitch && action.payload.legalActions.length === 0,
          activeTab: isForcedSwitch ? "switch" : state.battle.activeTab,
          currentDialogue: isForcedSwitch ? null : nextDialogue,
        },
      };
    }

    case "TURN_RESULT": {
      const resolvedSide = action.payload.playerSide ?? state.room.playerSide;
      const newLogs: LogEntry[] = action.payload.events
        .map((evt, idx) => ({
          id: `turn-${action.payload.turnNumber}-${idx}-${Date.now()}`,
          turnNumber: action.payload.turnNumber,
          text: formatEventText(evt, resolvedSide),
          side: evt.side,
          type: evt.type,
        }))
        .filter((entry) => Boolean(entry.text));

      // Authoritative active index from server
      let newActiveIndex =
        action.payload.activeIndex !== undefined
          ? action.payload.activeIndex
          : state.battle.activePokemonIndex;

      // Fallback check if your Pokémon switched via event
      if (action.payload.activeIndex === undefined) {
        for (const evt of action.payload.events) {
          if (evt.type === "SwitchedIn" && evt.side === resolvedSide && evt.pokemon) {
            const foundIdx = action.payload.yourTeam.findIndex(
              (p) => p.name.toLowerCase() === evt.pokemon?.toLowerCase()
            );
            if (foundIdx !== -1) {
              newActiveIndex = foundIdx;
            }
          }
        }
      }

      // Screen dialogue events: ignore internal turn boundary markers like TurnStarted and TurnEnded
      const screenEvents = action.payload.events.filter(
        (evt) => evt.type !== "TurnStarted" && evt.type !== "TurnEnded"
      );

      const firstEvent = screenEvents[0];
      const remainingEvents = screenEvents.slice(1);
      const dialogueText = firstEvent
        ? formatEventText(firstEvent, resolvedSide)
        : null;

      // Preserve previous opponent active with 0% HP if server sent null (e.g. knocked out this turn)
      let resolvedOpponentPublic = action.payload.opponentPublic;
      if (!resolvedOpponentPublic.active && state.battle.opponentPublic?.active) {
        resolvedOpponentPublic = {
          ...resolvedOpponentPublic,
          active: {
            ...state.battle.opponentPublic.active,
            hpPercent: 0,
          },
        };
      }

      return {
        ...state,
        room: {
          ...state.room,
          playerSide: resolvedSide,
        },
        battle: {
          ...state.battle,
          turnNumber: action.payload.turnNumber,
          myTeam: action.payload.yourTeam,
          activePokemonIndex: newActiveIndex,
          opponentPublic: resolvedOpponentPublic,
          eventQueue: remainingEvents,
          currentDialogue: dialogueText,
          logEntries: [...state.battle.logEntries, ...newLogs],
          unreadLogCount: state.battle.isLogOpen
            ? 0
            : state.battle.unreadLogCount + newLogs.length,
          waitingForOpponent: false,
          isSubmitting: false,
        },
      };
    }

    case "BATTLE_END": {
      const endLog: LogEntry = {
        id: `end-${Date.now()}`,
        turnNumber: state.battle.turnNumber,
        text: `Match Ended! Winner: ${action.payload.winner.toUpperCase()} (${action.payload.reason})`,
      };

      // Only hold on the battle screen if there are real battle animation events waiting to be replayed
      const hasEventsPlaying =
        action.payload.reason === "knockout" && state.battle.eventQueue.length > 0;

      return {
        ...state,
        // Immediately show result on disconnect/forfeit/timeout or when no events are queued
        screen: hasEventsPlaying ? state.screen : "result",
        battle: {
          ...state.battle,
          winner: action.payload.winner,
          endReason: action.payload.reason,
          replayLogId: action.payload.replayLogId,
          isSubmitting: false,
          waitingForOpponent: false,
          opponentDisconnected: false,
          opponentGraceDeadline: null,
          currentDialogue: hasEventsPlaying ? state.battle.currentDialogue : null,
          logEntries: [...state.battle.logEntries, endLog],
          unreadLogCount: state.battle.isLogOpen ? 0 : state.battle.unreadLogCount + 1,
        },
      };
    }

    case "ACTION_SUBMITTED":
      return {
        ...state,
        battle: {
          ...state.battle,
          isSubmitting: true,
          waitingForOpponent: true,
          currentDialogue: "Waiting for opponent...",
        },
      };

    case "CANCEL_ACTION":
      return {
        ...state,
        battle: {
          ...state.battle,
          isSubmitting: false,
          waitingForOpponent: false,
          currentDialogue: null,
        },
      };

    case "ADVANCE_EVENT": {
      if (state.battle.waitingForOpponent) {
        return state;
      }

      let remaining = [...state.battle.eventQueue];
      let formattedText = "";
      while (remaining.length > 0 && !formattedText) {
        const next = remaining.shift()!;
        if (next.type !== "TurnStarted" && next.type !== "TurnEnded") {
          formattedText = formatEventText(next, state.room.playerSide);
        }
      }

      if (!formattedText) {
        // Queue exhausted: check if battle has ended
        if (state.battle.winner !== null) {
          return {
            ...state,
            screen: "result",
            battle: {
              ...state.battle,
              eventQueue: [],
              currentDialogue: null,
            },
          };
        }

        // If turnPrompt is pending, handle dialogue prompt or clear
        const isForcedSwitch =
          state.battle.turnPrompt?.phase.startsWith("ForcedSwitch") &&
          ((state.room.playerSide === "p1" && state.battle.turnPrompt.phase !== "ForcedSwitchP2") ||
            (state.room.playerSide === "p2" && state.battle.turnPrompt.phase !== "ForcedSwitchP1"));

        const isWaiting =
          !isForcedSwitch &&
          Boolean(state.battle.turnPrompt && state.battle.turnPrompt.legalActions.length === 0);

        const nextDialogue = isWaiting ? "Waiting for opponent..." : null;

        return {
          ...state,
          battle: {
            ...state.battle,
            eventQueue: [],
            currentDialogue: nextDialogue,
            waitingForOpponent: isWaiting,
            activeTab: isForcedSwitch ? "switch" : state.battle.activeTab,
          },
        };
      }

      return {
        ...state,
        battle: {
          ...state.battle,
          eventQueue: remaining,
          currentDialogue: formattedText,
        },
      };
    }

    case "SKIP_EVENTS": {
      if (state.battle.winner !== null) {
        return {
          ...state,
          screen: "result",
          battle: {
            ...state.battle,
            eventQueue: [],
            currentDialogue: null,
          },
        };
      }
      return {
        ...state,
        battle: {
          ...state.battle,
          eventQueue: [],
          currentDialogue: null,
        },
      };
    }

    case "TOGGLE_LOG":
      return {
        ...state,
        battle: {
          ...state.battle,
          isLogOpen: !state.battle.isLogOpen,
          unreadLogCount: !state.battle.isLogOpen ? 0 : state.battle.unreadLogCount,
        },
      };

    case "SET_LOG_OPEN":
      return {
        ...state,
        battle: {
          ...state.battle,
          isLogOpen: action.open,
          unreadLogCount: action.open ? 0 : state.battle.unreadLogCount,
        },
      };

    case "SET_ACTIVE_TAB":
      return {
        ...state,
        battle: {
          ...state.battle,
          activeTab: action.tab,
        },
      };

    case "ERROR_RECEIVED":
      return {
        ...state,
        battle: {
          ...state.battle,
          isSubmitting: false,
          waitingForOpponent: false,
        },
        ui: {
          ...state.ui,
          errorMessage: action.payload.message,
        },
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        ui: {
          ...state.ui,
          errorMessage: null,
        },
      };

    case "SET_THEME":
      safeSetStorage("pokemon_theme", action.theme);
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: action.theme,
        },
      };

    case "TOGGLE_SCANLINES":
      return {
        ...state,
        ui: {
          ...state.ui,
          scanlinesEnabled: !state.ui.scanlinesEnabled,
        },
      };

    case "RESET_BATTLE":
      return {
        ...initialBattleViewState,
        playerName: state.playerName,
        connectionStatus: state.connectionStatus,
        ui: state.ui,
      };

    default:
      return state;
  }
}
