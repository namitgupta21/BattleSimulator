import crypto from "node:crypto";
import type {
  Action,
  BattleEndReason,
  BattleEventData,
  PlayerSide,
} from "@pokemon/protocol";
import { ErrorCode } from "@pokemon/protocol";
import type {
  BattleSession,
  EngineAdapter,
  EngineBattleState,
  EngineTeamData,
} from "@pokemon/engine-binding";
import type { Clock, TimerHandle } from "../clock/clock.js";
import { BattleSanitizer } from "./fog-of-war.js";
import type { BattleLogStore, BattleRecord, TurnLogEntry } from "../store/battle-log-store.js";
import type { Room } from "../room/room.js";

export interface TurnPromptData {
  turnNumber: number;
  phase: "ActionSelection" | "ForcedSwitchP1" | "ForcedSwitchP2" | "ForcedSwitchBoth" | "GameOver";
  legalActions: Action[];
  serverTime: number;
  deadline?: number;
  remainingMs?: number;
}

export interface TurnResultData {
  turnNumber: number;
  events: BattleEventData[];
  yourTeam: any[];
  opponentPublic: any;
}

export interface BattleStartData {
  seed: number;
  team: any[];
  opponentPublic: any;
}

export interface BattleEndData {
  winner: "p1" | "p2" | "draw";
  reason: BattleEndReason;
  replayLogId: string;
}

export interface BattleOrchestratorCallbacks {
  onBattleStart(side: PlayerSide, payload: BattleStartData): void;
  onTurnPrompt(side: PlayerSide, payload: TurnPromptData): void;
  onTurnResult(side: PlayerSide, payload: TurnResultData): void;
  onBattleEnd(payload: BattleEndData): void;
  onPlayerDisconnected?(side: PlayerSide): void;
  onPlayerReconnected?(side: PlayerSide): void;
}

export class BattleOrchestrator {
  readonly battleId: string;
  readonly roomId: string;
  readonly seed: number;

  private session: BattleSession;
  private p1Team: EngineTeamData;
  private p2Team: EngineTeamData;

  private revealedMovesP1 = new Set<string>();
  private revealedMovesP2 = new Set<string>();

  private pendingActions: { p1?: Action; p2?: Action } = {};
  private pendingSwitches: { p1?: Action; p2?: Action } = {};

  private turnDeadline: number = 0;
  private turnTimerHandle?: TimerHandle;
  private disconnectTimerHandleP1?: TimerHandle;
  private disconnectTimerHandleP2?: TimerHandle;

  private turnLogs: TurnLogEntry[] = [];
  private isFinished: boolean = false;

  constructor(
    private readonly room: Room,
    private readonly adapter: EngineAdapter,
    private readonly clock: Clock,
    private readonly logStore: BattleLogStore,
    private readonly callbacks: BattleOrchestratorCallbacks,
    injectedSeed?: number
  ) {
    this.battleId = crypto.randomUUID();
    this.roomId = room.id;
    this.seed = injectedSeed ?? Math.floor(Math.random() * 1000000000);

    // Generate balanced teams deterministically from seed
    this.p1Team = this.adapter.generateTeam(this.seed, this.room.config.teamSize);
    this.p2Team = this.adapter.generateTeam(this.seed + 1, this.room.config.teamSize);

    // Create pure engine session with disabled engine timer (enforced by adapter)
    this.session = this.adapter.createBattle(this.seed, this.p1Team, this.p2Team);
  }

  start(): void {
    // Send initial battle:start with sanitized views to both players
    this.sendBattleStart("p1");
    this.sendBattleStart("p2");

    this.startTurn();
  }

  get currentState(): EngineBattleState {
    return this.session.getState();
  }

  isBattleFinished(): boolean {
    return this.isFinished;
  }

  getTurnDeadline(): number {
    return this.turnDeadline;
  }

  submitAction(side: PlayerSide, action: Action): void {
    if (this.isFinished) {
      throw new Error(ErrorCode.BATTLE_NOT_FOUND);
    }

    const state = this.session.getState();

    // Check if in forced switch phase
    if (state.phase.startsWith("ForcedSwitch")) {
      this.submitForcedSwitch(side, action);
      return;
    }

    if (state.phase !== "ActionSelection") {
      throw new Error(ErrorCode.ACTION_OUT_OF_TURN);
    }

    if (this.pendingActions[side]) {
      throw new Error(ErrorCode.ACTION_OUT_OF_TURN);
    }

    // Validate legality with engine
    const legalActions = this.session.getLegalActions(side);
    const isLegal = legalActions.some(
      (a) => a.type === action.type && a.index === action.index
    );

    if (!isLegal) {
      throw new Error(ErrorCode.ACTION_ILLEGAL);
    }

    this.pendingActions[side] = action;

    // Resolve immediately when both actions have arrived
    if (this.pendingActions.p1 && this.pendingActions.p2) {
      this.clearTurnTimer();
      this.resolveTurn();
    }
  }

  submitForcedSwitch(side: PlayerSide, action: Action): void {
    if (action.type !== "switch") {
      throw new Error(ErrorCode.ACTION_ILLEGAL);
    }

    const state = this.session.getState();
    const needsP1 = state.phase === "ForcedSwitchP1" || state.phase === "ForcedSwitchBoth";
    const needsP2 = state.phase === "ForcedSwitchP2" || state.phase === "ForcedSwitchBoth";

    if (side === "p1" && !needsP1) throw new Error(ErrorCode.ACTION_OUT_OF_TURN);
    if (side === "p2" && !needsP2) throw new Error(ErrorCode.ACTION_OUT_OF_TURN);

    const legalSwitches = this.session.getLegalSwitches(side);
    const isLegal = legalSwitches.some(
      (s) => s.type === action.type && s.index === action.index
    );

    if (!isLegal) {
      throw new Error(ErrorCode.ACTION_ILLEGAL);
    }

    this.pendingSwitches[side] = action;

    const readyP1 = !needsP1 || Boolean(this.pendingSwitches.p1);
    const readyP2 = !needsP2 || Boolean(this.pendingSwitches.p2);

    if (readyP1 && readyP2) {
      this.clearTurnTimer();
      this.resolveForcedSwitches();
    }
  }

  handleDisconnect(side: PlayerSide): void {
    if (this.isFinished) return;

    const player = this.room.getPlayer(side);
    if (player) {
      player.isConnected = false;
    }

    this.callbacks.onPlayerDisconnected?.(side);

    // Turn timer keeps running during disconnect!
    // Disconnect grace period: min(30s, remaining turn time if timer enabled)
    const now = this.clock.now();
    let graceMs = 30000;
    if (this.room.config.timerEnabled && this.turnDeadline > now) {
      graceMs = Math.min(30000, this.turnDeadline - now);
    }

    const timer = this.clock.setTimeout(() => {
      this.forfeitBattle(side, "disconnect");
    }, graceMs);

    if (side === "p1") {
      this.disconnectTimerHandleP1?.cancel();
      this.disconnectTimerHandleP1 = timer;
    } else {
      this.disconnectTimerHandleP2?.cancel();
      this.disconnectTimerHandleP2 = timer;
    }
  }

  handleReconnect(side: PlayerSide): void {
    if (this.isFinished) return;

    if (side === "p1") {
      this.disconnectTimerHandleP1?.cancel();
      this.disconnectTimerHandleP1 = undefined;
    } else {
      this.disconnectTimerHandleP2?.cancel();
      this.disconnectTimerHandleP2 = undefined;
    }

    const player = this.room.getPlayer(side);
    if (player) {
      player.isConnected = true;
    }

    this.callbacks.onPlayerReconnected?.(side);

    // Re-send current turn prompt with remaining time and full state
    this.sendTurnPrompt(side);
  }

  forfeitBattle(forfeitingSide: PlayerSide, reason: BattleEndReason): void {
    if (this.isFinished) return;

    this.clearAllTimers();
    this.isFinished = true;
    this.room.finishBattle();

    const winner: "p1" | "p2" = forfeitingSide === "p1" ? "p2" : "p1";

    const record: BattleRecord = {
      id: this.battleId,
      roomId: this.roomId,
      seed: this.seed,
      p1Team: this.p1Team,
      p2Team: this.p2Team,
      turns: this.turnLogs,
      winner,
      endReason: reason,
      createdAt: this.room.createdAt,
      endedAt: this.clock.now(),
    };
    this.logStore.save(record);

    this.callbacks.onBattleEnd({
      winner,
      reason,
      replayLogId: this.battleId,
    });
  }

  private sendBattleStart(side: PlayerSide): void {
    const state = this.session.getState();
    const ownTeamData = side === "p1" ? state.p1Team : state.p2Team;
    const oppTeamData = side === "p1" ? state.p2Team : state.p1Team;
    const oppRevealedMoves = side === "p1" ? this.revealedMovesP2 : this.revealedMovesP1;

    const yourTeam = ownTeamData.pokemon.map(BattleSanitizer.toPlayerPokemon);
    const opponentPublic = BattleSanitizer.getOpponentPublicState(
      oppTeamData,
      oppRevealedMoves
    );

    this.callbacks.onBattleStart(side, {
      seed: this.seed,
      team: yourTeam,
      opponentPublic,
    });
  }

  private startTurn(): void {
    if (this.isFinished) return;

    const state = this.session.getState();
    if (state.phase === "GameOver" || this.session.isGameOver()) {
      const winner = this.session.getWinner() ?? "draw";
      this.finishGame(winner, "knockout");
      return;
    }

    this.pendingActions = {};
    this.pendingSwitches = {};

    const now = this.clock.now();
    if (this.room.config.timerEnabled) {
      const durationMs = this.room.config.turnDurationSeconds * 1000;
      this.turnDeadline = now + durationMs;
      this.turnTimerHandle = this.clock.setTimeout(() => {
        this.onTurnTimeout();
      }, durationMs);
    } else {
      this.turnDeadline = 0;
    }

    this.sendTurnPrompt("p1");
    this.sendTurnPrompt("p2");
  }

  private sendTurnPrompt(side: PlayerSide): void {
    const state = this.session.getState();

    let legalActions: Action[] = [];
    if (state.phase === "ActionSelection") {
      legalActions = this.session.getLegalActions(side);
    } else if (
      (side === "p1" && (state.phase === "ForcedSwitchP1" || state.phase === "ForcedSwitchBoth")) ||
      (side === "p2" && (state.phase === "ForcedSwitchP2" || state.phase === "ForcedSwitchBoth"))
    ) {
      legalActions = this.session.getLegalSwitches(side);
    }

    const now = this.clock.now();
    const remainingMs = this.turnDeadline > 0 ? Math.max(0, this.turnDeadline - now) : undefined;

    const payload: TurnPromptData = {
      turnNumber: state.turnNumber,
      phase: state.phase,
      legalActions,
      serverTime: now,
      deadline: this.turnDeadline > 0 ? this.turnDeadline : undefined,
      remainingMs,
    };

    this.callbacks.onTurnPrompt(side, payload);
  }

  private resolveTurn(): void {
    const action1 = this.pendingActions.p1!;
    const action2 = this.pendingActions.p2!;

    const result = this.session.step(action1, action2);

    // Update revealed moves for opponent public fog-of-war
    for (const event of result.events) {
      if (event.type === "MoveUsed" && event.move) {
        if (event.side === "p1") {
          this.revealedMovesP1.add(event.move);
        } else {
          this.revealedMovesP2.add(event.move);
        }
      }
    }

    // Record turn in log store
    this.turnLogs.push({
      turnNumber: result.nextState.turnNumber - 1,
      actions: { p1: action1, p2: action2 },
      events: result.events,
    });

    this.emitTurnResult(result.nextState, result.events);

    if (this.session.isGameOver() || result.nextState.phase === "GameOver") {
      const winner = this.session.getWinner() ?? "draw";
      this.finishGame(winner, "knockout");
    } else {
      this.startTurn();
    }
  }

  private resolveForcedSwitches(): void {
    const s1 = this.pendingSwitches.p1 ?? null;
    const s2 = this.pendingSwitches.p2 ?? null;

    const result = this.session.resolveForcedSwitches(s1, s2);

    this.emitTurnResult(result.nextState, result.events);

    if (this.session.isGameOver() || result.nextState.phase === "GameOver") {
      const winner = this.session.getWinner() ?? "draw";
      this.finishGame(winner, "knockout");
    } else {
      this.startTurn();
    }
  }

  private emitTurnResult(state: EngineBattleState, events: BattleEventData[]): void {
    // Send sanitized turn:result to each player
    for (const side of ["p1", "p2"] as PlayerSide[]) {
      const ownTeamData = side === "p1" ? state.p1Team : state.p2Team;
      const oppTeamData = side === "p1" ? state.p2Team : state.p1Team;
      const oppRevealedMoves = side === "p1" ? this.revealedMovesP2 : this.revealedMovesP1;

      const yourTeam = ownTeamData.pokemon.map(BattleSanitizer.toPlayerPokemon);
      const opponentPublic = BattleSanitizer.getOpponentPublicState(
        oppTeamData,
        oppRevealedMoves
      );

      this.callbacks.onTurnResult(side, {
        turnNumber: state.turnNumber,
        events,
        yourTeam,
        opponentPublic,
      });
    }
  }

  private onTurnTimeout(): void {
    if (this.isFinished) return;

    const state = this.session.getState();
    let timedOutSide: PlayerSide | null = null;

    if (state.phase === "ActionSelection") {
      if (!this.pendingActions.p1 && !this.pendingActions.p2) {
        timedOutSide = "p1";
      } else if (!this.pendingActions.p1) {
        timedOutSide = "p1";
      } else if (!this.pendingActions.p2) {
        timedOutSide = "p2";
      }
    } else if (state.phase.startsWith("ForcedSwitch")) {
      const needsP1 = state.phase === "ForcedSwitchP1" || state.phase === "ForcedSwitchBoth";
      const needsP2 = state.phase === "ForcedSwitchP2" || state.phase === "ForcedSwitchBoth";

      if (needsP1 && !this.pendingSwitches.p1) {
        timedOutSide = "p1";
      } else if (needsP2 && !this.pendingSwitches.p2) {
        timedOutSide = "p2";
      }
    }

    if (timedOutSide) {
      this.forfeitBattle(timedOutSide, "timeout");
    }
  }

  private finishGame(winner: "p1" | "p2" | "draw", reason: BattleEndReason): void {
    if (this.isFinished) return;

    this.clearAllTimers();
    this.isFinished = true;
    this.room.finishBattle();

    const record: BattleRecord = {
      id: this.battleId,
      roomId: this.roomId,
      seed: this.seed,
      p1Team: this.p1Team,
      p2Team: this.p2Team,
      turns: this.turnLogs,
      winner: winner === "draw" ? null : winner,
      endReason: reason,
      createdAt: this.room.createdAt,
      endedAt: this.clock.now(),
    };
    this.logStore.save(record);

    this.callbacks.onBattleEnd({
      winner,
      reason,
      replayLogId: this.battleId,
    });
  }

  private clearTurnTimer(): void {
    if (this.turnTimerHandle) {
      this.turnTimerHandle.cancel();
      this.turnTimerHandle = undefined;
    }
  }

  private clearAllTimers(): void {
    this.clearTurnTimer();
    this.disconnectTimerHandleP1?.cancel();
    this.disconnectTimerHandleP1 = undefined;
    this.disconnectTimerHandleP2?.cancel();
    this.disconnectTimerHandleP2 = undefined;
  }
}
