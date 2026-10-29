#pragma once

#include <string>
#include <vector>
#include "state.hpp"
#include "events.hpp"
#include "data_provider.hpp"
#include "data_loader.hpp"

namespace engine {

class BattleSerializer {
public:
    static std::string stateToJson(const BattleState& state);
    static BattleState jsonToState(const std::string& jsonStr, const IDataProvider& registry = GameDataRegistry::instance());

    static std::string eventsToJson(const std::vector<BattleEvent>& events);
    static std::vector<BattleEvent> jsonToEvents(const std::string& jsonStr);

    static std::string pokemonToJson(const PokemonInstance& pokemon);
    static PokemonInstance jsonToPokemon(const std::string& jsonStr, const IDataProvider& registry = GameDataRegistry::instance());
};

} // namespace engine
