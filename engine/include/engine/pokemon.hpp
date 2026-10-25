#pragma once

#include <string>
#include <vector>
#include <algorithm>
#include "types.hpp"
#include "stats.hpp"
#include "move.hpp"

namespace engine {

struct SpeciesDefinition {
    std::string id;
    std::string name;
    std::vector<Type> types;
    Stats baseStats;
    std::vector<std::string> defaultMoves;
};

class PokemonInstance {
public:
    PokemonInstance() = default;

    PokemonInstance(const SpeciesDefinition& species, int level = 50)
        : m_speciesId(species.id),
          m_name(species.name),
          m_types(species.types),
          m_baseStats(species.baseStats),
          m_level(level) {
        recalculateMaxStats();
        m_currentHp = m_maxStats.hp;
    }

    void recalculateMaxStats() {
        m_maxStats.hp = StatCalculator::calculateHp(m_baseStats.hp, m_level);
        m_maxStats.attack = StatCalculator::calculateStat(m_baseStats.attack, m_level);
        m_maxStats.defense = StatCalculator::calculateStat(m_baseStats.defense, m_level);
        m_maxStats.special = StatCalculator::calculateStat(m_baseStats.special, m_level);
        m_maxStats.speed = StatCalculator::calculateStat(m_baseStats.speed, m_level);
    }

    const std::string& getSpeciesId() const { return m_speciesId; }
    const std::string& getName() const { return m_name; }
    int getLevel() const { return m_level; }
    const std::vector<Type>& getTypes() const { return m_types; }
    const Stats& getBaseStats() const { return m_baseStats; }
    const Stats& getMaxStats() const { return m_maxStats; }

    int getCurrentHp() const { return m_currentHp; }
    int getMaxHp() const { return m_maxStats.hp; }
    bool isFainted() const { return m_currentHp <= 0; }

    StatusEffect getStatus() const { return m_status; }
    int getSleepTurns() const { return m_sleepTurns; }

    const StatStages& getStatStages() const { return m_stages; }
    StatStages& getStatStages() { return m_stages; }

    const std::vector<MoveInstance>& getMoves() const { return m_moves; }
    std::vector<MoveInstance>& getMoves() { return m_moves; }

    void addMove(const MoveDefinition* def) {
        if (def && m_moves.size() < 4) {
            MoveInstance inst;
            inst.def = def;
            inst.maxPp = def->pp;
            inst.currentPp = def->pp;
            m_moves.push_back(inst);
        }
    }

    int takeDamage(int damage) {
        int applied = std::min(m_currentHp, std::max(0, damage));
        m_currentHp -= applied;
        return applied;
    }

    int heal(int amount) {
        int before = m_currentHp;
        m_currentHp = std::min(m_maxStats.hp, m_currentHp + std::max(0, amount));
        return m_currentHp - before;
    }

    bool applyStatus(StatusEffect st, int sleepDuration = 0) {
        if (m_status != StatusEffect::None) return false;
        m_status = st;
        if (st == StatusEffect::Sleep) {
            m_sleepTurns = sleepDuration;
        }
        return true;
    }

    void clearStatus() {
        m_status = StatusEffect::None;
        m_sleepTurns = 0;
    }

    void decrementSleepTurns() {
        if (m_sleepTurns > 0) m_sleepTurns--;
    }

    void resetStatStages() {
        m_stages.reset();
    }

    /// Effective in-battle stats with stat stages and status conditions applied
    int getEffectiveAttack() const {
        return StatCalculator::getEffectiveStat(m_maxStats.attack, m_stages.attack, m_status, StatType::Attack);
    }

    int getEffectiveDefense() const {
        return StatCalculator::getEffectiveStat(m_maxStats.defense, m_stages.defense, m_status, StatType::Defense);
    }

    int getEffectiveSpecial() const {
        return StatCalculator::getEffectiveStat(m_maxStats.special, m_stages.special, m_status, StatType::Special);
    }

    int getEffectiveSpeed() const {
        return StatCalculator::getEffectiveStat(m_maxStats.speed, m_stages.speed, m_status, StatType::Speed);
    }

    // Direct mutators for serialization / restoration
    void setHp(int hp) { m_currentHp = std::clamp(hp, 0, m_maxStats.hp); }
    void setStatus(StatusEffect st, int sleepTurns = 0) {
        m_status = st;
        m_sleepTurns = sleepTurns;
    }

private:
    std::string m_speciesId;
    std::string m_name;
    std::vector<Type> m_types;
    Stats m_baseStats;
    Stats m_maxStats;
    int m_level{50};
    int m_currentHp{0};
    StatusEffect m_status{StatusEffect::None};
    int m_sleepTurns{0};
    StatStages m_stages;
    std::vector<MoveInstance> m_moves;
};

} // namespace engine
