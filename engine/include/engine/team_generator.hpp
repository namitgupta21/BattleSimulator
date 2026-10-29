#pragma once

#include "data_provider.hpp"
#include "team.hpp"
#include <cstdint>
#include <cstddef>

namespace engine {

/**
 * @brief Deterministic team generator for balanced Gen 1 competitive rosters.
 */
class TeamGenerator {
public:
    /**
     * @brief Generates a team of N distinct Pokémon, each with 4 moves (>=1 damaging move).
     * @param seed Seed for random generation.
     * @param teamSize Number of Pokémon to generate (up to available species count).
     * @param provider Data source implementing IDataProvider.
     * @param level Level for generated Pokémon (default: 50).
     */
    static Team generate(
        uint64_t seed,
        size_t teamSize,
        const IDataProvider& provider,
        int level = 50
    );
};

} // namespace engine

