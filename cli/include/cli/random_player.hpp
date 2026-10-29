#pragma once

#include "player.hpp"
#include "engine/rng.hpp"

namespace cli {

class RandomPlayer : public IPlayer {
public:
    explicit RandomPlayer(engine::IRandomGenerator& rng, std::string botName = "Bot")
        : m_rng(rng), m_name(std::move(botName)) {}

    const std::string& getName() const override { return m_name; }

    std::optional<engine::BattleAction> chooseAction(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalActions
    ) override;

    std::optional<engine::BattleAction> chooseForcedSwitch(
        const engine::BattleState& state,
        engine::PlayerSide side,
        const std::vector<engine::BattleAction>& legalSwitches
    ) override;

private:
    engine::IRandomGenerator& m_rng;
    std::string m_name;
};

} // namespace cli
