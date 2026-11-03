#pragma once

#include <vector>
#include <string>
#include <optional>
#include "engine/types.hpp"
#include "engine/state.hpp"
#include "engine/action.hpp"

namespace cli {

/**
 * @brief Interface for player decision making (Strategy / DIP).
 * HumanPlayer and RandomPlayer implement this cleanly and interchangeably.
 * Returns std::nullopt if the player times out or forfeits.
 */
class IPlayer {
public:
    virtual ~IPlayer() = default;

    virtual const std::string& getName() const = 0;

    virtual std::optional<engine::BattleAction> chooseAction(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalActions
    ) = 0;

    virtual std::optional<engine::BattleAction> chooseForcedSwitch(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalSwitches
    ) = 0;
};

} // namespace cli
