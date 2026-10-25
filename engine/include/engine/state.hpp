#pragma once

#include <optional>
#include "types.hpp"
#include "team.hpp"
#include "action.hpp"

namespace engine {

enum class BattlePhase {
    ActionSelection,
    ForcedSwitchP1,
    ForcedSwitchP2,
    ForcedSwitchBoth,
    GameOver
};

inline std::string_view battlePhaseToString(BattlePhase phase) {
    switch (phase) {
        case BattlePhase::ActionSelection: return "ActionSelection";
        case BattlePhase::ForcedSwitchP1: return "ForcedSwitchP1";
        case BattlePhase::ForcedSwitchP2: return "ForcedSwitchP2";
        case BattlePhase::ForcedSwitchBoth: return "ForcedSwitchBoth";
        case BattlePhase::GameOver: return "GameOver";
    }
    return "Unknown";
}

struct BattleState {
    int turnNumber{1};
    Team p1Team;
    Team p2Team;
    BattlePhase phase{BattlePhase::ActionSelection};
    std::optional<PlayerSide> winner;

    const Team& getTeam(PlayerSide side) const {
        return (side == PlayerSide::Player1) ? p1Team : p2Team;
    }

    Team& getTeam(PlayerSide side) {
        return (side == PlayerSide::Player1) ? p1Team : p2Team;
    }

    const PokemonInstance* getActivePokemon(PlayerSide side) const {
        return getTeam(side).getActivePokemon();
    }

    PokemonInstance* getActivePokemon(PlayerSide side) {
        return getTeam(side).getActivePokemon();
    }

    bool isGameOver() const {
        return phase == BattlePhase::GameOver || winner.has_value();
    }
};

} // namespace engine
