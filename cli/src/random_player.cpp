#include "cli/random_player.hpp"

namespace cli {

std::optional<engine::BattleAction> RandomPlayer::chooseAction(
    const engine::BattleState&,
    engine::PlayerSide,
    const std::vector<engine::BattleAction>& legalActions
) {
    if (legalActions.empty()) {
        return engine::BattleAction::makeMove(0);
    }
    uint32_t idx = m_rng.nextInt(0, static_cast<uint32_t>(legalActions.size() - 1));
    return legalActions[idx];
}

std::optional<engine::BattleAction> RandomPlayer::chooseForcedSwitch(
    const engine::BattleState&,
    engine::PlayerSide,
    const std::vector<engine::BattleAction>& legalSwitches
) {
    if (legalSwitches.empty()) {
        return engine::BattleAction::makeSwitch(0);
    }
    uint32_t idx = m_rng.nextInt(0, static_cast<uint32_t>(legalSwitches.size() - 1));
    return legalSwitches[idx];
}

} // namespace cli
