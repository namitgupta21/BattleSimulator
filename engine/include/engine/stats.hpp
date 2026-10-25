#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include "types.hpp"

namespace engine {

struct Stats {
    int hp{0};
    int attack{0};
    int defense{0};
    int special{0};
    int speed{0};
};

struct StatStages {
    int attack{0};
    int defense{0};
    int special{0};
    int speed{0};
    int accuracy{0};
    int evasion{0};

    void reset() {
        attack = 0;
        defense = 0;
        special = 0;
        speed = 0;
        accuracy = 0;
        evasion = 0;
    }

    int get(StatType type) const {
        switch (type) {
            case StatType::Attack: return attack;
            case StatType::Defense: return defense;
            case StatType::Special: return special;
            case StatType::Speed: return speed;
            case StatType::Accuracy: return accuracy;
            case StatType::Evasion: return evasion;
        }
        return 0;
    }

    /// Modifies a stage by delta, clamped to [-6, +6]. Returns the actual change applied.
    int modify(StatType type, int delta) {
        int* target = nullptr;
        switch (type) {
            case StatType::Attack: target = &attack; break;
            case StatType::Defense: target = &defense; break;
            case StatType::Special: target = &special; break;
            case StatType::Speed: target = &speed; break;
            case StatType::Accuracy: target = &accuracy; break;
            case StatType::Evasion: target = &evasion; break;
        }
        if (!target) return 0;
        int oldVal = *target;
        *target = std::clamp(*target + delta, -6, 6);
        return *target - oldVal;
    }
};

/**
 * @brief Gen 1 stat formulas and multiplier utilities.
 */
class StatCalculator {
public:
    static constexpr int DEFAULT_GEN1_DV = 15; // Max Gen 1 DV (0-15 scale)
    static constexpr int DEFAULT_STAT_EXP = 0;

    /// Calculates Gen 1 HP stat
    static int calculateHp(int base, int level = 50, int dv = DEFAULT_GEN1_DV, int statExp = DEFAULT_STAT_EXP) {
        int statExpBonus = (statExp > 0) ? static_cast<int>(std::floor(std::ceil(std::sqrt(statExp)) / 4.0)) : 0;
        int numerator = ((base + dv) * 2 + statExpBonus) * level;
        return (numerator / 100) + level + 10;
    }

    /// Calculates Gen 1 non-HP stat (Attack, Defense, Special, Speed)
    static int calculateStat(int base, int level = 50, int dv = DEFAULT_GEN1_DV, int statExp = DEFAULT_STAT_EXP) {
        int statExpBonus = (statExp > 0) ? static_cast<int>(std::floor(std::ceil(std::sqrt(statExp)) / 4.0)) : 0;
        int numerator = ((base + dv) * 2 + statExpBonus) * level;
        return (numerator / 100) + 5;
    }

    /// Returns the multiplier for a stat stage in [-6, +6]
    static double getStageMultiplier(int stage) {
        stage = std::clamp(stage, -6, 6);
        if (stage >= 0) {
            return (2.0 + stage) / 2.0;
        } else {
            return 2.0 / (2.0 - stage);
        }
    }

    /// Applies stage multiplier and Gen 1 status modifier to an effective stat
    static int getEffectiveStat(int rawStat, int stage, StatusEffect status, StatType type) {
        double mult = getStageMultiplier(stage);
        double effective = rawStat * mult;

        // Gen 1 Burn cuts Attack by 50%
        if (type == StatType::Attack && status == StatusEffect::Burn) {
            effective *= 0.5;
        }
        // Gen 1 Paralysis cuts Speed to 25% (quarter speed)
        if (type == StatType::Speed && status == StatusEffect::Paralysis) {
            effective *= 0.25;
        }

        return std::max(1, static_cast<int>(std::floor(effective)));
    }
};

} // namespace engine
