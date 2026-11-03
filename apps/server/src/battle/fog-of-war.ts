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

  /**
   * Transforms an opponent's full team data into a sanitized public view.
   * Strips: exact HP numbers, unrevealed moves, and all bench details.
   */
  static getOpponentPublicState(
    team: EngineTeamData,
    revealedMoves: Set<string>
  ): OpponentPublicState {
    const totalTeamSize = team.pokemon.length;
    const aliveCount = team.pokemon.filter((p) => p.currentHp > 0).length;
    const faintedCount = totalTeamSize - aliveCount;

    const activeMember = team.pokemon[team.activeIndex];
    let active: OpponentPublicPokemon | null = null;

    if (activeMember && activeMember.currentHp > 0) {
      const hpPercent = Math.max(
        0,
        Math.min(100, Math.ceil((activeMember.currentHp / activeMember.maxHp) * 100))
      );

      active = {
        speciesId: activeMember.speciesId,
        name: activeMember.name,
        level: activeMember.level,
        types: [],
        hpPercent,
        status: activeMember.status as StatusEffect,
        statStages: { ...activeMember.statStages },
        revealedMoves: Array.from(revealedMoves),
      };
    }

    return {
      active,
      totalTeamSize,
      aliveCount,
      faintedCount,
    };
  }
}
