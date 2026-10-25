#pragma once

#include "types.hpp"

namespace engine {

enum class ActionType {
    Move,
    Switch
};

struct BattleAction {
    ActionType type{ActionType::Move};
    int index{0}; // Move slot index (0..3) or Bench Pokémon index (0..5)

    static BattleAction makeMove(int moveIdx) {
        return BattleAction{ActionType::Move, moveIdx};
    }

    static BattleAction makeSwitch(int teamIdx) {
        return BattleAction{ActionType::Switch, teamIdx};
    }

    bool operator==(const BattleAction& other) const {
        return type == other.type && index == other.index;
    }

    bool operator!=(const BattleAction& other) const {
        return !(*this == other);
    }
};

} // namespace engine
