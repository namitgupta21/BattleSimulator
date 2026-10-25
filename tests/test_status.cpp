#include <gtest/gtest.h>
#include "engine/engine.hpp"
#include "engine/stats.hpp"

using namespace engine;

class StatusTest : public ::testing::Test {
protected:
    BattleEngine engine;
};

TEST_F(StatusTest, BurnCutsAttackAndDealsTurnEndDamage) {
    SpeciesDefinition sp;
    sp.id = "tauros";
    sp.name = "Tauros";
    sp.types = {Type::Normal};
    sp.baseStats = {75, 100, 95, 70, 110};

    PokemonInstance tauros(sp, 50);
    int rawAtk = tauros.getEffectiveAttack();

    tauros.applyStatus(StatusEffect::Burn);
    int burnAtk = tauros.getEffectiveAttack();

    // Gen 1 Burn halves effective attack
    EXPECT_EQ(burnAtk, rawAtk / 2);

    BattleState state;
    state.p1Team.addPokemon(tauros);
    state.p2Team.addPokemon(tauros);

    int startHp = tauros.getCurrentHp();
    MersenneTwisterRNG rng(42);
    StepResult res = engine.step(state, BattleAction::makeMove(0), BattleAction::makeMove(0), rng);

    // Tauros took burn damage at turn end (approx maxHp / 16)
    EXPECT_LT(res.nextState.getActivePokemon(PlayerSide::Player1)->getCurrentHp(), startHp);
}

TEST_F(StatusTest, SleepBlocksActionAndCannotAttackOnWakeTurn) {
    SpeciesDefinition sp;
    sp.id = "snorlax";
    sp.name = "Snorlax";
    sp.types = {Type::Normal};
    sp.baseStats = {160, 110, 65, 65, 30};

    MoveDefinition tackle;
    tackle.name = "Tackle";
    tackle.basePower = 40;
    tackle.accuracy = 100;
    tackle.pp = 35;

    PokemonInstance sleeper(sp, 50);
    sleeper.addMove(&tackle);
    // Put to sleep with exactly 1 turn duration
    sleeper.applyStatus(StatusEffect::Sleep, 1);

    PokemonInstance opponent(sp, 50);
    opponent.addMove(&tackle);

    BattleState state;
    state.p1Team.addPokemon(sleeper);
    state.p2Team.addPokemon(opponent);

    MersenneTwisterRNG rng(42);
    // Turn 1: Sleeper has 1 turn left. Decrements to 0, wakes up, BUT CANNOT ATTACK!
    StepResult res = engine.step(state, BattleAction::makeMove(0), BattleAction::makeMove(0), rng);

    bool wokeUp = false;
    bool blockedOnWake = false;
    bool sleeperUsedMove = false;

    for (const auto& e : res.events) {
        if (e.side == PlayerSide::Player1) {
            if (e.type == EventType::StatusHealed && e.status == StatusEffect::Sleep) {
                wokeUp = true;
            }
            if (e.type == EventType::StatusBlockedAction) {
                blockedOnWake = true;
            }
            if (e.type == EventType::MoveUsed) {
                sleeperUsedMove = true;
            }
        }
    }

    EXPECT_TRUE(wokeUp);
    EXPECT_TRUE(blockedOnWake);
    EXPECT_FALSE(sleeperUsedMove); // Gen 1 rule: no attack on wake turn
}

TEST_F(StatusTest, ParalysisReducesSpeedToQuarter) {
    SpeciesDefinition sp;
    sp.id = "jolteon";
    sp.name = "Jolteon";
    sp.types = {Type::Electric};
    sp.baseStats = {65, 65, 60, 110, 130};

    PokemonInstance jolteon(sp, 50);
    int normalSpeed = jolteon.getEffectiveSpeed();

    jolteon.applyStatus(StatusEffect::Paralysis);
    int parSpeed = jolteon.getEffectiveSpeed();

    // Gen 1 Paralysis cuts speed to 25% (1/4)
    EXPECT_EQ(parSpeed, normalSpeed / 4);
}
