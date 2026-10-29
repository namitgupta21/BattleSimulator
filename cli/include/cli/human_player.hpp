#pragma once

#include <iostream>
#include <string>
#include "player.hpp"

namespace cli {

class HumanPlayer : public IPlayer {
public:
    explicit HumanPlayer(std::string playerName, bool enableTimer = false, int timeoutSeconds = 90)
        : m_name(std::move(playerName)), m_enableTimer(enableTimer), m_timeoutSeconds(timeoutSeconds) {}

    const std::string& getName() const override { return m_name; }

    void setTimer(bool enable, int timeoutSeconds = 90) {
        m_enableTimer = enable;
        m_timeoutSeconds = timeoutSeconds;
    }

    bool isTimerEnabled() const { return m_enableTimer; }
    int getTimeoutSeconds() const { return m_timeoutSeconds; }

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
    std::string m_name;
    bool m_enableTimer{false};
    int m_timeoutSeconds{90};
};

} // namespace cli
