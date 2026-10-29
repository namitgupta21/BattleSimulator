#include "engine/data_loader.hpp"

namespace engine {

GameDataRegistry& GameDataRegistry::instance() {
    static GameDataRegistry registry;
    return registry;
}

} // namespace engine
