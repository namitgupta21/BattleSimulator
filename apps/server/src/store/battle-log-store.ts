import type { BattleEndReason, PlayerSide } from "@pokemon/protocol";
import type { EngineTeamData } from "@pokemon/engine-binding";

export interface TurnLogEntry {
  turnNumber: number;
  actions: {
    p1?: { type: string; index: number };
    p2?: { type: string; index: number };
  };
  events: any[];
}

export interface BattleRecord {
  id: string;
  roomId: string;
  seed: number;
  p1Team: EngineTeamData;
  p2Team: EngineTeamData;
  turns: TurnLogEntry[];
  winner: PlayerSide | null;
  endReason: BattleEndReason;
  createdAt: number;
  endedAt?: number;
}

export interface BattleLogStore {
  save(record: BattleRecord): Promise<void> | void;
  get(id: string): Promise<BattleRecord | null> | (BattleRecord | null);
}

export class InMemoryBattleLogStore implements BattleLogStore {
  private records = new Map<string, BattleRecord>();

  save(record: BattleRecord): void {
    this.records.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  get(id: string): BattleRecord | null {
    const record = this.records.get(id);
    return record ? JSON.parse(JSON.stringify(record)) : null;
  }
}
