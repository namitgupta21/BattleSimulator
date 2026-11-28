import type { BattleEventData, OpponentPublicState, PlayerPokemon } from "@pokemon/protocol";
import type { SpriteView } from "./SpriteUrlResolver.js";
import {
  ANIMATION_DURATIONS_MS,
  type SpriteAnimationState,
  getAnimationSpeedMultiplier,
  getEffectiveDurationMs,
  getSpriteReadyTimeoutMs,
} from "./animationConfig.js";
import { preloadPokemonSprites, waitForPokemonSprite } from "./spritePreloader.js";
import { formatEventText } from "../state/battleReducer.js";

export interface VisualPlaybackSnapshot {
  playerTeam: PlayerPokemon[];
  playerActiveIndex: number;
  playerActiveHpOverride?: number;
  opponentPublic: OpponentPublicState | null;
  opponentActiveHpOverride?: number;
  playerAnimState: SpriteAnimationState;
  opponentAnimState: SpriteAnimationState;
  playerHit: boolean;
  opponentHit: boolean;
  playerEntrySeq: number;
  opponentEntrySeq: number;
  currentDialogue: string | null;
  isPlaying: boolean;
}

export type SpriteWaitFn = (
  poke: { speciesId?: string; name?: string },
  variant: SpriteView,
  options: { prefersReducedMotion?: boolean; timeoutMs?: number; signal?: AbortSignal }
) => Promise<void>;

export interface PlayBattleStartOptions {
  playerTeam: PlayerPokemon[];
  playerActiveIndex: number;
  opponentPublic: OpponentPublicState | null;
  isResync?: boolean;
  prefersReducedMotion?: boolean;
  autoAdvance?: boolean;
  onComplete?: () => void;
}

export interface PlayTurnResultOptions {
  prevPlayerTeam: PlayerPokemon[];
  prevPlayerActiveIndex: number;
  prevOpponentPublic: OpponentPublicState | null;
  nextPlayerTeam: PlayerPokemon[];
  nextPlayerActiveIndex: number;
  nextOpponentPublic: OpponentPublicState | null;
  events: BattleEventData[];
  mySide: "p1" | "p2" | null;
  prefersReducedMotion?: boolean;
  autoAdvance?: boolean;
  onComplete?: () => void;
}

export class BattleEventSequencer {
  private snapshot: VisualPlaybackSnapshot;
  private activeRunId = 0;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private abortController: AbortController | null = null;
  private finalSnapshot: VisualPlaybackSnapshot | null = null;
  private activeOnComplete: (() => void) | undefined;
  private stepResolve: (() => void) | null = null;
  private activeStepFinish: (() => void) | null = null;
  private stepSkipRequested = false;
  private destroyed = false;

  constructor(
    private readonly onUpdate: (snapshot: VisualPlaybackSnapshot) => void,
    private readonly waitForSprite: SpriteWaitFn = waitForPokemonSprite,
    private readonly getMultiplier: () => number = getAnimationSpeedMultiplier
  ) {
    this.snapshot = {
      playerTeam: [],
      playerActiveIndex: 0,
      opponentPublic: null,
      playerAnimState: "idle",
      opponentAnimState: "idle",
      playerHit: false,
      opponentHit: false,
      playerEntrySeq: 0,
      opponentEntrySeq: 0,
      currentDialogue: null,
      isPlaying: false,
    };
  }

  getSnapshot(): VisualPlaybackSnapshot {
    return this.snapshot;
  }

  /**
   * Cancels all pending timers and sprite waits without advancing state.
   * Safe to call on component unmount or reset.
   */
  cancel(): void {
    this.activeRunId++;
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.stepResolve = null;
    this.activeStepFinish = null;
    this.stepSkipRequested = false;
    this.activeOnComplete = undefined;
  }

  /**
   * User-triggered advance (Enter / Space / A / Dialogue click):
   * - If the current step's animation is still running, finishes that step immediately (unless skipped).
   * - If paused waiting for user to read the current event, proceeds to the next event (or completes).
   */
  advance(): void {
    if (this.destroyed || !this.snapshot.isPlaying) {
      return;
    }
    if (this.activeStepFinish) {
      const finishStep = this.activeStepFinish;
      this.activeStepFinish = null;
      finishStep();
      return;
    }
    if (this.stepResolve) {
      const next = this.stepResolve;
      this.stepResolve = null;
      next();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.cancel();
  }

  revive(): void {
    this.destroyed = false;
  }

  /**
   * Skips current playback, cancelling timers and committing the exact final state
   * that playing the sequence in full would produce.
   */
  skip(): void {
    if (!this.snapshot.isPlaying && !this.finalSnapshot) {
      return;
    }
    const targetFinal = this.finalSnapshot;
    const doneCb = this.activeOnComplete;
    this.cancel();
    if (targetFinal) {
      this.snapshot = targetFinal;
      this.finalSnapshot = null;
      this.emit();
    } else if (this.snapshot.isPlaying) {
      this.snapshot = {
        ...this.snapshot,
        playerHit: false,
        opponentHit: false,
        currentDialogue: null,
        isPlaying: false,
      };
      this.emit();
    }
    doneCb?.();
  }

  /**
   * Immediately snaps to an authoritative idle state without replaying animations
   * (used on reconnect / state resync).
   */
  resync(params: {
    playerTeam: PlayerPokemon[];
    playerActiveIndex: number;
    opponentPublic: OpponentPublicState | null;
  }): void {
    this.cancel();
    const playerPoke = params.playerTeam[params.playerActiveIndex];
    const oppActive = params.opponentPublic?.active;

    this.snapshot = {
      playerTeam: params.playerTeam,
      playerActiveIndex: params.playerActiveIndex,
      playerActiveHpOverride: undefined,
      opponentPublic: params.opponentPublic,
      opponentActiveHpOverride: undefined,
      playerAnimState: playerPoke && playerPoke.currentHp <= 0 ? "fainted" : "idle",
      opponentAnimState: oppActive && oppActive.hpPercent <= 0 ? "fainted" : "idle",
      playerHit: false,
      opponentHit: false,
      playerEntrySeq: this.snapshot.playerEntrySeq,
      opponentEntrySeq: this.snapshot.opponentEntrySeq,
      currentDialogue: null,
      isPlaying: false,
    };
    this.finalSnapshot = null;
    this.emit();
  }

  /**
   * Plays battle start entrance animation (or snaps immediately on resync / multiplier 0).
   */
  playBattleStart(opts: PlayBattleStartOptions): void {
    this.cancel();
    if (this.destroyed) return;

    const prefersReducedMotion = opts.prefersReducedMotion ?? false;
    const autoAdvance = opts.autoAdvance ?? true;
    const multiplier = this.getMultiplier();
    const activePlayer = opts.playerTeam[opts.playerActiveIndex];
    const oppActive = opts.opponentPublic?.active ?? null;

    if (opts.isResync || (multiplier <= 0 && autoAdvance)) {
      const nextPlayerSeq = opts.isResync
        ? this.snapshot.playerEntrySeq
        : this.snapshot.playerEntrySeq + (activePlayer ? 1 : 0);
      const nextOppSeq = opts.isResync
        ? this.snapshot.opponentEntrySeq
        : this.snapshot.opponentEntrySeq + (oppActive ? 1 : 0);

      this.snapshot = {
        playerTeam: opts.playerTeam,
        playerActiveIndex: opts.playerActiveIndex,
        playerActiveHpOverride: undefined,
        opponentPublic: opts.opponentPublic,
        opponentActiveHpOverride: undefined,
        playerAnimState: activePlayer && activePlayer.currentHp <= 0 ? "fainted" : "idle",
        opponentAnimState: oppActive && oppActive.hpPercent <= 0 ? "fainted" : "idle",
        playerHit: false,
        opponentHit: false,
        playerEntrySeq: nextPlayerSeq,
        opponentEntrySeq: nextOppSeq,
        currentDialogue: null,
        isPlaying: false,
      };
      this.finalSnapshot = null;
      this.emit();
      opts.onComplete?.();
      return;
    }

    const nextPlayerSeq = this.snapshot.playerEntrySeq + (activePlayer ? 1 : 0);
    const nextOppSeq = this.snapshot.opponentEntrySeq + (oppActive ? 1 : 0);

    const finalSnap: VisualPlaybackSnapshot = {
      playerTeam: opts.playerTeam,
      playerActiveIndex: opts.playerActiveIndex,
      playerActiveHpOverride: undefined,
      opponentPublic: opts.opponentPublic,
      opponentActiveHpOverride: undefined,
      playerAnimState: "idle",
      opponentAnimState: "idle",
      playerHit: false,
      opponentHit: false,
      playerEntrySeq: nextPlayerSeq,
      opponentEntrySeq: nextOppSeq,
      currentDialogue: null,
      isPlaying: false,
    };

    this.finalSnapshot = finalSnap;
    this.activeOnComplete = opts.onComplete;

    // Preload own team & revealed opponent active
    if (opts.playerTeam.length > 0) {
      preloadPokemonSprites(opts.playerTeam, { includeBack: true, prefersReducedMotion });
    }
    if (oppActive) {
      preloadPokemonSprites([{ speciesId: oppActive.speciesId, name: oppActive.name }], {
        includeBack: false,
        prefersReducedMotion,
      });
    }

    // Hold initial visual state before sprites finish loading (avoids animating empty box)
    this.snapshot = {
      playerTeam: opts.playerTeam,
      playerActiveIndex: opts.playerActiveIndex,
      opponentPublic: opts.opponentPublic,
      playerAnimState: "idle",
      opponentAnimState: "idle",
      playerHit: false,
      opponentHit: false,
      playerEntrySeq: this.snapshot.playerEntrySeq,
      opponentEntrySeq: this.snapshot.opponentEntrySeq,
      currentDialogue: "Battle has begun! What will you do?",
      isPlaying: true,
    };
    this.emit();

    const runId = this.activeRunId;
    const controller = new AbortController();
    this.abortController = controller;

    void this.runBattleStart(
      runId,
      controller.signal,
      activePlayer,
      oppActive,
      nextPlayerSeq,
      nextOppSeq,
      finalSnap,
      prefersReducedMotion,
      multiplier,
      autoAdvance,
      opts.onComplete
    );
  }

  private async runBattleStart(
    runId: number,
    signal: AbortSignal,
    activePlayer: PlayerPokemon | undefined,
    oppActive: OpponentPublicState["active"],
    nextPlayerSeq: number,
    nextOppSeq: number,
    finalSnap: VisualPlaybackSnapshot,
    prefersReducedMotion: boolean,
    multiplier: number,
    autoAdvance: boolean,
    onComplete?: () => void
  ): Promise<void> {
    if (multiplier > 0) {
      this.stepSkipRequested = false;
      const spriteTimeout = getSpriteReadyTimeoutMs(prefersReducedMotion, multiplier);
      const waits: Array<{
        poke: { speciesId?: string; name?: string };
        variant: SpriteView;
        timeoutMs: number;
      }> = [];
      if (activePlayer) {
        waits.push({
          poke: { speciesId: activePlayer.speciesId, name: activePlayer.name },
          variant: "back",
          timeoutMs: spriteTimeout,
        });
      }
      if (oppActive) {
        waits.push({
          poke: { speciesId: oppActive.speciesId, name: oppActive.name },
          variant: "front",
          timeoutMs: spriteTimeout,
        });
      }

      await this.waitForSpritesInterruptible(runId, signal, waits, prefersReducedMotion);
      if (!this.isRunActive(runId, signal)) return;

      if (!this.stepSkipRequested) {
        // Trigger entrance animations on both revealed leads
        this.snapshot = {
          ...this.snapshot,
          playerAnimState: activePlayer ? "entering" : "idle",
          opponentAnimState: oppActive ? "entering" : "idle",
          playerEntrySeq: nextPlayerSeq,
          opponentEntrySeq: nextOppSeq,
        };
        this.emit();

        const entranceMs = getEffectiveDurationMs(
          ANIMATION_DURATIONS_MS.entrance,
          prefersReducedMotion,
          multiplier
        );
        await this.waitMs(entranceMs, runId, signal);
        if (!this.isRunActive(runId, signal)) return;
      }
    } else {
      this.stepSkipRequested = false;
    }

    if (!autoAdvance && !this.stepSkipRequested) {
      // Animations settled cleanly; keep "Battle has begun! What will you do?" until user advances
      this.snapshot = {
        ...this.snapshot,
        playerAnimState: "idle",
        opponentAnimState: "idle",
        playerEntrySeq: nextPlayerSeq,
        opponentEntrySeq: nextOppSeq,
      };
      this.emit();
      await this.waitForAdvance(runId, signal);
      if (!this.isRunActive(runId, signal)) return;
    }

    this.snapshot = finalSnap;
    this.finalSnapshot = null;
    this.activeOnComplete = undefined;
    this.emit();
    onComplete?.();
  }

  /**
   * Plays a turn's sequential events and animations (damage hit, faint, switch-out, switch-in).
   * Cancels any mid-flight previous turn playback cleanly before starting.
   */
  playTurnResult(opts: PlayTurnResultOptions): void {
    // Cancel any previous playback; if a prior turn was still finishing, snap its data cleanly first
    if (this.finalSnapshot) {
      this.activeOnComplete = undefined;
    }
    this.cancel();
    if (this.destroyed) return;

    const prefersReducedMotion = opts.prefersReducedMotion ?? false;
    const autoAdvance = opts.autoAdvance ?? true;
    const multiplier = this.getMultiplier();

    const playerSwitchCount = opts.events.filter(
      (e) => e.type === "SwitchedIn" && e.side === opts.mySide
    ).length;
    const oppSwitchCount = opts.events.filter(
      (e) =>
        e.type === "SwitchedIn" &&
        e.side !== opts.mySide &&
        this.isOpponentRevealed(e.pokemon, opts.nextOpponentPublic)
    ).length;

    const finalPlayerSeq = this.snapshot.playerEntrySeq + playerSwitchCount;
    const finalOppSeq = this.snapshot.opponentEntrySeq + oppSwitchCount;

    const nextActivePlayer = opts.nextPlayerTeam[opts.nextPlayerActiveIndex];
    const nextOppActive = opts.nextOpponentPublic?.active ?? null;

    const finalSnap: VisualPlaybackSnapshot = {
      playerTeam: opts.nextPlayerTeam,
      playerActiveIndex: opts.nextPlayerActiveIndex,
      playerActiveHpOverride: undefined,
      opponentPublic: opts.nextOpponentPublic,
      opponentActiveHpOverride: undefined,
      playerAnimState: nextActivePlayer && nextActivePlayer.currentHp <= 0 ? "fainted" : "idle",
      opponentAnimState: nextOppActive && nextOppActive.hpPercent <= 0 ? "fainted" : "idle",
      playerHit: false,
      opponentHit: false,
      playerEntrySeq: finalPlayerSeq,
      opponentEntrySeq: finalOppSeq,
      currentDialogue: null,
      isPlaying: false,
    };

    const screenEvents = opts.events.filter(
      (evt) => evt.type !== "TurnStarted" && evt.type !== "TurnEnded"
    );

    // Preload any newly revealed opponent active/bench sprites cleanly
    if (opts.nextOpponentPublic?.active) {
      preloadPokemonSprites(
        [
          {
            speciesId: opts.nextOpponentPublic.active.speciesId,
            name: opts.nextOpponentPublic.active.name,
          },
        ],
        { includeBack: false, prefersReducedMotion }
      );
    }

    if (screenEvents.length === 0 || (multiplier <= 0 && autoAdvance)) {
      this.snapshot = finalSnap;
      this.finalSnapshot = null;
      this.emit();
      opts.onComplete?.();
      return;
    }

    this.finalSnapshot = finalSnap;
    this.activeOnComplete = opts.onComplete;

    // Start visual snapshot from pre-turn state so outgoing switches & pre-faint bench icons render cleanly
    this.snapshot = {
      playerTeam: opts.prevPlayerTeam.map((p) => ({ ...p })),
      playerActiveIndex: opts.prevPlayerActiveIndex,
      opponentPublic: opts.prevOpponentPublic ? cloneOpponentPublic(opts.prevOpponentPublic) : null,
      playerAnimState: "idle",
      opponentAnimState: "idle",
      playerHit: false,
      opponentHit: false,
      playerEntrySeq: this.snapshot.playerEntrySeq,
      opponentEntrySeq: this.snapshot.opponentEntrySeq,
      currentDialogue: formatEventText(screenEvents[0], opts.mySide) || null,
      isPlaying: true,
    };
    this.emit();

    const runId = this.activeRunId;
    const controller = new AbortController();
    this.abortController = controller;

    void this.runTurnSequence(
      runId,
      controller.signal,
      screenEvents,
      opts,
      finalSnap,
      prefersReducedMotion,
      multiplier,
      autoAdvance
    );
  }

  private async runTurnSequence(
    runId: number,
    signal: AbortSignal,
    screenEvents: BattleEventData[],
    opts: PlayTurnResultOptions,
    finalSnap: VisualPlaybackSnapshot,
    prefersReducedMotion: boolean,
    multiplier: number,
    autoAdvance: boolean
  ): Promise<void> {
    for (const evt of screenEvents) {
      if (!this.isRunActive(runId, signal)) return;
      this.stepSkipRequested = false;

      const text = formatEventText(evt, opts.mySide);
      if (text) {
        this.snapshot = { ...this.snapshot, currentDialogue: text };
        this.emit();
      }

      const isPlayerSide = evt.side === opts.mySide;

      if (evt.type === "MoveUsed") {
        if (autoAdvance) {
          const moveBeatMs = prefersReducedMotion
            ? 0
            : getEffectiveDurationMs(ANIMATION_DURATIONS_MS.moveBeat, false, multiplier);
          await this.waitMs(moveBeatMs, runId, signal);
          if (!this.isRunActive(runId, signal)) return;
        }
      } else if (evt.type === "DamageDealt" || evt.type === "StatusDamage") {
        // Apply immediate visual HP change so HealthBar transitions alongside hit blink/shake
        this.applyVisualDamage(isPlayerSide, evt, opts, screenEvents);
        this.snapshot = {
          ...this.snapshot,
          playerHit: isPlayerSide ? true : this.snapshot.playerHit,
          opponentHit: !isPlayerSide ? true : this.snapshot.opponentHit,
        };
        this.emit();

        const hitMs = prefersReducedMotion
          ? 0
          : getEffectiveDurationMs(ANIMATION_DURATIONS_MS.hit, false, multiplier);
        await this.waitMs(hitMs, runId, signal);
        if (!this.isRunActive(runId, signal)) return;

        this.snapshot = {
          ...this.snapshot,
          playerHit: false,
          opponentHit: false,
        };
        this.emit();
      } else if (evt.type === "Fainted") {
        // Drop active HP to 0 in sync with faint drop-and-fade, keeping bench icons un-X'd until completion
        this.applyActiveFaintHpZero(isPlayerSide);
        this.snapshot = {
          ...this.snapshot,
          playerAnimState: isPlayerSide ? "fainted" : this.snapshot.playerAnimState,
          opponentAnimState: !isPlayerSide ? "fainted" : this.snapshot.opponentAnimState,
        };
        this.emit();

        const faintMs = getEffectiveDurationMs(
          ANIMATION_DURATIONS_MS.faint,
          prefersReducedMotion,
          multiplier
        );
        await this.waitMs(faintMs, runId, signal);
        if (!this.isRunActive(runId, signal)) return;

        // Faint animation finished -> now commit bench icon fainted update
        this.commitFaintedBenchIcon(isPlayerSide, evt.pokemon, opts);
        this.emit();
      } else if (evt.type === "SwitchedIn") {
        // Hidden-info guard: never reveal or animate an unrevealed opponent Pokémon
        if (!isPlayerSide && !this.isOpponentRevealed(evt.pokemon, opts.nextOpponentPublic)) {
          continue;
        }

        const currentAnim = isPlayerSide
          ? this.snapshot.playerAnimState
          : this.snapshot.opponentAnimState;
        const currentMon = isPlayerSide
          ? this.snapshot.playerTeam[this.snapshot.playerActiveIndex]
          : this.snapshot.opponentPublic?.active;

        // If a living active Pokémon was on the field, shrink/fade it out first (~200ms)
        if (
          currentMon &&
          currentAnim !== "fainted" &&
          currentMon.name.toLowerCase() !== (evt.pokemon ?? "").toLowerCase()
        ) {
          this.snapshot = {
            ...this.snapshot,
            playerAnimState: isPlayerSide ? "leaving" : this.snapshot.playerAnimState,
            opponentAnimState: !isPlayerSide ? "leaving" : this.snapshot.opponentAnimState,
          };
          this.emit();

          const leaveMs = getEffectiveDurationMs(
            ANIMATION_DURATIONS_MS.switchOut,
            prefersReducedMotion,
            multiplier
          );
          await this.waitMs(leaveMs, runId, signal);
          if (!this.isRunActive(runId, signal)) return;
        }

        // Resolve the revealed incoming Pokémon
        const incomingPlayerIdx = isPlayerSide
          ? this.findPlayerIndex(opts.nextPlayerTeam, evt.pokemon, opts.nextPlayerActiveIndex)
          : -1;
        const incomingPlayerMon =
          incomingPlayerIdx !== -1 ? opts.nextPlayerTeam[incomingPlayerIdx] : undefined;
        const incomingOppMon = !isPlayerSide
          ? this.findRevealedOpponent(evt.pokemon, opts.nextOpponentPublic)
          : undefined;

        const incomingMeta = isPlayerSide ? incomingPlayerMon : incomingOppMon;
        if (incomingMeta && multiplier > 0 && !this.stepSkipRequested) {
          const spriteTimeout = getSpriteReadyTimeoutMs(prefersReducedMotion, multiplier);
          await this.waitForSpritesInterruptible(
            runId,
            signal,
            [
              {
                poke: { speciesId: incomingMeta.speciesId, name: incomingMeta.name },
                variant: isPlayerSide ? "back" : "front",
                timeoutMs: spriteTimeout,
              },
            ],
            prefersReducedMotion
          );
          if (!this.isRunActive(runId, signal)) return;
        }

        // Swap visual active Pokémon, increment entrySeq key, and play entrance (~400ms)
        const playEntrance = multiplier > 0 && !this.stepSkipRequested;
        if (isPlayerSide) {
          this.snapshot = {
            ...this.snapshot,
            playerActiveIndex: incomingPlayerIdx !== -1 ? incomingPlayerIdx : opts.nextPlayerActiveIndex,
            playerActiveHpOverride: undefined,
            playerTeam: opts.nextPlayerTeam,
            playerAnimState: playEntrance ? "entering" : "idle",
            playerEntrySeq: this.snapshot.playerEntrySeq + 1,
          };
        } else if (incomingOppMon && this.snapshot.opponentPublic) {
          this.snapshot = {
            ...this.snapshot,
            opponentActiveHpOverride: undefined,
            opponentPublic: {
              ...this.snapshot.opponentPublic,
              active: incomingOppMon,
              aliveCount: opts.nextOpponentPublic?.aliveCount ?? this.snapshot.opponentPublic.aliveCount,
              faintedCount:
                opts.nextOpponentPublic?.faintedCount ?? this.snapshot.opponentPublic.faintedCount,
              revealedBench:
                opts.nextOpponentPublic?.revealedBench ?? this.snapshot.opponentPublic.revealedBench,
            },
            opponentAnimState: playEntrance ? "entering" : "idle",
            opponentEntrySeq: this.snapshot.opponentEntrySeq + 1,
          };
        }
        this.emit();

        if (playEntrance) {
          const enterMs = getEffectiveDurationMs(
            ANIMATION_DURATIONS_MS.entrance,
            prefersReducedMotion,
            multiplier
          );
          await this.waitMs(enterMs, runId, signal);
          if (!this.isRunActive(runId, signal)) return;

          this.snapshot = {
            ...this.snapshot,
            playerAnimState: isPlayerSide ? "idle" : this.snapshot.playerAnimState,
            opponentAnimState: !isPlayerSide ? "idle" : this.snapshot.opponentAnimState,
          };
          this.emit();
        }
      }

      // Pause for user Enter / Dialogue click after each visible dialogue step in interactive mode
      if (!autoAdvance && text && !this.stepSkipRequested) {
        await this.waitForAdvance(runId, signal);
        if (!this.isRunActive(runId, signal)) return;
      }
    }

    if (!this.isRunActive(runId, signal)) return;

    // Commit exact final state and unlock move/switch controls
    this.snapshot = finalSnap;
    this.finalSnapshot = null;
    const doneCb = this.activeOnComplete;
    this.activeOnComplete = undefined;
    this.emit();
    doneCb?.();
  }

  private applyVisualDamage(
    isPlayerSide: boolean,
    evt: BattleEventData,
    opts: PlayTurnResultOptions,
    screenEvents: BattleEventData[]
  ): void {
    if (isPlayerSide) {
      const idx = this.snapshot.playerActiveIndex;
      const mon = this.snapshot.playerTeam[idx];
      if (!mon) return;
      const baseHp = this.snapshot.playerActiveHpOverride ?? mon.currentHp;
      const updatedHp =
        evt.type === "DamageDealt" && typeof evt.intValue2 === "number"
          ? Math.max(0, Math.min(mon.maxHp, evt.intValue2))
          : Math.max(0, baseHp - (evt.intValue1 ?? 0));
      // Keep bench icon alive until faint completes if HP hit 0
      const updatedTeam =
        updatedHp > 0
          ? this.snapshot.playerTeam.map((p, i) => (i === idx ? { ...p, currentHp: updatedHp } : p))
          : this.snapshot.playerTeam;
      this.snapshot = {
        ...this.snapshot,
        playerTeam: updatedTeam,
        playerActiveHpOverride: updatedHp,
      };
    } else if (this.snapshot.opponentPublic?.active) {
      const activeOpp = this.snapshot.opponentPublic.active;
      const basePercent = this.snapshot.opponentActiveHpOverride ?? activeOpp.hpPercent;
      const nextOpp = opts.nextOpponentPublic?.active;
      const evtIdx = screenEvents.indexOf(evt);
      const hasLaterOppDamageForSameMon = screenEvents.slice(evtIdx + 1).some(
        (later) =>
          (later.type === "DamageDealt" || later.type === "StatusDamage") &&
          later.side !== opts.mySide &&
          (!later.pokemon || later.pokemon.toLowerCase() === activeOpp.name.toLowerCase())
      );

      let nextPercent = basePercent;
      if (!hasLaterOppDamageForSameMon && nextOpp && nextOpp.name.toLowerCase() === activeOpp.name.toLowerCase()) {
        nextPercent = nextOpp.hpPercent;
      } else {
        const faintedLater = opts.events.some(
          (e) =>
            e.type === "Fainted" &&
            e.side !== opts.mySide &&
            e.pokemon?.toLowerCase() === activeOpp.name.toLowerCase()
        );
        if (!hasLaterOppDamageForSameMon && faintedLater) {
          nextPercent = 0;
        } else {
          // Approximate incremental drop without overshooting final HP when another hit follows
          const targetFloor =
            nextOpp && nextOpp.name.toLowerCase() === activeOpp.name.toLowerCase()
              ? nextOpp.hpPercent
              : faintedLater
              ? 0
              : 1;
          const remainingDrop = Math.max(0, basePercent - targetFloor);
          nextPercent = Math.max(targetFloor, basePercent - Math.max(1, Math.ceil(remainingDrop / 2)));
        }
      }
      // Keep opponent bench counts pre-faint until faint animation finishes
      this.snapshot = {
        ...this.snapshot,
        opponentActiveHpOverride: nextPercent,
        opponentPublic:
          nextPercent > 0
            ? {
                ...this.snapshot.opponentPublic,
                active: { ...activeOpp, hpPercent: nextPercent },
              }
            : this.snapshot.opponentPublic,
      };
    }
  }

  private applyActiveFaintHpZero(isPlayerSide: boolean): void {
    if (isPlayerSide) {
      this.snapshot = {
        ...this.snapshot,
        playerActiveHpOverride: 0,
      };
    } else {
      this.snapshot = {
        ...this.snapshot,
        opponentActiveHpOverride: 0,
      };
    }
  }

  private commitFaintedBenchIcon(
    isPlayerSide: boolean,
    faintedName: string | undefined,
    opts: PlayTurnResultOptions
  ): void {
    if (isPlayerSide) {
      const targetTeam = this.snapshot.playerTeam.map((p, idx) => {
        const nameMatch = faintedName && p.name.toLowerCase() === faintedName.toLowerCase();
        if (nameMatch || idx === this.snapshot.playerActiveIndex) {
          return { ...p, currentHp: 0 };
        }
        return p;
      });
      this.snapshot = {
        ...this.snapshot,
        playerTeam: targetTeam,
        playerActiveHpOverride: 0,
      };
    } else if (this.snapshot.opponentPublic && opts.nextOpponentPublic) {
      const activeOpp = this.snapshot.opponentPublic.active;
      this.snapshot = {
        ...this.snapshot,
        opponentActiveHpOverride: 0,
        opponentPublic: {
          ...this.snapshot.opponentPublic,
          active: activeOpp ? { ...activeOpp, hpPercent: 0 } : null,
          aliveCount: opts.nextOpponentPublic.aliveCount,
          faintedCount: opts.nextOpponentPublic.faintedCount,
          revealedBench: opts.nextOpponentPublic.revealedBench,
        },
      };
    }
  }

  private isOpponentRevealed(
    pokemonName: string | undefined,
    nextOpp: OpponentPublicState | null
  ): boolean {
    if (!pokemonName || !nextOpp) return false;
    const target = pokemonName.toLowerCase();
    if (nextOpp.active?.name.toLowerCase() === target) return true;
    return Boolean(nextOpp.revealedBench?.some((p) => p.name.toLowerCase() === target));
  }

  private findPlayerIndex(
    team: PlayerPokemon[],
    pokemonName: string | undefined,
    fallback: number
  ): number {
    if (!pokemonName) return fallback;
    const idx = team.findIndex((p) => p.name.toLowerCase() === pokemonName.toLowerCase());
    return idx !== -1 ? idx : fallback;
  }

  private findRevealedOpponent(
    pokemonName: string | undefined,
    nextOpp: OpponentPublicState | null
  ): OpponentPublicState["active"] {
    if (!nextOpp) return null;
    if (!pokemonName) return nextOpp.active;
    const target = pokemonName.toLowerCase();
    if (nextOpp.active?.name.toLowerCase() === target) return nextOpp.active;
    return nextOpp.revealedBench?.find((p) => p.name.toLowerCase() === target) ?? nextOpp.active;
  }

  private async waitForSpritesInterruptible(
    runId: number,
    signal: AbortSignal,
    waits: Array<{
      poke: { speciesId?: string; name?: string };
      variant: SpriteView;
      timeoutMs: number;
    }>,
    prefersReducedMotion: boolean
  ): Promise<void> {
    if (waits.length === 0 || !this.isRunActive(runId, signal)) {
      return;
    }
    const stepController = new AbortController();
    const onRunAbort = () => stepController.abort();
    signal.addEventListener("abort", onRunAbort, { once: true });

    const finishNow = () => {
      this.stepSkipRequested = true;
      if (this.activeStepFinish === finishNow) {
        this.activeStepFinish = null;
      }
      stepController.abort();
    };
    this.activeStepFinish = finishNow;

    try {
      await Promise.all(
        waits.map((w) =>
          this.waitForSprite(w.poke, w.variant, {
            prefersReducedMotion,
            timeoutMs: w.timeoutMs,
            signal: stepController.signal,
          })
        )
      );
    } finally {
      if (this.activeStepFinish === finishNow) {
        this.activeStepFinish = null;
      }
      signal.removeEventListener("abort", onRunAbort);
    }
  }

  private waitMs(ms: number, runId: number, signal: AbortSignal): Promise<void> {
    if (ms <= 0 || !this.isRunActive(runId, signal)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const finish = () => {
        this.pendingTimers.delete(timer);
        if (this.activeStepFinish === finishNow) {
          this.activeStepFinish = null;
        }
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const finishNow = () => {
        this.stepSkipRequested = true;
        clearTimeout(timer);
        finish();
      };
      const onAbort = () => {
        clearTimeout(timer);
        finish();
      };
      this.activeStepFinish = finishNow;
      const timer = setTimeout(finish, ms);
      this.pendingTimers.add(timer);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private waitForAdvance(runId: number, signal: AbortSignal): Promise<void> {
    if (!this.isRunActive(runId, signal)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const finish = () => {
        if (this.stepResolve === finish) {
          this.stepResolve = null;
        }
        signal.removeEventListener("abort", finish);
        resolve();
      };
      this.stepResolve = finish;
      signal.addEventListener("abort", finish, { once: true });
    });
  }

  private isRunActive(runId: number, signal: AbortSignal): boolean {
    return !this.destroyed && runId === this.activeRunId && !signal.aborted;
  }

  private emit(): void {
    if (!this.destroyed) {
      this.onUpdate(this.snapshot);
    }
  }
}

function cloneOpponentPublic(opp: OpponentPublicState): OpponentPublicState {
  return {
    ...opp,
    active: opp.active ? { ...opp.active } : null,
    revealedBench: opp.revealedBench ? opp.revealedBench.map((p) => ({ ...p })) : undefined,
  };
}
