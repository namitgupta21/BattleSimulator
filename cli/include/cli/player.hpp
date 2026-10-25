#pragma once

#include <vector>
#include "engine/types.hpp"
#include "engine/state.hpp"
#include "engine/action.hpp"

namespace cli {

/**
 * @brief Interface for player decision making (Strategy / DIP).
 * HumanPlayer and RandomPlayer implement this cleanly and interchangeably.
 */
class IPlayer {
public:
    virtual ~IPlayer() = default;

    virtual engine::BattleAction chooseAction(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalActions
    ) = 0;

    virtual engine::BattleAction chooseForcedSwitch(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalSwitches
    ) = 0;
};

} // namespace cli
