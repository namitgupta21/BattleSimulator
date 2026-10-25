#include "cli/renderer.hpp"
#include <iostream>
#include <algorithm>

namespace cli {

std::string Renderer::sidePrefix(engine::PlayerSide side) {
    return (side == engine::PlayerSide::Player1) ? "[P1] " : "[P2] ";
}

std::string Renderer::formatHpBar(int current, int max, int width) {
    if (max <= 0) max = 1;
    current = std::clamp(current, 0, max);
    int filled = (current * width) / max;
    int empty = width - filled;

    std::string bar = "[";
    for (int i = 0; i < filled; ++i) bar += "=";
    for (int i = 0; i < empty; ++i) bar += " ";
    bar += "]";
    return bar;
}

void Renderer::renderBattleState(const engine::BattleState& state) {
    const auto* p1 = state.getActivePokemon(engine::PlayerSide::Player1);
    const auto* p2 = state.getActivePokemon(engine::PlayerSide::Player2);

    std::cout << "\n------------------------------------------------------------\n";
    std::cout << " TURN " << state.turnNumber << "\n";
    std::cout << "------------------------------------------------------------\n";

    if (p2) {
        std::cout << "[P2] " << p2->getName() << " (Lv." << p2->getLevel() << ") ";
        if (p2->getStatus() != engine::StatusEffect::None) {
            std::cout << " [" << engine::statusToString(p2->getStatus()) << "] ";
        }
        std::cout << "\n     HP: " << formatHpBar(p2->getCurrentHp(), p2->getMaxHp())
                  << " " << p2->getCurrentHp() << "/" << p2->getMaxHp() << "\n\n";
    }

    if (p1) {
        std::cout << "[P1] " << p1->getName() << " (Lv." << p1->getLevel() << ") ";
        if (p1->getStatus() != engine::StatusEffect::None) {
            std::cout << " [" << engine::statusToString(p1->getStatus()) << "] ";
        }
        std::cout << "\n     HP: " << formatHpBar(p1->getCurrentHp(), p1->getMaxHp())
                  << " " << p1->getCurrentHp() << "/" << p1->getMaxHp() << "\n";
    }
    std::cout << "------------------------------------------------------------\n";
}

void Renderer::renderEvents(const std::vector<engine::BattleEvent>& events) {
    for (const auto& e : events) {
        switch (e.type) {
            case engine::EventType::TurnStarted:
                // Handled in state render or silent
                break;
            case engine::EventType::TurnEnded:
                break;
            case engine::EventType::MoveUsed:
                std::cout << sidePrefix(e.side) << e.pokemonName << " used " << e.moveName << "!\n";
                break;
            case engine::EventType::MoveMissed:
                std::cout << sidePrefix(e.side) << e.pokemonName << " avoided the attack!\n";
                break;
            case engine::EventType::CriticalHit:
                std::cout << "  * Critical hit! *\n";
                break;
            case engine::EventType::Effectiveness:
                if (e.doubleValue > 1.0) {
                    std::cout << "  It's super effective!\n";
                } else if (e.doubleValue == 0.0) {
                    std::cout << "  It doesn't affect the target...\n";
                } else if (e.doubleValue < 1.0) {
                    std::cout << "  It's not very effective...\n";
                }
                break;
            case engine::EventType::DamageDealt:
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName << " took " 
                          << e.intValue1 << " damage! (" << e.intValue2 << " HP remaining)\n";
                break;
            case engine::EventType::StatusApplied:
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName 
                          << " was inflicted with " << engine::statusToString(e.status) << "!\n";
                break;
            case engine::EventType::StatusDamage:
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName 
                          << " was hurt by " << engine::statusToString(e.status) 
                          << " for " << e.intValue1 << " damage!\n";
                break;
            case engine::EventType::StatusBlockedAction:
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName << " " << e.message << "\n";
                break;
            case engine::EventType::StatusHealed:
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName 
                          << " was cured of " << engine::statusToString(e.status) << "!\n";
                break;
            case engine::EventType::StatStageChanged: {
                std::string direction = (e.intValue1 > 0) ? "rose!" : "fell!";
                if (std::abs(e.intValue1) >= 2) {
                    direction = (e.intValue1 > 0) ? "rose sharply!" : "severely fell!";
                }
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName << "'s "
                          << engine::statTypeToString(e.stat) << " " << direction << "\n";
                break;
            }
            case engine::EventType::PokemonHealed:
                std::cout << "  " << sidePrefix(e.side) << e.pokemonName 
                          << " restored " << e.intValue1 << " HP!\n";
                break;
            case engine::EventType::Fainted:
                std::cout << sidePrefix(e.side) << e.pokemonName << " fainted!\n";
                break;
            case engine::EventType::SwitchedIn:
                std::cout << sidePrefix(e.side) << "Go! " << e.pokemonName << "!\n";
                break;
            case engine::EventType::BattleEnded:
                std::cout << "\n============================================================\n";
                std::cout << " BATTLE OVER! Winner: " 
                          << ((e.side == engine::PlayerSide::Player1) ? "PLAYER 1" : "PLAYER 2") 
                          << "!\n";
                std::cout << "============================================================\n\n";
                break;
        }
    }
}

} // namespace cli
