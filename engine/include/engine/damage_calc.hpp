#pragma once

#include "types.hpp"
#include "pokemon.hpp"
#include "move.hpp"
#include "type_chart.hpp"
#include "rng.hpp"

namespace engine {

struct DamageResult {
    int damage{0};
    bool isCritical{false};
    double effectiveness{1.0};
    bool isStab{false};
    bool hit{true};
};

class IDamageCalculator {
public:
    virtual ~IDamageCalculator() = default;

    virtual DamageResult calculate(
        const PokemonInstance& attacker,
        const PokemonInstance& defender,
        const MoveDefinition& move,
        const ITypeChart& typeChart,
        IRandomGenerator& rng
    ) const = 0;

    virtual bool checkAccuracy(
        const PokemonInstance& attacker,
        const PokemonInstance& defender,
        const MoveDefinition& move,
        IRandomGenerator& rng
    ) const = 0;

    virtual bool checkCritical(
        const PokemonInstance& attacker,
        const MoveDefinition& move,
        IRandomGenerator& rng
    ) const = 0;
};

class Gen1DamageCalculator : public IDamageCalculator {
public:
    DamageResult calculate(
        const PokemonInstance& attacker,
        const PokemonInstance& defender,
        const MoveDefinition& move,
        const ITypeChart& typeChart,
        IRandomGenerator& rng
    ) const override;

    bool checkAccuracy(
        const PokemonInstance& attacker,
        const PokemonInstance& defender,
        const MoveDefinition& move,
        IRandomGenerator& rng
    ) const override;

    bool checkCritical(
        const PokemonInstance& attacker,
        const MoveDefinition& move,
        IRandomGenerator& rng
    ) const override;
};

} // namespace engine
