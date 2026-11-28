import type {
  OpponentPublicPokemon,
  OpponentPublicState,
  PlayerPokemon,
  StatusEffect,
} from "@pokemon/protocol";
import type { EnginePokemonMember, EngineTeamData } from "@pokemon/engine-binding";

export class BattleSanitizer {
  /**
   * Sanitizes the full engine Pokémon member into a private PlayerPokemon object
   * for the player who owns it.
   */
  static toPlayerPokemon(member: EnginePokemonMember): PlayerPokemon {
    return {
      speciesId: member.speciesId,
      name: member.name,
      level: member.level,
      types: [],
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      status: member.status as StatusEffect,
      statStages: { ...member.statStages },
      moves: member.moves.map((m) => ({
        id: m.id,
        name: m.id,
        type: "",
        currentPp: m.currentPp,
        maxPp: m.maxPp,
        basePower: 0,
        accuracy: 100,
      })),
    };
  }

  private static toOpponentPublicPokemon(
    member: EnginePokemonMember,
    revealedMoves: Set<string> | Map<string, Set<string>>
  ): OpponentPublicPokemon {
    const hpPercent = Math.max(
      0,
      Math.min(100, Math.ceil((member.currentHp / member.maxHp) * 100))
    );

    let movesList: string[] = [];
    if (revealedMoves instanceof Map) {
      const pMoves = revealedMoves.get(member.name);
      movesList = pMoves ? Array.from(pMoves) : [];
    } else {
      movesList = Array.from(revealedMoves);
    }

    return {
      speciesId: member.speciesId,
      name: member.name,
      level: member.level,
      types: [],
      hpPercent,
      status: member.status as StatusEffect,
      statStages: { ...member.statStages },
      revealedMoves: movesList,
    };
  }

  /**
   * Transforms an opponent's full team data into a sanitized public view.
   * Strips: exact HP numbers, unrevealed moves, and all unrevealed bench details.
   */
  static getOpponentPublicState(
    team: EngineTeamData,
    revealedMoves: Set<string> | Map<string, Set<string>>,
    seenIndices?: ReadonlySet<number>
  ): OpponentPublicState {
    const totalTeamSize = team.pokemon.length;
    const aliveCount = team.pokemon.filter((p) => p.currentHp > 0).length;
    const faintedCount = totalTeamSize - aliveCount;

    const activeMember = team.pokemon[team.activeIndex];
    const active: OpponentPublicPokemon | null = activeMember
      ? BattleSanitizer.toOpponentPublicPokemon(activeMember, revealedMoves)
      : null;

    let revealedBench: OpponentPublicPokemon[] | undefined;
    if (seenIndices) {
      revealedBench = [];
      team.pokemon.forEach((member, idx) => {
        if (idx !== team.activeIndex && seenIndices.has(idx)) {
          revealedBench!.push(BattleSanitizer.toOpponentPublicPokemon(member, revealedMoves));
        }
      });
    }

    return {
      active,
      totalTeamSize,
      aliveCount,
      faintedCount,
      ...(revealedBench !== undefined ? { revealedBench } : {}),
    };
  }
}
