#include "engine/engine.hpp"
#include <algorithm>

namespace engine {

BattleEngine::BattleEngine()
    : m_typeChart(std::make_shared<Gen1TypeChart>()),
      m_damageCalc(std::make_shared<Gen1DamageCalculator>()),
      m_effectDispatcher(std::make_shared<MoveEffectDispatcher>()) {}

BattleEngine::BattleEngine(
    std::shared_ptr<const ITypeChart> typeChart,
    std::shared_ptr<const IDamageCalculator> damageCalc,
    std::shared_ptr<const MoveEffectDispatcher> effectDispatcher
) : m_typeChart(std::move(typeChart)),
    m_damageCalc(std::move(damageCalc)),
    m_effectDispatcher(std::move(effectDispatcher)) {}

std::vector<BattleAction> BattleEngine::getLegalActions(const BattleState& state, PlayerSide side) const {
    std::vector<BattleAction> actions;
    if (state.isGameOver()) return actions;

    const Team& team = state.getTeam(side);
    const PokemonInstance* active = team.getActivePokemon();
    if (!active || active->isFainted()) return actions;

    // Available moves with PP > 0
    const auto& moves = active->getMoves();
    for (size_t i = 0; i < moves.size(); ++i) {
        if (moves[i].hasPp()) {
            actions.push_back(BattleAction::makeMove(static_cast<int>(i)));
        }
    }

    // Available bench switches (alive, not current active)
    for (int benchIdx : team.getLegalSwitchIndices()) {
        actions.push_back(BattleAction::makeSwitch(benchIdx));
    }

    // Fallback: if all moves have 0 PP, in Gen 1 Struggle would be used.
    // For Phase 1 if no PP, allow move 0 as struggle or first available move.
    if (actions.empty() && !moves.empty()) {
        actions.push_back(BattleAction::makeMove(0));
    }

    return actions;
}

std::vector<BattleAction> BattleEngine::getLegalSwitches(const BattleState& state, PlayerSide side) const {
    std::vector<BattleAction> actions;
    const Team& team = state.getTeam(side);
    for (int benchIdx : team.getLegalSwitchIndices()) {
        actions.push_back(BattleAction::makeSwitch(benchIdx));
    }
    return actions;
}

std::pair<BattleEngine::TurnOrderEntry, BattleEngine::TurnOrderEntry>
BattleEngine::determineTurnOrder(
    const BattleState& state,
    const BattleAction& a1,
    const BattleAction& a2,
    IRandomGenerator& rng
) const {
    TurnOrderEntry e1{PlayerSide::Player1, a1, 0, 0};
    TurnOrderEntry e2{PlayerSide::Player2, a2, 0, 0};

    const PokemonInstance* p1 = state.getActivePokemon(PlayerSide::Player1);
    const PokemonInstance* p2 = state.getActivePokemon(PlayerSide::Player2);

    if (p1) e1.speed = p1->getEffectiveSpeed();
    if (p2) e2.speed = p2->getEffectiveSpeed();

    // Priority for Action 1
    if (a1.type == ActionType::Switch) {
        e1.priority = 6;
    } else if (p1 && a1.index >= 0 && a1.index < static_cast<int>(p1->getMoves().size())) {
        const auto* def = p1->getMoves()[a1.index].def;
        if (def) e1.priority = def->priority;
    }

    // Priority for Action 2
    if (a2.type == ActionType::Switch) {
        e2.priority = 6;
    } else if (p2 && a2.index >= 0 && a2.index < static_cast<int>(p2->getMoves().size())) {
        const auto* def = p2->getMoves()[a2.index].def;
        if (def) e2.priority = def->priority;
    }

    // Compare priorities
    if (e1.priority > e2.priority) {
        return {e1, e2};
    } else if (e1.priority < e2.priority) {
        return {e2, e1};
    }

    // Priority tied: compare speed
    if (e1.speed > e2.speed) {
        return {e1, e2};
    } else if (e1.speed < e2.speed) {
        return {e2, e1};
    }

    // Speed tied: 50/50 RNG tiebreaker
    bool p1First = (rng.nextInt(0, 1) == 0);
    return p1First ? std::make_pair(e1, e2) : std::make_pair(e2, e1);
}

void BattleEngine::executeSwitch(
    BattleState& state,
    PlayerSide side,
    int benchIdx,
    std::vector<BattleEvent>& events
) const {
    Team& team = state.getTeam(side);
    if (!team.switchTo(benchIdx)) return;

    const PokemonInstance* newActive = team.getActivePokemon();
    if (newActive) {
        events.push_back(BattleEvent::switchedIn(
            side,
            newActive->getName(),
            newActive->getCurrentHp(),
            newActive->getMaxHp()
        ));
    }
}

void BattleEngine::executeMove(
    BattleState& state,
    PlayerSide side,
    int moveIdx,
    std::vector<BattleEvent>& events,
    IRandomGenerator& rng
) const {
    PlayerSide oppSide = getOpposingSide(side);
    PokemonInstance* attacker = state.getActivePokemon(side);
    PokemonInstance* defender = state.getActivePokemon(oppSide);

    if (!attacker || attacker->isFainted()) return;
    if (!defender || defender->isFainted()) return;

    if (moveIdx < 0 || moveIdx >= static_cast<int>(attacker->getMoves().size())) return;
    MoveInstance& moveInst = attacker->getMoves()[moveIdx];
    const MoveDefinition* moveDef = moveInst.def;
    if (!moveDef) return;

    // Check status conditions that prevent actions
    StatusEffect st = attacker->getStatus();
    if (st == StatusEffect::Freeze) {
        events.push_back(BattleEvent::statusBlocked(
            side, attacker->getName(), StatusEffect::Freeze, "is frozen solid!"
        ));
        return;
    }

    if (st == StatusEffect::Sleep) {
        attacker->decrementSleepTurns();
        if (attacker->getSleepTurns() <= 0) {
            attacker->clearStatus();
            events.push_back(BattleEvent::statusHealed(side, attacker->getName(), StatusEffect::Sleep));
            // Crucial Gen 1 faithful mechanic: Pokemon cannot move on the turn it wakes up!
            events.push_back(BattleEvent::statusBlocked(
                side, attacker->getName(), StatusEffect::Sleep, "woke up, but could not act this turn!"
            ));
            return;
        } else {
            events.push_back(BattleEvent::statusBlocked(
                side, attacker->getName(), StatusEffect::Sleep, "is fast asleep!"
            ));
            return;
        }
    }

    if (st == StatusEffect::Paralysis) {
        // 25% chance of full paralysis
        if (rng.nextInt(1, 100) <= 25) {
            events.push_back(BattleEvent::statusBlocked(
                side, attacker->getName(), StatusEffect::Paralysis, "is fully paralyzed!"
            ));
            return;
        }
    }

    // Deduct PP
    moveInst.deductPp();

    // Announce move
    events.push_back(BattleEvent::moveUsed(side, attacker->getName(), moveDef->name));

    // Calculate damage & hit
    DamageResult dmgResult = m_damageCalc->calculate(*attacker, *defender, *moveDef, *m_typeChart, rng);

    if (!dmgResult.hit) {
        events.push_back(BattleEvent::moveMissed(oppSide, defender->getName()));
        return;
    }

    if (dmgResult.isCritical) {
        events.push_back(BattleEvent::criticalHit(oppSide));
    }

    if (dmgResult.effectiveness != 1.0) {
        events.push_back(BattleEvent::effectiveness(oppSide, dmgResult.effectiveness));
    }

    if (dmgResult.effectiveness <= 0.0) {
        return; // Complete type immunity prevents effects
    }

    // Dispatch composable move effects
    EffectContext ctx{
        side, oppSide,
        *attacker, *defender,
        *moveDef, dmgResult,
        *m_typeChart, rng,
        events
    };

    for (const auto& effect : moveDef->effects) {
        m_effectDispatcher->dispatch(effect, ctx);
    }
}

void BattleEngine::executeAction(
    BattleState& state,
    PlayerSide side,
    const BattleAction& action,
    std::vector<BattleEvent>& events,
    IRandomGenerator& rng
) const {
    if (action.type == ActionType::Switch) {
        executeSwitch(state, side, action.index, events);
    } else {
        executeMove(state, side, action.index, events, rng);
    }
}

void BattleEngine::applyEndOfTurnStatus(
    BattleState& state,
    PlayerSide side,
    std::vector<BattleEvent>& events
) const {
    PokemonInstance* p = state.getActivePokemon(side);
    if (!p || p->isFainted()) return;

    StatusEffect st = p->getStatus();
    if (st == StatusEffect::Burn || st == StatusEffect::Poison) {
        int dmg = std::max(1, p->getMaxHp() / 16);
        p->takeDamage(dmg);

        events.push_back(BattleEvent::statusDamage(
            side, p->getName(), st, dmg, p->getCurrentHp(), p->getMaxHp()
        ));

        if (p->isFainted()) {
            events.push_back(BattleEvent::fainted(side, p->getName()));
        }
    }
}

void BattleEngine::updateBattlePhase(BattleState& state, std::vector<BattleEvent>& events) const {
    bool p1Alive = state.getTeam(PlayerSide::Player1).hasAlivePokemon();
    bool p2Alive = state.getTeam(PlayerSide::Player2).hasAlivePokemon();

    if (!p1Alive && !p2Alive) {
        state.phase = BattlePhase::GameOver;
        state.winner = std::nullopt; // Draw
        return;
    }

    if (!p1Alive) {
        state.phase = BattlePhase::GameOver;
        state.winner = PlayerSide::Player2;
        events.push_back(BattleEvent::battleEnded(PlayerSide::Player2));
        return;
    }

    if (!p2Alive) {
        state.phase = BattlePhase::GameOver;
        state.winner = PlayerSide::Player1;
        events.push_back(BattleEvent::battleEnded(PlayerSide::Player1));
        return;
    }

    const PokemonInstance* p1Active = state.getActivePokemon(PlayerSide::Player1);
    const PokemonInstance* p2Active = state.getActivePokemon(PlayerSide::Player2);

    bool p1Fainted = !p1Active || p1Active->isFainted();
    bool p2Fainted = !p2Active || p2Active->isFainted();

    if (p1Fainted && p2Fainted) {
        state.phase = BattlePhase::ForcedSwitchBoth;
    } else if (p1Fainted) {
        state.phase = BattlePhase::ForcedSwitchP1;
    } else if (p2Fainted) {
        state.phase = BattlePhase::ForcedSwitchP2;
    } else {
        state.phase = BattlePhase::ActionSelection;
        state.turnNumber++;
    }
}

StepResult BattleEngine::step(
    const BattleState& state,
    const BattleAction& actionP1,
    const BattleAction& actionP2,
    IRandomGenerator& rng
) const {
    StepResult result;
    result.nextState = state;

    if (result.nextState.isGameOver()) {
        return result;
    }

    result.events.push_back(BattleEvent::turnStarted(result.nextState.turnNumber));

    // Determine turn order
    auto [first, second] = determineTurnOrder(result.nextState, actionP1, actionP2, rng);

    // Execute first action
    executeAction(result.nextState, first.side, first.action, result.events, rng);

    // Execute second action if second pokemon is still able to act
    const PokemonInstance* secondActive = result.nextState.getActivePokemon(second.side);
    if (secondActive && !secondActive->isFainted()) {
        // If second action is a move, also verify opposing target exists
        PlayerSide targetSide = getOpposingSide(second.side);
        const PokemonInstance* targetActive = result.nextState.getActivePokemon(targetSide);
        if (second.action.type == ActionType::Switch || (targetActive && !targetActive->isFainted())) {
            executeAction(result.nextState, second.side, second.action, result.events, rng);
        }
    }

    // End-of-turn status damage (Burn, Poison)
    applyEndOfTurnStatus(result.nextState, PlayerSide::Player1, result.events);
    applyEndOfTurnStatus(result.nextState, PlayerSide::Player2, result.events);

    result.events.push_back(BattleEvent::turnEnded(result.nextState.turnNumber));

    // Update phase and check faints / game over
    updateBattlePhase(result.nextState, result.events);

    return result;
}

StepResult BattleEngine::resolveForcedSwitches(
    const BattleState& state,
    const std::optional<BattleAction>& p1Switch,
    const std::optional<BattleAction>& p2Switch,
    IRandomGenerator&
) const {
    StepResult result;
    result.nextState = state;

    if (result.nextState.phase == BattlePhase::ForcedSwitchP1 || result.nextState.phase == BattlePhase::ForcedSwitchBoth) {
        if (p1Switch && p1Switch->type == ActionType::Switch) {
            executeSwitch(result.nextState, PlayerSide::Player1, p1Switch->index, result.events);
        }
    }

    if (result.nextState.phase == BattlePhase::ForcedSwitchP2 || result.nextState.phase == BattlePhase::ForcedSwitchBoth) {
        if (p2Switch && p2Switch->type == ActionType::Switch) {
            executeSwitch(result.nextState, PlayerSide::Player2, p2Switch->index, result.events);
        }
    }

    updateBattlePhase(result.nextState, result.events);
    return result;
}

} // namespace engine
