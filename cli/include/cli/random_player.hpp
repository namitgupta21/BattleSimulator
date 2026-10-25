#pragma once

#include "player.hpp"
#include "engine/rng.hpp"

namespace cli {

class RandomPlayer : public IPlayer {
public:
    explicit RandomPlayer(engine::IRandomGenerator& rng, std::string botName = "Bot")
        : m_rng(rng), m_name(std::move(botName)) {}

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

    const std::string& getName() const { return m_name; }

private:
    engine::IRandomGenerator& m_rng;
    std::string m_name;
};

} // namespace cli
