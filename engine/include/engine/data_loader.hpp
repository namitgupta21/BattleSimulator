#pragma once

#include <string>
#include <unordered_map>
#include <memory>
#include "types.hpp"
#include "pokemon.hpp"
#include "move.hpp"
#include "type_chart.hpp"

namespace engine {

/**
 * @brief Registry for data-driven game content (Species, Moves, Type chart).
 * Separates data persistence from battle calculation (Single Responsibility Principle).
 */
class GameDataRegistry {
public:
    static GameDataRegistry& instance();

    bool loadAll(const std::string& dataDirectory);
    bool loadPokemon(const std::string& filePath);
    bool loadMoves(const std::string& filePath);
    bool loadTypeChart(const std::string& filePath);

    const SpeciesDefinition* getSpecies(const std::string& id) const;
    const MoveDefinition* getMove(const std::string& id) const;
    std::shared_ptr<const ITypeChart> getTypeChart() const;

    const std::unordered_map<std::string, SpeciesDefinition>& getAllSpecies() const { return m_species; }
    const std::unordered_map<std::string, MoveDefinition>& getAllMoves() const { return m_moves; }

    PokemonInstance createPokemon(const std::string& speciesId, int level = 50) const;

private:
    GameDataRegistry();
    std::unordered_map<std::string, SpeciesDefinition> m_species;
    std::unordered_map<std::string, MoveDefinition> m_moves;
    std::shared_ptr<Gen1TypeChart> m_typeChart;
};

} // namespace engine
