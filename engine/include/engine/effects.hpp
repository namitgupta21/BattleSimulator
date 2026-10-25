#pragma once

#include <vector>
#include <memory>
#include <unordered_map>
#include "types.hpp"
#include "pokemon.hpp"
#include "move.hpp"
#include "damage_calc.hpp"
#include "events.hpp"
#include "rng.hpp"
#include "type_chart.hpp"

namespace engine {

struct EffectContext {
    PlayerSide attackerSide;
    PlayerSide defenderSide;
    PokemonInstance& attacker;
    PokemonInstance& defender;
    const MoveDefinition& move;
    const DamageResult& damageResult;
    const ITypeChart& typeChart;
    IRandomGenerator& rng;
    std::vector<BattleEvent>& eventLog;
};

/**
 * @brief Strategy pattern interface for move effects (OCP / SRP).
 */
class IMoveEffectHandler {
public:
    virtual ~IMoveEffectHandler() = default;
    virtual EffectType getType() const = 0;
    virtual void execute(const MoveEffect& effect, EffectContext& ctx) = 0;
};

class MoveEffectDispatcher {
public:
    MoveEffectDispatcher();

    void registerHandler(std::unique_ptr<IMoveEffectHandler> handler);
    void dispatch(const MoveEffect& effect, EffectContext& ctx) const;

private:
    std::unordered_map<int, std::unique_ptr<IMoveEffectHandler>> m_handlers;
};

} // namespace engine
