#include "engine/type_chart.hpp"

namespace engine {

Gen1TypeChart::Gen1TypeChart() {
    for (size_t i = 0; i < NUM_TYPES; ++i) {
        for (size_t j = 0; j < NUM_TYPES; ++j) {
            m_matrix[i][j] = 1.0;
        }
    }
    initializeDefaults();
}

void Gen1TypeChart::setEffectiveness(Type attackType, Type defenderType, double mult) {
    size_t a = static_cast<size_t>(attackType);
    size_t d = static_cast<size_t>(defenderType);
    if (a < NUM_TYPES && d < NUM_TYPES) {
        m_matrix[a][d] = mult;
    }
}

double Gen1TypeChart::getEffectiveness(Type attackType, Type defenderType) const {
    if (attackType == Type::None || defenderType == Type::None) return 1.0;
    size_t a = static_cast<size_t>(attackType);
    size_t d = static_cast<size_t>(defenderType);
    if (a < NUM_TYPES && d < NUM_TYPES) {
        return m_matrix[a][d];
    }
    return 1.0;
}

double Gen1TypeChart::getMultiplier(Type attackType, const std::vector<Type>& defenderTypes) const {
    double mult = 1.0;
    for (Type dt : defenderTypes) {
        mult *= getEffectiveness(attackType, dt);
    }
    return mult;
}

void Gen1TypeChart::initializeDefaults() {
    // Normal
    setEffectiveness(Type::Normal, Type::Rock, 0.5);
    setEffectiveness(Type::Normal, Type::Ghost, 0.0);

    // Fire
    setEffectiveness(Type::Fire, Type::Fire, 0.5);
    setEffectiveness(Type::Fire, Type::Water, 0.5);
    setEffectiveness(Type::Fire, Type::Grass, 2.0);
    setEffectiveness(Type::Fire, Type::Ice, 2.0);
    setEffectiveness(Type::Fire, Type::Bug, 2.0);
    setEffectiveness(Type::Fire, Type::Rock, 0.5);
    setEffectiveness(Type::Fire, Type::Dragon, 0.5);

    // Water
    setEffectiveness(Type::Water, Type::Fire, 2.0);
    setEffectiveness(Type::Water, Type::Water, 0.5);
    setEffectiveness(Type::Water, Type::Grass, 0.5);
    setEffectiveness(Type::Water, Type::Ground, 2.0);
    setEffectiveness(Type::Water, Type::Rock, 2.0);
    setEffectiveness(Type::Water, Type::Dragon, 0.5);

    // Grass
    setEffectiveness(Type::Grass, Type::Fire, 0.5);
    setEffectiveness(Type::Grass, Type::Water, 2.0);
    setEffectiveness(Type::Grass, Type::Grass, 0.5);
    setEffectiveness(Type::Grass, Type::Poison, 0.5);
    setEffectiveness(Type::Grass, Type::Ground, 2.0);
    setEffectiveness(Type::Grass, Type::Flying, 0.5);
    setEffectiveness(Type::Grass, Type::Bug, 0.5);
    setEffectiveness(Type::Grass, Type::Rock, 2.0);
    setEffectiveness(Type::Grass, Type::Dragon, 0.5);

    // Electric
    setEffectiveness(Type::Electric, Type::Water, 2.0);
    setEffectiveness(Type::Electric, Type::Grass, 0.5);
    setEffectiveness(Type::Electric, Type::Electric, 0.5);
    setEffectiveness(Type::Electric, Type::Ground, 0.0);
    setEffectiveness(Type::Electric, Type::Flying, 2.0);
    setEffectiveness(Type::Electric, Type::Dragon, 0.5);

    // Ice (Gen 1: Neutral vs Fire)
    setEffectiveness(Type::Ice, Type::Water, 0.5);
    setEffectiveness(Type::Ice, Type::Grass, 2.0);
    setEffectiveness(Type::Ice, Type::Ice, 0.5);
    setEffectiveness(Type::Ice, Type::Ground, 2.0);
    setEffectiveness(Type::Ice, Type::Flying, 2.0);
    setEffectiveness(Type::Ice, Type::Dragon, 2.0);

    // Fighting
    setEffectiveness(Type::Fighting, Type::Normal, 2.0);
    setEffectiveness(Type::Fighting, Type::Ice, 2.0);
    setEffectiveness(Type::Fighting, Type::Poison, 0.5);
    setEffectiveness(Type::Fighting, Type::Flying, 0.5);
    setEffectiveness(Type::Fighting, Type::Psychic, 0.5);
    setEffectiveness(Type::Fighting, Type::Bug, 0.5);
    setEffectiveness(Type::Fighting, Type::Rock, 2.0);
    setEffectiveness(Type::Fighting, Type::Ghost, 0.0);

    // Poison (Gen 1: 2x vs Bug)
    setEffectiveness(Type::Poison, Type::Grass, 2.0);
    setEffectiveness(Type::Poison, Type::Poison, 0.5);
    setEffectiveness(Type::Poison, Type::Ground, 0.5);
    setEffectiveness(Type::Poison, Type::Bug, 2.0);
    setEffectiveness(Type::Poison, Type::Rock, 0.5);
    setEffectiveness(Type::Poison, Type::Ghost, 0.5);

    // Ground
    setEffectiveness(Type::Ground, Type::Fire, 2.0);
    setEffectiveness(Type::Ground, Type::Grass, 0.5);
    setEffectiveness(Type::Ground, Type::Electric, 2.0);
    setEffectiveness(Type::Ground, Type::Poison, 2.0);
    setEffectiveness(Type::Ground, Type::Flying, 0.0);
    setEffectiveness(Type::Ground, Type::Bug, 0.5);
    setEffectiveness(Type::Ground, Type::Rock, 2.0);

    // Flying
    setEffectiveness(Type::Flying, Type::Grass, 2.0);
    setEffectiveness(Type::Flying, Type::Electric, 0.5);
    setEffectiveness(Type::Flying, Type::Fighting, 2.0);
    setEffectiveness(Type::Flying, Type::Bug, 2.0);
    setEffectiveness(Type::Flying, Type::Rock, 0.5);

    // Psychic
    setEffectiveness(Type::Psychic, Type::Fighting, 2.0);
    setEffectiveness(Type::Psychic, Type::Poison, 2.0);
    setEffectiveness(Type::Psychic, Type::Psychic, 0.5);

    // Bug (Gen 1: 2x vs Poison)
    setEffectiveness(Type::Bug, Type::Fire, 0.5);
    setEffectiveness(Type::Bug, Type::Grass, 2.0);
    setEffectiveness(Type::Bug, Type::Fighting, 0.5);
    setEffectiveness(Type::Bug, Type::Poison, 2.0);
    setEffectiveness(Type::Bug, Type::Flying, 0.5);
    setEffectiveness(Type::Bug, Type::Psychic, 2.0);
    setEffectiveness(Type::Bug, Type::Ghost, 0.5);

    // Rock
    setEffectiveness(Type::Rock, Type::Fire, 2.0);
    setEffectiveness(Type::Rock, Type::Ice, 2.0);
    setEffectiveness(Type::Rock, Type::Fighting, 0.5);
    setEffectiveness(Type::Rock, Type::Ground, 0.5);
    setEffectiveness(Type::Rock, Type::Flying, 2.0);
    setEffectiveness(Type::Rock, Type::Bug, 2.0);

    // Ghost (Gen 1: Ghost does 0x to Psychic!)
    setEffectiveness(Type::Ghost, Type::Normal, 0.0);
    setEffectiveness(Type::Ghost, Type::Psychic, 0.0);
    setEffectiveness(Type::Ghost, Type::Ghost, 2.0);

    // Dragon
    setEffectiveness(Type::Dragon, Type::Dragon, 2.0);
}

} // namespace engine
