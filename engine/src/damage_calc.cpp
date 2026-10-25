#include "engine/damage_calc.hpp"
#include <algorithm>
#include <cmath>

namespace engine {

bool Gen1DamageCalculator::checkAccuracy(
    const PokemonInstance& attacker,
    const PokemonInstance& defender,
    const MoveDefinition& move,
    IRandomGenerator& rng
) const {
    if (move.accuracy <= 0) return true; // Moves that never miss

    int accStage = attacker.getStatStages().accuracy;
    int evaStage = defender.getStatStages().evasion;
    int netStage = std::clamp(accStage - evaStage, -6, 6);

    double stageMultiplier = 1.0;
    if (netStage >= 0) {
        stageMultiplier = (3.0 + netStage) / 3.0;
    } else {
        stageMultiplier = 3.0 / (3.0 - netStage);
    }

    int hitChance = static_cast<int>(std::floor(move.accuracy * stageMultiplier));
    hitChance = std::clamp(hitChance, 1, 100);

    return rng.nextInt(1, 100) <= static_cast<uint32_t>(hitChance);
}

bool Gen1DamageCalculator::checkCritical(
    const PokemonInstance& attacker,
    const MoveDefinition& move,
    IRandomGenerator& rng
) const {
    int baseSpeed = attacker.getBaseStats().speed;
    int threshold = 0;

    if (move.highCrit) {
        // High-crit moves: threshold = min(255, 4 * BaseSpeed)
        threshold = std::min(255, baseSpeed * 4);
    } else {
        // Normal moves: threshold = floor(BaseSpeed / 2)
        threshold = baseSpeed / 2;
    }

    threshold = std::clamp(threshold, 1, 255);
    uint32_t roll = rng.nextInt(0, 255);
    return roll < static_cast<uint32_t>(threshold);
}

DamageResult Gen1DamageCalculator::calculate(
    const PokemonInstance& attacker,
    const PokemonInstance& defender,
    const MoveDefinition& move,
    const ITypeChart& typeChart,
    IRandomGenerator& rng
) const {
    DamageResult result;

    // Check accuracy first
    if (!checkAccuracy(attacker, defender, move, rng)) {
        result.hit = false;
        return result;
    }

    // Check type effectiveness
    result.effectiveness = typeChart.getMultiplier(move.type, defender.getTypes());
    if (result.effectiveness <= 0.0) {
        result.damage = 0;
        return result;
    }

    // Check special move types (e.g. Seismic Toss, Night Shade)
    for (const auto& effect : move.effects) {
        if (effect.type == EffectType::SetDamageLevel) {
            result.damage = attacker.getLevel();
            return result;
        }
    }

    // Status-only moves don't deal base damage
    if (move.category == MoveCategory::Status || move.basePower <= 0) {
        result.damage = 0;
        return result;
    }

    // Check critical hit
    result.isCritical = checkCritical(attacker, move, rng);

    // Gen 1 mechanics: Crits double attacker level and ignore stat stages & burn
    int level = attacker.getLevel();
    int attackStat = 0;
    int defenseStat = 0;

    bool isPhysical = (move.category == MoveCategory::Physical);

    if (result.isCritical) {
        level *= 2;
        // Ignore stat stages and status drops
        attackStat = isPhysical ? attacker.getMaxStats().attack : attacker.getMaxStats().special;
        defenseStat = isPhysical ? defender.getMaxStats().defense : defender.getMaxStats().special;
    } else {
        // Apply stat stages and status modifications
        attackStat = isPhysical ? attacker.getEffectiveAttack() : attacker.getEffectiveSpecial();
        defenseStat = isPhysical ? defender.getEffectiveDefense() : defender.getEffectiveSpecial();
    }

    attackStat = std::max(1, attackStat);
    defenseStat = std::max(1, defenseStat);

    // Gen 1 Base Damage formula:
    // LevelFactor = floor(2 * Level / 5) + 2
    // BaseDamage = floor(floor(LevelFactor * Power * A / D) / 50) + 2
    int levelFactor = (2 * level) / 5 + 2;
    int baseDmg = ((levelFactor * move.basePower * attackStat / defenseStat) / 50) + 2;

    // STAB (Same-Type Attack Bonus): 1.5x (floor(baseDmg * 1.5))
    bool hasStab = false;
    for (Type t : attacker.getTypes()) {
        if (t == move.type) {
            hasStab = true;
            break;
        }
    }
    result.isStab = hasStab;
    int damage = baseDmg;
    if (hasStab) {
        damage = damage + (damage / 2);
    }

    // Apply Type Effectiveness
    damage = static_cast<int>(std::floor(damage * result.effectiveness));
    if (damage <= 0) {
        result.damage = 0;
        return result;
    }

    // Gen 1 Random Damage Roll: floor(damage * R / 255) where R in [217, 255]
    if (damage > 1) {
        uint32_t r = rng.nextInt(217, 255);
        damage = (damage * r) / 255;
    }

    result.damage = std::max(1, damage);
    return result;
}

} // namespace engine
