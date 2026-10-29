#pragma once

#include "data_provider.hpp"
#include "local_json_provider.hpp"

namespace engine {

/**
 * @brief Singleton registry for backwards-compatibility wrapping LocalJsonProvider.
 */
class GameDataRegistry : public LocalJsonProvider {
public:
    static GameDataRegistry& instance();

private:
    GameDataRegistry() = default;
};

} // namespace engine
