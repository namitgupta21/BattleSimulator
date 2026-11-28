import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ClientEvents,
  type ClientEventMap,
  type OpponentPublicState,
  type PlayerPokemon,
} from "@pokemon/protocol";
import { useGame } from "../state/GameContext.js";
import { useRegisterNav } from "../navigation/NavigationContext.js";
import { ArenaView } from "../battle/ArenaView.js";
import { DialogueBox, type DialogueBoxHandle } from "../battle/DialogueBox.js";
import { MoveGrid } from "../battle/MoveGrid.js";
import { SwitchMenu } from "../battle/SwitchMenu.js";
import { TurnCountdown } from "../battle/TurnCountdown.js";
import { preloadPokemonSprites } from "../battle/spritePreloader.js";
import { usePrefersReducedMotion } from "../battle/usePrefersReducedMotion.js";
import { getAnimationSpeedMultiplier } from "../battle/animationConfig.js";
import { BattleEventSequencer, type VisualPlaybackSnapshot } from "../battle/eventSequencer.js";

export const BattleScreen: React.FC = () => {
  const { state, dispatch, connection } = useGame();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [moveCursorIdx, setMoveCursorIdx] = useState(0);
  const [switchCursorIdx, setSwitchCursorIdx] = useState(0);
  const dialogueBoxRef = useRef<DialogueBoxHandle>(null);

  const [playbackSnap, setPlaybackSnap] = useState<VisualPlaybackSnapshot | null>(null);
  const sequencerRef = useRef<BattleEventSequencer | null>(null);
  if (!sequencerRef.current) {
    sequencerRef.current = new BattleEventSequencer((snap) => setPlaybackSnap({ ...snap }));
  }

  const lastBattleStartSeqRef = useRef<number>(0);
  const lastTurnResultSeqRef = useRef<number>(0);
  const prevSettledRef = useRef<{
    playerTeam: PlayerPokemon[];
    playerActiveIndex: number;
    opponentPublic: OpponentPublicState | null;
  }>({
    playerTeam: state.battle.myTeam,
    playerActiveIndex: state.battle.activePokemonIndex,
    opponentPublic: state.battle.opponentPublic,
  });
  const pendingTargetRef = useRef<{
    playerTeam: PlayerPokemon[];
    playerActiveIndex: number;
    opponentPublic: OpponentPublicState | null;
  } | null>(null);

  // Keep latest state snapshot in a ref so playback trigger effects only depend on seq counters
  const latestBattleRef = useRef({
    myTeam: state.battle.myTeam,
    activePokemonIndex: state.battle.activePokemonIndex,
    opponentPublic: state.battle.opponentPublic,
    lastTurnEvents: state.battle.lastTurnEvents,
    isResync: state.battle.isResync,
    playerSide: state.room.playerSide,
    prefersReducedMotion,
  });
  latestBattleRef.current = {
    myTeam: state.battle.myTeam,
    activePokemonIndex: state.battle.activePokemonIndex,
    opponentPublic: state.battle.opponentPublic,
    lastTurnEvents: state.battle.lastTurnEvents,
    isResync: state.battle.isResync,
    playerSide: state.room.playerSide,
    prefersReducedMotion,
  };

  useEffect(() => {
    const seq = sequencerRef.current;
    seq?.revive();
    return () => {
      seq?.destroy();
    };
  }, []);

  // Trigger entrance playback on battle start (StrictMode-safe cleanup allows remount re-run)
  useEffect(() => {
    const seqNum = state.battle.battleStartSeq;
    if (seqNum <= 0 || seqNum === lastBattleStartSeqRef.current) {
      return;
    }

    const latest = latestBattleRef.current;
    prevSettledRef.current = {
      playerTeam: latest.myTeam,
      playerActiveIndex: latest.activePokemonIndex,
      opponentPublic: latest.opponentPublic,
    };
    pendingTargetRef.current = null;

    const seq = sequencerRef.current;
    seq?.revive();
    seq?.playBattleStart({
      playerTeam: latest.myTeam,
      playerActiveIndex: latest.activePokemonIndex,
      opponentPublic: latest.opponentPublic,
      isResync: latest.isResync,
      prefersReducedMotion: latest.prefersReducedMotion,
      autoAdvance: false,
      onComplete: () => {
        lastBattleStartSeqRef.current = seqNum;
        dispatch({ type: "SKIP_EVENTS" });
      },
    });

    return () => {
      if (lastBattleStartSeqRef.current !== seqNum) {
        seq?.cancel();
      }
    };
  }, [state.battle.battleStartSeq, dispatch]);

  // Trigger turn result playback when new events arrive (auto-cancelling any mid-flight prior turn)
  useEffect(() => {
    const seqNum = state.battle.turnResultSeq;
    if (seqNum <= 0 || seqNum === lastTurnResultSeqRef.current) {
      return;
    }

    const latest = latestBattleRef.current;
    // If previous turn was interrupted mid-playback, start from its committed target state
    const prev = pendingTargetRef.current ?? prevSettledRef.current;
    const nextTarget = {
      playerTeam: latest.myTeam,
      playerActiveIndex: latest.activePokemonIndex,
      opponentPublic: latest.opponentPublic,
    };
    pendingTargetRef.current = nextTarget;

    const seq = sequencerRef.current;
    seq?.revive();
    seq?.playTurnResult({
      prevPlayerTeam: prev.playerTeam,
      prevPlayerActiveIndex: prev.playerActiveIndex,
      prevOpponentPublic: prev.opponentPublic,
      nextPlayerTeam: nextTarget.playerTeam,
      nextPlayerActiveIndex: nextTarget.playerActiveIndex,
      nextOpponentPublic: nextTarget.opponentPublic,
      events: latest.lastTurnEvents,
      mySide: latest.playerSide,
      prefersReducedMotion: latest.prefersReducedMotion,
      autoAdvance: false,
      onComplete: () => {
        lastTurnResultSeqRef.current = seqNum;
        prevSettledRef.current = nextTarget;
        pendingTargetRef.current = null;
        dispatch({ type: "SKIP_EVENTS" });
      },
    });

    return () => {
      if (lastTurnResultSeqRef.current !== seqNum) {
        seq?.cancel();
      }
    };
  }, [state.battle.turnResultSeq, dispatch]);

  // Hold previous settled HPs on the initial TURN_RESULT render pass before useEffect starts
  // sequential playback, preventing both HealthBars from draining simultaneously on frame 1.
  const hasPendingTurnPlayback =
    !playbackSnap?.isPlaying &&
    state.battle.turnResultSeq > 0 &&
    state.battle.turnResultSeq !== lastTurnResultSeqRef.current &&
    getAnimationSpeedMultiplier() > 0 &&
    state.battle.lastTurnEvents.some((e) => e.type !== "TurnStarted" && e.type !== "TurnEnded");

  const isPlaybackActive = Boolean(playbackSnap?.isPlaying) || hasPendingTurnPlayback;
  const displayedTeam = hasPendingTurnPlayback
    ? prevSettledRef.current.playerTeam
    : isPlaybackActive && playbackSnap
    ? playbackSnap.playerTeam
    : state.battle.myTeam;
  const displayedOpponent = hasPendingTurnPlayback
    ? prevSettledRef.current.opponentPublic
    : isPlaybackActive && playbackSnap
    ? playbackSnap.opponentPublic
    : state.battle.opponentPublic;
  const activeDialogue = hasPendingTurnPlayback
    ? state.battle.currentDialogue
    : isPlaybackActive && playbackSnap?.currentDialogue
    ? playbackSnap.currentDialogue
    : state.battle.currentDialogue;

  let effectiveActiveIndex = hasPendingTurnPlayback
    ? prevSettledRef.current.playerActiveIndex
    : isPlaybackActive && playbackSnap
    ? playbackSnap.playerActiveIndex
    : state.battle.activePokemonIndex;
  const rawActive = displayedTeam[effectiveActiveIndex];
  const isForcedSwitch =
    state.battle.phase.startsWith("ForcedSwitch") &&
    ((state.room.playerSide === "p1" && state.battle.phase !== "ForcedSwitchP2") ||
      (state.room.playerSide === "p2" && state.battle.phase !== "ForcedSwitchP1"));

  // If in ActionSelection and active Pokémon has fainted, automatically use first living Pokémon
  if (!isForcedSwitch && rawActive && rawActive.currentHp <= 0) {
    const aliveIdx = displayedTeam.findIndex((p) => p.currentHp > 0);
    if (aliveIdx !== -1) {
      effectiveActiveIndex = aliveIdx;
    }
  }

  const activePoke = displayedTeam[effectiveActiveIndex];
  const legalActions = state.battle.turnPrompt?.legalActions || [];

  const isMoveLegal = (moveIdx: number) => {
    return legalActions.some((a) => a.type === "move" && a.index === moveIdx);
  };

  // Auto-select first legal alive bench Pokémon when entering switch menu or forced switch
  useEffect(() => {
    if (isForcedSwitch || state.battle.activeTab === "switch") {
      const currentTarget = state.battle.myTeam[switchCursorIdx];
      const currentIsValid =
        currentTarget && currentTarget.currentHp > 0 && switchCursorIdx !== effectiveActiveIndex;
      if (!currentIsValid) {
        const firstValidIdx = state.battle.myTeam.findIndex(
          (p, idx) => idx !== effectiveActiveIndex && p.currentHp > 0
        );
        if (firstValidIdx !== -1) {
          setSwitchCursorIdx(firstValidIdx);
        }
      }
    }
  }, [isForcedSwitch, state.battle.activeTab, effectiveActiveIndex, state.battle.myTeam, switchCursorIdx]);

  // Preload local team battle sprites & icons on battle start
  useEffect(() => {
    if (state.battle.seed && state.battle.myTeam.length > 0) {
      preloadPokemonSprites(state.battle.myTeam, { includeBack: true });
    }
  }, [state.battle.seed, state.battle.myTeam]);

  // Preload opponent combatant ONLY when revealed by the server (preserving hidden information)
  useEffect(() => {
    const oppActive = state.battle.opponentPublic?.active;
    if (oppActive?.speciesId) {
      preloadPokemonSprites([{ speciesId: oppActive.speciesId, name: oppActive.name }], { includeBack: false });
    }
  }, [state.battle.opponentPublic?.active?.speciesId, state.battle.opponentPublic?.active?.name]);

  const handleSelectMove = (moveIdx: number) => {
    if (state.battle.isSubmitting || state.battle.waitingForOpponent) return;
    if (!isMoveLegal(moveIdx)) return;

    dispatch({ type: "ACTION_SUBMITTED" });
    const payload: ClientEventMap[typeof ClientEvents.BATTLE_ACTION] = {
      action: {
        type: "move",
        index: moveIdx,
      },
    };
    connection.emit(ClientEvents.BATTLE_ACTION, payload);
  };

  const handleConfirmSwitch = (slotIdx: number) => {
    if (state.battle.isSubmitting || state.battle.waitingForOpponent) return;
    const targetPoke = state.battle.myTeam[slotIdx];
    if (!targetPoke || targetPoke.currentHp <= 0 || slotIdx === effectiveActiveIndex) {
      return;
    }
    const isLegal = legalActions.some((a) => a.type === "switch" && a.index === slotIdx);
    if (!isLegal) return;

    dispatch({ type: "ACTION_SUBMITTED" });
    if (isForcedSwitch) {
      const payload: ClientEventMap[typeof ClientEvents.BATTLE_SWITCH] = {
        index: slotIdx,
      };
      connection.emit(ClientEvents.BATTLE_SWITCH, payload);
    } else {
      const payload: ClientEventMap[typeof ClientEvents.BATTLE_ACTION] = {
        action: {
          type: "switch",
          index: slotIdx,
        },
      };
      connection.emit(ClientEvents.BATTLE_ACTION, payload);
    }
  };

  const handleForfeit = () => {
    connection.emit(ClientEvents.BATTLE_FORFEIT, {});
    setShowForfeitModal(false);
  };

  const dispatchAdvanceEvent = () => {
    if (state.battle.waitingForOpponent) return;
    if (sequencerRef.current?.getSnapshot().isPlaying) {
      sequencerRef.current.advance();
    } else {
      dispatch({ type: "ADVANCE_EVENT" });
    }
  };

  const handleSkipPlayback = () => {
    if (state.battle.waitingForOpponent) return;
    sequencerRef.current?.skip();
    dispatch({ type: "SKIP_EVENTS" });
  };

  const handleAdvanceDialogue = () => {
    if (state.battle.waitingForOpponent) return;
    if (dialogueBoxRef.current) {
      dialogueBoxRef.current.advance();
    } else {
      dispatch({ type: "ADVANCE_EVENT" });
    }
  };

  const handleCancelAction = () => {
    if (!state.battle.waitingForOpponent) return;
    connection.emit(ClientEvents.BATTLE_CANCEL_ACTION, {});
    dispatch({ type: "CANCEL_ACTION" });
  };

  useRegisterNav({
    onUp: () => {
      if (showForfeitModal) return;
      if (activeDialogue) return;
      if (state.battle.activeTab === "switch" || isForcedSwitch) {
        const teamLen = state.battle.myTeam.length;
        if (teamLen === 0) return;
        setSwitchCursorIdx((prev) => (prev - 1 + teamLen) % teamLen);
      } else {
        const movesCount = activePoke?.moves.length ?? 0;
        setMoveCursorIdx((prev) => {
          if (prev === 0) return 4;
          if (prev === 1) return 5;
          if (prev === 2) return 0;
          if (prev === 3) return movesCount > 1 ? 1 : 0;
          if (prev === 4) return movesCount > 2 ? 2 : 0;
          if (prev === 5) return movesCount > 3 ? 3 : (movesCount > 1 ? 1 : 0);
          return 0;
        });
      }
    },
    onDown: () => {
      if (showForfeitModal) return;
      if (activeDialogue) return;
      if (state.battle.activeTab === "switch" || isForcedSwitch) {
        const teamLen = state.battle.myTeam.length;
        if (teamLen === 0) return;
        setSwitchCursorIdx((prev) => (prev + 1) % teamLen);
      } else {
        const movesCount = activePoke?.moves.length ?? 0;
        setMoveCursorIdx((prev) => {
          if (prev === 0) return movesCount > 2 ? 2 : 4;
          if (prev === 1) return movesCount > 3 ? 3 : (movesCount > 2 ? 2 : 4);
          if (prev === 2) return 4;
          if (prev === 3) return 5;
          if (prev === 4) return 0;
          if (prev === 5) return movesCount > 1 ? 1 : 0;
          return 0;
        });
      }
    },
    onLeft: () => {
      if (showForfeitModal) return;
      if (activeDialogue) return;
      if (state.battle.activeTab === "switch" || isForcedSwitch) {
        const teamLen = state.battle.myTeam.length;
        if (teamLen === 0) return;
        setSwitchCursorIdx((prev) => (prev - 1 + teamLen) % teamLen);
      } else {
        const movesCount = activePoke?.moves.length ?? 0;
        setMoveCursorIdx((prev) => {
          if (prev === 0) return 5;
          if (prev === 1) return 0;
          if (prev === 2) return movesCount > 1 ? 1 : 0;
          if (prev === 3) return 2;
          if (prev === 4) return movesCount > 3 ? 3 : (movesCount > 2 ? 2 : (movesCount > 1 ? 1 : 0));
          if (prev === 5) return 4;
          return 0;
        });
      }
    },
    onRight: () => {
      if (showForfeitModal) return;
      if (activeDialogue) return;
      if (state.battle.activeTab === "switch" || isForcedSwitch) {
        const teamLen = state.battle.myTeam.length;
        if (teamLen === 0) return;
        setSwitchCursorIdx((prev) => (prev + 1) % teamLen);
      } else {
        const movesCount = activePoke?.moves.length ?? 0;
        setMoveCursorIdx((prev) => {
          // Continuously cycle forward through all options:
          // 0 -> 1 -> 2 -> 3 -> 4 (Switch) -> 5 (Forfeit) -> 0
          if (prev === 0) return movesCount > 1 ? 1 : (movesCount > 2 ? 2 : 4);
          if (prev === 1) return movesCount > 2 ? 2 : 4;
          if (prev === 2) return movesCount > 3 ? 3 : 4;
          if (prev === 3) return 4;
          if (prev === 4) return 5;
          if (prev === 5) return 0;
          return 0;
        });
      }
    },
    onEnter: () => {
      if (showForfeitModal) {
        handleForfeit();
        return;
      }
      if (state.battle.waitingForOpponent) {
        return;
      }
      if (activeDialogue) {
        handleAdvanceDialogue();
        return;
      }
      if (state.battle.activeTab === "switch" || isForcedSwitch) {
        handleConfirmSwitch(switchCursorIdx);
      } else {
        if (moveCursorIdx <= 3) {
          handleSelectMove(moveCursorIdx);
        } else if (moveCursorIdx === 4) {
          dispatch({ type: "SET_ACTIVE_TAB", tab: "switch" });
        } else if (moveCursorIdx === 5) {
          setShowForfeitModal(true);
        }
      }
    },
    onBack: () => {
      if (showForfeitModal) {
        setShowForfeitModal(false);
        return;
      }
      if (state.battle.waitingForOpponent) {
        handleCancelAction();
        return;
      }
      if (state.battle.activeTab === "switch" && !isForcedSwitch) {
        dispatch({ type: "SET_ACTIVE_TAB", tab: "moves" });
      }
    },
  }, [
    state.battle.currentDialogue,
    state.battle.activeTab,
    isForcedSwitch,
    moveCursorIdx,
    switchCursorIdx,
    showForfeitModal,
    activePoke,
    effectiveActiveIndex,
    state.battle.myTeam,
    state.battle.turnPrompt,
    state.battle.isSubmitting,
    state.battle.waitingForOpponent,
  ]);

  return (
    <div className="flex flex-col justify-between w-full h-full min-h-0 select-none text-slate-900">
      {/* Top Status & Turn Bar */}
      <div className="flex items-center justify-between px-2 py-0.5 border-b border-slate-900/40 text-[9px] font-mono">
        <span className="font-bold">TURN {state.battle.turnNumber}</span>
        {state.battle.opponentDisconnected ? (
          <span className="text-red-700 font-bold animate-pulse">
            OPPONENT DC (30s GRACE)
          </span>
        ) : (
          <span className="opacity-80">
            {state.battle.waitingForOpponent
              ? "WAITING FOR OPPONENT"
              : isForcedSwitch
              ? "FORCED SWITCH"
              : "ACTION SELECTION"}
          </span>
        )}
      </div>

      {/* Countdown Timer Bar */}
      <TurnCountdown
        prompt={state.battle.turnPrompt}
        timerEnabled={state.room.config?.timerEnabled}
        turnDurationSeconds={state.room.config?.turnDurationSeconds}
      />

      {/* Arena Graphic View with animated sprites, playback states, and bench reserve strips */}
      <ArenaView
        playerPokemon={activePoke}
        playerTeam={displayedTeam}
        activePokemonIndex={effectiveActiveIndex}
        opponentPublic={displayedOpponent}
        playerAnimState={playbackSnap?.playerAnimState ?? "idle"}
        opponentAnimState={playbackSnap?.opponentAnimState ?? "idle"}
        playerHit={playbackSnap?.playerHit ?? false}
        opponentHit={playbackSnap?.opponentHit ?? false}
        playerEntrySeq={playbackSnap?.playerEntrySeq ?? 0}
        opponentEntrySeq={playbackSnap?.opponentEntrySeq ?? 0}
        playerHpOverride={!hasPendingTurnPlayback && isPlaybackActive ? playbackSnap?.playerActiveHpOverride : undefined}
        opponentHpPercentOverride={!hasPendingTurnPlayback && isPlaybackActive ? playbackSnap?.opponentActiveHpOverride : undefined}
        onSelectBenchSlot={(idx) => {
          if (!isForcedSwitch) {
            dispatch({ type: "SET_ACTIVE_TAB", tab: "switch" });
          }
          setSwitchCursorIdx(idx);
        }}
      />

      {/* Interactive Lower Controls: Dialogue Box, Switch Menu, or Move Grid */}
      <div className="flex flex-col w-full p-1 bg-slate-900/10 rounded border-t border-slate-900/30 flex-shrink-0">
        {activeDialogue ? (
          <DialogueBox
            ref={dialogueBoxRef}
            message={activeDialogue}
            onAdvance={dispatchAdvanceEvent}
            onSkip={!state.battle.waitingForOpponent ? handleSkipPlayback : undefined}
            onCancel={state.battle.waitingForOpponent ? handleCancelAction : undefined}
            isWaiting={state.battle.waitingForOpponent}
          />
        ) : state.battle.waitingForOpponent || (legalActions.length === 0 && !isForcedSwitch) ? (
          <DialogueBox
            ref={dialogueBoxRef}
            message="Waiting for opponent..."
            onCancel={state.battle.waitingForOpponent ? handleCancelAction : undefined}
            isWaiting={true}
          />
        ) : state.battle.activeTab === "switch" || isForcedSwitch ? (
          <SwitchMenu
            team={state.battle.myTeam}
            activeIndex={effectiveActiveIndex}
            legalActions={legalActions}
            selectedIndex={switchCursorIdx}
            onSelectIndex={setSwitchCursorIdx}
            onConfirmSwitch={handleConfirmSwitch}
            onCancel={() => dispatch({ type: "SET_ACTIVE_TAB", tab: "moves" })}
            isForcedSwitch={isForcedSwitch}
          />
        ) : (
          <MoveGrid
            moves={activePoke?.moves || []}
            legalActions={legalActions}
            selectedIndex={moveCursorIdx}
            onSelectIndex={setMoveCursorIdx}
            onConfirm={handleSelectMove}
            onOpenSwitch={() => dispatch({ type: "SET_ACTIVE_TAB", tab: "switch" })}
            onForfeit={() => setShowForfeitModal(true)}
            disabled={state.battle.isSubmitting || state.battle.waitingForOpponent}
          />
        )}
      </div>

      {/* Forfeit Confirmation Modal (portaled to document.body to sit above both Pokédex screens) */}
      {showForfeitModal && (() => {
        const modal = (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          >
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-pokedex-darkred border-2 border-slate-950 text-white max-w-xs text-center shadow-2xl">
              <h3 className="text-xs font-bold text-amber-300">CONFIRM FORFEIT?</h3>
              <p className="text-[9px] leading-relaxed">
                Are you sure you want to surrender this battle? The victory will be awarded to your opponent.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForfeitModal(false)}
                  className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-bold"
                >
                  CANCEL [B]
                </button>
                <button
                  type="button"
                  onClick={handleForfeit}
                  className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-500 text-[9px] font-bold text-white shadow"
                >
                  YES, FORFEIT
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
      })()}
    </div>
  );
};
