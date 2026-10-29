#pragma once

#include "data_provider.hpp"
#include <unordered_map>
#include <vector>

namespace engine {

/**
 * @brief Concrete DataProvider loading species, moves, and type charts from local JSON files.
 */
class LocalJsonProvider : public IDataProvider {
public:
    LocalJsonProvider();
    ~LocalJsonProvider() override = default;

    bool loadAll(const std::string& dataDirectory);
    bool loadPokemon(const std::string& filePath);
    bool loadMoves(const std::string& filePath);
    bool loadTypeChart(const std::string& filePath);

    const SpeciesDefinition* getSpecies(const std::string& id) const override;
    const MoveDefinition* getMove(const std::string& id) const override;
    std::shared_ptr<const ITypeChart> getTypeChart() const override;

    std::vector<std::string> getAllSpeciesIds() const override;
    std::vector<std::string> getAllMoveIds() const override;

    PokemonInstance createPokemon(const std::string& speciesId, int level = 50) const override;

    const std::unordered_map<std::string, SpeciesDefinition>& getAllSpecies() const { return m_species; }
    const std::unordered_map<std::string, MoveDefinition>& getAllMoves() const { return m_moves; }

protected:
    std::unordered_map<std::string, SpeciesDefinition> m_species;
    std::unordered_map<std::string, MoveDefinition> m_moves;
    std::shared_ptr<Gen1TypeChart> m_typeChart;
};

} // namespace engine

