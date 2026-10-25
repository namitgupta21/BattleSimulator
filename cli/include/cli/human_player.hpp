#pragma once

#include <iostream>
#include "player.hpp"

namespace cli {

class HumanPlayer : public IPlayer {
public:
    explicit HumanPlayer(std::string playerName)
        : m_name(std::move(playerName)) {}

    engine::BattleAction chooseAction(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalActions
    ) override;

    engine::BattleAction chooseForcedSwitch(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalSwitches
    ) override;

private:
    std::string m_name;
};

} // namespace cli
