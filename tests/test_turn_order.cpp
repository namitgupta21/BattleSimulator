#include <gtest/gtest.h>
#include "engine/engine.hpp"

using namespace engine;

class TurnOrderTest : public ::testing::Test {
protected:
    BattleEngine engine;
};

TEST_F(TurnOrderTest, PriorityMovesMoveFirstRegardlessOfSpeed) {
    // Snorlax (Slow: Speed 30) vs Jolteon (Fast: Speed 130)
    SpeciesDefinition snorlaxSp;
    snorlaxSp.id = "snorlax";
    snorlaxSp.name = "Snorlax";
    snorlaxSp.types = {Type::Normal};
    snorlaxSp.baseStats = {160, 110, 65, 65, 30};

    SpeciesDefinition jolteonSp;
    jolteonSp.id = "jolteon";
    jolteonSp.name = "Jolteon";
    jolteonSp.types = {Type::Electric};
    jolteonSp.baseStats = {65, 65, 60, 110, 130};

    PokemonInstance snorlax(snorlaxSp, 50);
    PokemonInstance jolteon(jolteonSp, 50);

    MoveDefinition quickAttack;
    quickAttack.name = "Quick Attack";
    quickAttack.type = Type::Normal;
    quickAttack.priority = 1;
    quickAttack.basePower = 40;
    quickAttack.accuracy = 100;
    quickAttack.pp = 30;

    MoveDefinition thunderbolt;
    thunderbolt.name = "Thunderbolt";
    thunderbolt.type = Type::Electric;
    thunderbolt.priority = 0;
    thunderbolt.basePower = 95;
    thunderbolt.accuracy = 100;
    thunderbolt.pp = 15;

    snorlax.addMove(&quickAttack);
    jolteon.addMove(&thunderbolt);

    BattleState state;
    state.p1Team.addPokemon(snorlax);
    state.p2Team.addPokemon(jolteon);

    MersenneTwisterRNG rng(1234);
    // P1 selects Quick Attack (Move 0), P2 selects Thunderbolt (Move 0)
    StepResult res = engine.step(state, BattleAction::makeMove(0), BattleAction::makeMove(0), rng);

    // First MoveUsed event in event log MUST be Snorlax's Quick Attack due to priority +1
    ASSERT_GE(res.events.size(), 2);
    bool foundFirstMove = false;
    for (const auto& e : res.events) {
        if (e.type == EventType::MoveUsed) {
            EXPECT_EQ(e.pokemonName, "Snorlax");
            EXPECT_EQ(e.moveName, "Quick Attack");
            foundFirstMove = true;
            break;
        }
    }
    EXPECT_TRUE(foundFirstMove);
}

TEST_F(TurnOrderTest, NaturalSpeedDeterminesOrderWhenPriorityTied) {
    // Alakazam (Speed 120) vs Snorlax (Speed 30)
    SpeciesDefinition alakazamSp;
    alakazamSp.id = "alakazam";
    alakazamSp.name = "Alakazam";
    alakazamSp.types = {Type::Psychic};
    alakazamSp.baseStats = {55, 50, 45, 135, 120};

    SpeciesDefinition snorlaxSp;
    snorlaxSp.id = "snorlax";
    snorlaxSp.name = "Snorlax";
    snorlaxSp.types = {Type::Normal};
    snorlaxSp.baseStats = {160, 110, 65, 65, 30};

    PokemonInstance alakazam(alakazamSp, 50);
    PokemonInstance snorlax(snorlaxSp, 50);

    MoveDefinition psychic;
    psychic.name = "Psychic";
    psychic.type = Type::Psychic;
    psychic.priority = 0;
    psychic.basePower = 90;
    psychic.accuracy = 100;
    psychic.pp = 10;

    MoveDefinition bodySlam;
    bodySlam.name = "Body Slam";
    bodySlam.type = Type::Normal;
    bodySlam.priority = 0;
    bodySlam.basePower = 85;
    bodySlam.accuracy = 100;
    bodySlam.pp = 15;

    alakazam.addMove(&psychic);
    snorlax.addMove(&bodySlam);

    BattleState state;
    state.p1Team.addPokemon(snorlax);
    state.p2Team.addPokemon(alakazam);

    MersenneTwisterRNG rng(42);
    StepResult res = engine.step(state, BattleAction::makeMove(0), BattleAction::makeMove(0), rng);

    // Alakazam (P2) is faster, so it must attack first
    for (const auto& e : res.events) {
        if (e.type == EventType::MoveUsed) {
            EXPECT_EQ(e.side, PlayerSide::Player2);
            EXPECT_EQ(e.pokemonName, "Alakazam");
            break;
        }
    }
}
