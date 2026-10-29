#include "cli/human_player.hpp"
#include <iostream>
#include <limits>
#include <sstream>

namespace cli {

engine::BattleAction HumanPlayer::chooseAction(
    const engine::BattleState& state,
    engine::PlayerSide side,
    const std::vector<engine::BattleAction>& legalActions
) {
    if (legalActions.empty()) {
        return engine::BattleAction::makeMove(0);
    }
    if (legalActions.size() == 1) {
        return legalActions[0];
    }

    const auto& team = state.getTeam(side);
    const auto* active = team.getActivePokemon();

    std::cout << "\n========================================\n";
    std::cout << "[" << m_name << "] Choose your action:\n";
    if (active) {
        std::cout << "Active: " << active->getName() 
                  << " (" << active->getCurrentHp() << "/" << active->getMaxHp() << " HP)";
        if (active->getStatus() != engine::StatusEffect::None) {
            std::cout << " [" << engine::statusToString(active->getStatus()) << "]";
        }
        std::cout << "\n";
    }

    for (size_t i = 0; i < legalActions.size(); ++i) {
        const auto& act = legalActions[i];
        std::cout << "  [" << (i + 1) << "] ";
        if (act.type == engine::ActionType::Move) {
            if (active && act.index < static_cast<int>(active->getMoves().size())) {
                const auto& m = active->getMoves()[act.index];
                std::cout << "Move: " << (m.def ? m.def->name : "Unknown")
                          << " (PP: " << m.currentPp << "/" << m.maxPp 
                          << ", " << engine::typeToString(m.def ? m.def->type : engine::Type::Normal)
                          << ", Pow: " << (m.def ? m.def->basePower : 0) << ")";
            }
        } else {
            const auto* benched = team.getPokemon(act.index);
            if (benched) {
                std::cout << "Switch to: " << benched->getName()
                          << " (" << benched->getCurrentHp() << "/" << benched->getMaxHp() << " HP)";
                if (benched->getStatus() != engine::StatusEffect::None) {
                    std::cout << " [" << engine::statusToString(benched->getStatus()) << "]";
                }
            }
        }
        std::cout << "\n";
    }

    while (true) {
        std::cout << "Enter selection (1-" << legalActions.size() << "): ";
        int choice = 0;
        if (std::cin >> choice) {
            if (choice >= 1 && choice <= static_cast<int>(legalActions.size())) {
                return legalActions[choice - 1];
            }
        } else {
            if (std::cin.eof()) {
                std::cout << "\n[EOF detected, selecting default action 1]\n";
                return legalActions[0];
            }
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        }
        std::cout << "Invalid choice. Please try again.\n";
    }
}

engine::BattleAction HumanPlayer::chooseForcedSwitch(
    const engine::BattleState& state,
    engine::PlayerSide side,
    const std::vector<engine::BattleAction>& legalSwitches
) {
    if (legalSwitches.empty()) {
        return engine::BattleAction::makeSwitch(0);
    }
    if (legalSwitches.size() == 1) {
        return legalSwitches[0];
    }

    const auto& team = state.getTeam(side);

    std::cout << "\n========================================\n";
    std::cout << "[" << m_name << "] Active Pokémon fainted! Choose replacement:\n";

    for (size_t i = 0; i < legalSwitches.size(); ++i) {
        const auto& act = legalSwitches[i];
        const auto* benched = team.getPokemon(act.index);
        std::cout << "  [" << (i + 1) << "] ";
        if (benched) {
            std::cout << benched->getName()
                      << " (" << benched->getCurrentHp() << "/" << benched->getMaxHp() << " HP)";
            if (benched->getStatus() != engine::StatusEffect::None) {
                std::cout << " [" << engine::statusToString(benched->getStatus()) << "]";
            }
        }
        std::cout << "\n";
    }

    while (true) {
        std::cout << "Enter selection (1-" << legalSwitches.size() << "): ";
        int choice = 0;
        if (std::cin >> choice) {
            if (choice >= 1 && choice <= static_cast<int>(legalSwitches.size())) {
                return legalSwitches[choice - 1];
            }
        } else {
            if (std::cin.eof()) {
                std::cout << "\n[EOF detected, selecting default switch 1]\n";
                return legalSwitches[0];
            }
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        }
        std::cout << "Invalid choice. Please try again.\n";
    }
}

} // namespace cli
