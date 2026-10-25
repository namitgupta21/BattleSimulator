#pragma once

#include <vector>
#include <memory>
#include <optional>
#include "types.hpp"
#include "state.hpp"
#include "action.hpp"
#include "events.hpp"
#include "rng.hpp"
#include "type_chart.hpp"
#include "damage_calc.hpp"
#include "effects.hpp"

namespace engine {

struct StepResult {
    BattleState nextState;
    std::vector<BattleEvent> events;
};

/**
 * @brief Pure deterministic battle engine core.
 * Adheres to Dependency Inversion: damage calculation, type chart, and effect dispatcher are injected.
 */
class BattleEngine {
public:
    BattleEngine();
    BattleEngine(
        std::shared_ptr<const ITypeChart> typeChart,
        std::shared_ptr<const IDamageCalculator> damageCalc,
        std::shared_ptr<const MoveEffectDispatcher> effectDispatcher
    );

    /// Main turn resolution: step(state, actionP1, actionP2, rng) -> StepResult
    StepResult step(
        const BattleState& state,
        const BattleAction& actionP1,
        const BattleAction& actionP2,
        IRandomGenerator& rng
    ) const;

    /// Resolves forced switch-ins when active Pokémon faint
    StepResult resolveForcedSwitches(
        const BattleState& state,
        const std::optional<BattleAction>& p1Switch,
        const std::optional<BattleAction>& p2Switch,
        IRandomGenerator& rng
    ) const;

    /// Returns legal actions (moves with PP + alive bench switches) for a player side
    std::vector<BattleAction> getLegalActions(const BattleState& state, PlayerSide side) const;

    /// Returns legal bench switches for forced switch resolution
    std::vector<BattleAction> getLegalSwitches(const BattleState& state, PlayerSide side) const;

private:
    std::shared_ptr<const ITypeChart> m_typeChart;
    std::shared_ptr<const IDamageCalculator> m_damageCalc;
    std::shared_ptr<const MoveEffectDispatcher> m_effectDispatcher;

    struct TurnOrderEntry {
        PlayerSide side;
        BattleAction action;
        int priority{0};
        int speed{0};
    };

    std::pair<TurnOrderEntry, TurnOrderEntry> determineTurnOrder(
        const BattleState& state,
        const BattleAction& a1,
        const BattleAction& a2,
        IRandomGenerator& rng
    ) const;

    void executeAction(
        BattleState& state,
        PlayerSide side,
        const BattleAction& action,
        std::vector<BattleEvent>& events,
        IRandomGenerator& rng
    ) const;

    void executeMove(
        BattleState& state,
        PlayerSide side,
        int moveIdx,
        std::vector<BattleEvent>& events,
        IRandomGenerator& rng
    ) const;

    void executeSwitch(
        BattleState& state,
        PlayerSide side,
        int benchIdx,
        std::vector<BattleEvent>& events
    ) const;

    void applyEndOfTurnStatus(
        BattleState& state,
        PlayerSide side,
        std::vector<BattleEvent>& events
    ) const;

    void updateBattlePhase(BattleState& state, std::vector<BattleEvent>& events) const;
};

} // namespace engine
