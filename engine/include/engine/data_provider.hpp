#pragma once

#include <string>
#include <vector>
#include <memory>
#include "pokemon.hpp"
#include "move.hpp"
#include "type_chart.hpp"

namespace engine {

/**
 * @brief Abstract DataProvider interface for decoupling data sources from engine mechanics.
 */
class IDataProvider {
public:
    virtual ~IDataProvider() = default;

    virtual const SpeciesDefinition* getSpecies(const std::string& id) const = 0;
    virtual const MoveDefinition* getMove(const std::string& id) const = 0;
    virtual std::shared_ptr<const ITypeChart> getTypeChart() const = 0;

    virtual std::vector<std::string> getAllSpeciesIds() const = 0;
    virtual std::vector<std::string> getAllMoveIds() const = 0;

    virtual PokemonInstance createPokemon(const std::string& speciesId, int level = 50) const = 0;
};

} // namespace engine

