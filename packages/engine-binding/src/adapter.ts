import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Action, PlayerSide, BattleEventData } from "@pokemon/protocol";

const nodeRequire = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface EnginePokemonMember {
  speciesId: string;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  status: string;
  sleepTurns: number;
  statStages: {
    attack: number;
    defense: number;
    special: number;
    speed: number;
    accuracy: number;
    evasion: number;
  };
  moves: Array<{
    id: string;
    currentPp: number;
    maxPp: number;
  }>;
}

export interface EngineTeamData {
  activeIndex: number;
  pokemon: EnginePokemonMember[];
}

export interface EngineBattleState {
  turnNumber: number;
  phase: "ActionSelection" | "ForcedSwitchP1" | "ForcedSwitchP2" | "ForcedSwitchBoth" | "GameOver";
  winner: "Player1" | "Player2" | null;
  p1Team: EngineTeamData;
  p2Team: EngineTeamData;
}

export interface EngineStepResult {
  nextState: EngineBattleState;
  events: BattleEventData[];
}

export interface BattleSession {
  /**
   * The server owns the move clock. The engine created through the adapter
   * strictly has its timer disabled by contract.
   */
  readonly isEngineTimerEnabled: false;
  getState(): EngineBattleState;
  getLegalActions(side: PlayerSide): Action[];
  getLegalSwitches(side: PlayerSide): Action[];
  step(actionP1: Action, actionP2: Action): EngineStepResult;
  resolveForcedSwitches(
    p1Switch?: Action | null,
    p2Switch?: Action | null
  ): EngineStepResult;
  isGameOver(): boolean;
  getWinner(): PlayerSide | null;
}

export interface EngineAdapter {
  loadData(dataDir?: string): boolean;
  generateTeam(seed: number, teamSize: number, level?: number): EngineTeamData;
  createBattle(
    seed: number,
    p1Team: EngineTeamData,
    p2Team: EngineTeamData
  ): BattleSession;
}

interface NativeBinding {
  loadData(dir: string): boolean;
  generateTeam(seed: number, teamSize: number, level?: number): string;
  createBattle(seed: number, team1Json: string, team2Json: string): NativeBattleSessionWrap;
}

interface NativeBattleSessionWrap {
  getState(): string;
  getLegalActions(side: string): Array<{ type: "Move" | "Switch"; index: number }>;
  getLegalSwitches(side: string): Array<{ type: "Move" | "Switch"; index: number }>;
  step(
    action1: { type: string; index: number },
    action2: { type: string; index: number }
  ): { nextStateJson: string; eventsJson: string };
  resolveForcedSwitches(
    switch1: { type: string; index: number } | null,
    switch2: { type: string; index: number } | null
  ): { nextStateJson: string; eventsJson: string };
  isEngineTimerEnabled(): boolean;
  isGameOver(): boolean;
  getWinner(): "Player1" | "Player2" | null;
}

function findNativeBinding(): NativeBinding {
  const possiblePaths = [
    path.resolve(__dirname, "../../build/pokemon_engine_binding.node"),
    path.resolve(__dirname, "../build/pokemon_engine_binding.node"),
    path.resolve(__dirname, "../../../build/packages/engine-binding/pokemon_engine_binding.node"),
    path.resolve(process.cwd(), "packages/engine-binding/build/pokemon_engine_binding.node"),
    path.resolve(process.cwd(), "build/packages/engine-binding/pokemon_engine_binding.node"),
  ];

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate)) {
      return nodeRequire(candidate) as NativeBinding;
    }
  }

  throw new Error(
    `Failed to locate pokemon_engine_binding.node. Checked: ${possiblePaths.join(", ")}`
  );
}

function toNativeSide(side: PlayerSide): "Player1" | "Player2" {
  return side === "p2" ? "Player2" : "Player1";
}

function fromNativeSide(side: "Player1" | "Player2" | null): PlayerSide | null {
  if (!side) return null;
  return side === "Player2" ? "p2" : "p1";
}

function toNativeAction(act: Action): { type: "Move" | "Switch"; index: number } {
  return {
    type: act.type === "switch" ? "Switch" : "Move",
    index: act.index,
  };
}

function fromNativeAction(act: { type: "Move" | "Switch"; index: number }): Action {
  return {
    type: act.type === "Switch" ? "switch" : "move",
    index: act.index,
  };
}

function normalizeEvents(rawEvents: any[]): BattleEventData[] {
  return rawEvents.map((e) => ({
    type: e.type,
    side: e.side === "Player2" ? "p2" : "p1",
    pokemon: e.pokemon,
    move: e.move,
    intValue1: e.intValue1,
    intValue2: e.intValue2,
    doubleValue: e.doubleValue,
    status: e.status,
    message: e.message,
  }));
}

export class NativeBattleSession implements BattleSession {
  readonly isEngineTimerEnabled: false = false;

  constructor(private readonly nativeSession: NativeBattleSessionWrap) {}

  getState(): EngineBattleState {
    const raw = this.nativeSession.getState();
    return JSON.parse(raw) as EngineBattleState;
  }

  getLegalActions(side: PlayerSide): Action[] {
    const actions = this.nativeSession.getLegalActions(toNativeSide(side));
    return actions.map(fromNativeAction);
  }

  getLegalSwitches(side: PlayerSide): Action[] {
    const actions = this.nativeSession.getLegalSwitches(toNativeSide(side));
    return actions.map(fromNativeAction);
  }

  step(actionP1: Action, actionP2: Action): EngineStepResult {
    const res = this.nativeSession.step(
      toNativeAction(actionP1),
      toNativeAction(actionP2)
    );
    const nextState = JSON.parse(res.nextStateJson) as EngineBattleState;
    const rawEvents = JSON.parse(res.eventsJson) as any[];
    return {
      nextState,
      events: normalizeEvents(rawEvents),
    };
  }

  resolveForcedSwitches(
    p1Switch?: Action | null,
    p2Switch?: Action | null
  ): EngineStepResult {
    const res = this.nativeSession.resolveForcedSwitches(
      p1Switch ? toNativeAction(p1Switch) : null,
      p2Switch ? toNativeAction(p2Switch) : null
    );
    const nextState = JSON.parse(res.nextStateJson) as EngineBattleState;
    const rawEvents = JSON.parse(res.eventsJson) as any[];
    return {
      nextState,
      events: normalizeEvents(rawEvents),
    };
  }

  isGameOver(): boolean {
    return this.nativeSession.isGameOver();
  }

  getWinner(): PlayerSide | null {
    return fromNativeSide(this.nativeSession.getWinner());
  }
}

export class NativeEngineAdapter implements EngineAdapter {
  private readonly binding: NativeBinding;

  constructor(customBinding?: NativeBinding) {
    this.binding = customBinding ?? findNativeBinding();
  }

  loadData(dataDir?: string): boolean {
    let resolvedDir = dataDir;
    if (!resolvedDir) {
      const candidates = [
        path.resolve(process.cwd(), "data"),
        path.resolve(process.cwd(), "../../data"),
        path.resolve(__dirname, "../../../data"),
        path.resolve(__dirname, "../../data"),
      ];
      resolvedDir = candidates.find((c) => fs.existsSync(path.join(c, "pokemon.json"))) ?? "./data";
    }
    return this.binding.loadData(resolvedDir);
  }

  generateTeam(
    seed: number,
    teamSize: number,
    level: number = 50
  ): EngineTeamData {
    const jsonStr = this.binding.generateTeam(seed, teamSize, level);
    return JSON.parse(jsonStr) as EngineTeamData;
  }

  createBattle(
    seed: number,
    p1Team: EngineTeamData,
    p2Team: EngineTeamData
  ): BattleSession {
    // Contractually constructs a session with the engine timer strictly disabled.
    // Callers are not provided any option or parameter to enable an engine timer.
    const nativeSession = this.binding.createBattle(
      seed,
      JSON.stringify(p1Team),
      JSON.stringify(p2Team)
    );
    return new NativeBattleSession(nativeSession);
  }
}
