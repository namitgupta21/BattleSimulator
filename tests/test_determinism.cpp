#include <gtest/gtest.h>
#include "engine/engine.hpp"

using namespace engine;

TEST(DeterminismTest, IdenticalSeedAndInputsProduceIdenticalBattle) {
    auto setupBattle = []() {
        SpeciesDefinition sp1{"snorlax", "Snorlax", {Type::Normal}, {160, 110, 65, 65, 30}, {}};
        SpeciesDefinition sp2{"tauros", "Tauros", {Type::Normal}, {75, 100, 95, 70, 110}, {}};

        static MoveDefinition bodySlam{"body-slam", "Body Slam", Type::Normal, MoveCategory::Physical, 85, 100, 15, 0, false, {}};
        if (bodySlam.effects.empty()) {
            bodySlam.effects.push_back({EffectType::Damage});
            bodySlam.effects.push_back({EffectType::ApplyStatus, 0, StatusEffect::Paralysis, 30});
        }

        PokemonInstance p1(sp1, 50);
        p1.addMove(&bodySlam);

        PokemonInstance p2(sp2, 50);
        p2.addMove(&bodySlam);

        BattleState state;
        state.p1Team.addPokemon(p1);
        state.p2Team.addPokemon(p2);
        return state;
    };

    BattleEngine engine;

    // Simulation 1
    BattleState state1 = setupBattle();
    MersenneTwisterRNG rng1(9999);
    std::vector<BattleEvent> allEvents1;
    for (int t = 0; t < 5; ++t) {
        auto res = engine.step(state1, BattleAction::makeMove(0), BattleAction::makeMove(0), rng1);
        allEvents1.insert(allEvents1.end(), res.events.begin(), res.events.end());
        state1 = res.nextState;
    }

    // Simulation 2 (Same seed 9999, same actions)
    BattleState state2 = setupBattle();
    MersenneTwisterRNG rng2(9999);
    std::vector<BattleEvent> allEvents2;
    for (int t = 0; t < 5; ++t) {
        auto res = engine.step(state2, BattleAction::makeMove(0), BattleAction::makeMove(0), rng2);
        allEvents2.insert(allEvents2.end(), res.events.begin(), res.events.end());
        state2 = res.nextState;
    }

    ASSERT_EQ(allEvents1.size(), allEvents2.size());
    for (size_t i = 0; i < allEvents1.size(); ++i) {
        EXPECT_EQ(allEvents1[i].type, allEvents2[i].type);
        EXPECT_EQ(allEvents1[i].intValue1, allEvents2[i].intValue1);
        EXPECT_EQ(allEvents1[i].intValue2, allEvents2[i].intValue2);
        EXPECT_EQ(allEvents1[i].pokemonName, allEvents2[i].pokemonName);
    }

    EXPECT_EQ(state1.getActivePokemon(PlayerSide::Player1)->getCurrentHp(),
              state2.getActivePokemon(PlayerSide::Player1)->getCurrentHp());
    EXPECT_EQ(state1.getActivePokemon(PlayerSide::Player2)->getCurrentHp(),
              state2.getActivePokemon(PlayerSide::Player2)->getCurrentHp());
}
