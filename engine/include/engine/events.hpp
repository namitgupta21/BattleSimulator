#pragma once

#include <string>
#include <vector>
#include "types.hpp"

namespace engine {

enum class EventType {
    TurnStarted,
    TurnEnded,
    MoveUsed,
    MoveMissed,
    DamageDealt,
    CriticalHit,
    Effectiveness,
    StatusApplied,
    StatusDamage,
    StatusBlockedAction,
    StatusHealed,
    StatStageChanged,
    PokemonHealed,
    Fainted,
    SwitchedIn,
    BattleEnded
};

inline std::string_view eventTypeToString(EventType t) {
    switch (t) {
        case EventType::TurnStarted: return "TurnStarted";
        case EventType::TurnEnded: return "TurnEnded";
        case EventType::MoveUsed: return "MoveUsed";
        case EventType::MoveMissed: return "MoveMissed";
        case EventType::DamageDealt: return "DamageDealt";
        case EventType::CriticalHit: return "CriticalHit";
        case EventType::Effectiveness: return "Effectiveness";
        case EventType::StatusApplied: return "StatusApplied";
        case EventType::StatusDamage: return "StatusDamage";
        case EventType::StatusBlockedAction: return "StatusBlockedAction";
        case EventType::StatusHealed: return "StatusHealed";
        case EventType::StatStageChanged: return "StatStageChanged";
        case EventType::PokemonHealed: return "PokemonHealed";
        case EventType::Fainted: return "Fainted";
        case EventType::SwitchedIn: return "SwitchedIn";
        case EventType::BattleEnded: return "BattleEnded";
    }
    return "Unknown";
}

struct BattleEvent {
    EventType type;
    PlayerSide side{PlayerSide::Player1};
    std::string pokemonName;
    std::string moveName;
    int intValue1{0};           // damage, stage change, turn number, currentHp
    int intValue2{0};           // maxHp, newStage
    double doubleValue{1.0};    // effectiveness multiplier
    StatusEffect status{StatusEffect::None};
    StatType stat{StatType::Attack};
    std::string message;

    // Factory helper methods for clean, expressive event emission
    static BattleEvent turnStarted(int turn) {
        BattleEvent e;
        e.type = EventType::TurnStarted;
        e.intValue1 = turn;
        return e;
    }

    static BattleEvent turnEnded(int turn) {
        BattleEvent e;
        e.type = EventType::TurnEnded;
        e.intValue1 = turn;
        return e;
    }

    static BattleEvent moveUsed(PlayerSide side, const std::string& pokemon, const std::string& move) {
        BattleEvent e;
        e.type = EventType::MoveUsed;
        e.side = side;
        e.pokemonName = pokemon;
        e.moveName = move;
        return e;
    }

    static BattleEvent moveMissed(PlayerSide targetSide, const std::string& pokemon) {
        BattleEvent e;
        e.type = EventType::MoveMissed;
        e.side = targetSide;
        e.pokemonName = pokemon;
        return e;
    }

    static BattleEvent damageDealt(PlayerSide targetSide, const std::string& pokemon, int dmg, int curHp, int maxHp) {
        BattleEvent e;
        e.type = EventType::DamageDealt;
        e.side = targetSide;
        e.pokemonName = pokemon;
        e.intValue1 = dmg;
        e.intValue2 = curHp;
        return e;
    }

    static BattleEvent criticalHit(PlayerSide targetSide) {
        BattleEvent e;
        e.type = EventType::CriticalHit;
        e.side = targetSide;
        return e;
    }

    static BattleEvent effectiveness(PlayerSide targetSide, double multiplier) {
        BattleEvent e;
        e.type = EventType::Effectiveness;
        e.side = targetSide;
        e.doubleValue = multiplier;
        return e;
    }

    static BattleEvent statusApplied(PlayerSide targetSide, const std::string& pokemon, StatusEffect st) {
        BattleEvent e;
        e.type = EventType::StatusApplied;
        e.side = targetSide;
        e.pokemonName = pokemon;
        e.status = st;
        return e;
    }

    static BattleEvent statusDamage(PlayerSide targetSide, const std::string& pokemon, StatusEffect st, int dmg, int curHp, int maxHp) {
        BattleEvent e;
        e.type = EventType::StatusDamage;
        e.side = targetSide;
        e.pokemonName = pokemon;
        e.status = st;
        e.intValue1 = dmg;
        e.intValue2 = curHp;
        return e;
    }

    static BattleEvent statusBlocked(PlayerSide side, const std::string& pokemon, StatusEffect st, const std::string& reason) {
        BattleEvent e;
        e.type = EventType::StatusBlockedAction;
        e.side = side;
        e.pokemonName = pokemon;
        e.status = st;
        e.message = reason;
        return e;
    }

    static BattleEvent statusHealed(PlayerSide targetSide, const std::string& pokemon, StatusEffect st) {
        BattleEvent e;
        e.type = EventType::StatusHealed;
        e.side = targetSide;
        e.pokemonName = pokemon;
        e.status = st;
        return e;
    }

    static BattleEvent statStageChanged(PlayerSide targetSide, const std::string& pokemon, StatType stat, int delta, int newStage) {
        BattleEvent e;
        e.type = EventType::StatStageChanged;
        e.side = targetSide;
        e.pokemonName = pokemon;
        e.stat = stat;
        e.intValue1 = delta;
        e.intValue2 = newStage;
        return e;
    }

    static BattleEvent pokemonHealed(PlayerSide targetSide, const std::string& pokemon, int healed, int curHp, int maxHp) {
        BattleEvent e;
        e.type = EventType::PokemonHealed;
        e.side = targetSide;
        e.pokemonName = pokemon;
        e.intValue1 = healed;
        e.intValue2 = curHp;
        return e;
    }

    static BattleEvent fainted(PlayerSide side, const std::string& pokemon) {
        BattleEvent e;
        e.type = EventType::Fainted;
        e.side = side;
        e.pokemonName = pokemon;
        return e;
    }

    static BattleEvent switchedIn(PlayerSide side, const std::string& pokemon, int curHp, int maxHp) {
        BattleEvent e;
        e.type = EventType::SwitchedIn;
        e.side = side;
        e.pokemonName = pokemon;
        e.intValue1 = curHp;
        e.intValue2 = maxHp;
        return e;
    }

    static BattleEvent battleEnded(PlayerSide winner) {
        BattleEvent e;
        e.type = EventType::BattleEnded;
        e.side = winner;
        return e;
    }
};

} // namespace engine
