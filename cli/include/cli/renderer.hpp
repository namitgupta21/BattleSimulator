#pragma once

#include <vector>
#include <string>
#include "engine/events.hpp"
#include "engine/state.hpp"

namespace cli {

class Renderer {
public:
    static void renderEvents(const std::vector<engine::BattleEvent>& events);
    static void renderBattleState(const engine::BattleState& state);

private:
    static std::string formatHpBar(int current, int max, int width = 20);
    static std::string sidePrefix(engine::PlayerSide side);
};

} // namespace cli
