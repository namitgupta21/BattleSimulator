#include <gtest/gtest.h>
#include "engine/engine.hpp"
#include "engine/local_json_provider.hpp"
#include "engine/team_generator.hpp"
#include "engine/rng.hpp"

using namespace engine;

class SimulationStressTest : public ::testing::Test {
protected:
    void SetUp() override {
        provider = std::make_unique<LocalJsonProvider>();
        ASSERT_TRUE(provider->loadAll("data"));
    }

    std::unique_ptr<LocalJsonProvider> provider;
};

TEST_F(SimulationStressTest, MultipleSeededBattlesCompleteWithoutHangsOrCrashes) {
    const int NUM_BATTLES = 150;
    const int MAX_TURNS = 350;

    auto damageCalc = std::make_shared<Gen1DamageCalculator>();
    auto effectDispatcher = std::make_shared<MoveEffectDispatcher>();
    BattleEngine engine(provider->getTypeChart(), damageCalc, effectDispatcher);

    for (int b = 1; b <= NUM_BATTLES; ++b) {
        uint64_t seed = static_cast<uint64_t>(b * 7919);
        MersenneTwisterRNG rng(seed);

        Team team1 = TeamGenerator::generate(seed, 6, *provider, 50);
        Team team2 = TeamGenerator::generate(seed + 50000, 6, *provider, 50);

        BattleState state;
        state.p1Team = std::move(team1);
        state.p2Team = std::move(team2);
        state.phase = BattlePhase::ActionSelection;
        state.turnNumber = 1;

        int turns = 0;
        while (!state.isGameOver() && turns < MAX_TURNS) {
            turns++;
            if (state.phase == BattlePhase::ActionSelection) {
                auto legal1 = engine.getLegalActions(state, PlayerSide::Player1);
                auto legal2 = engine.getLegalActions(state, PlayerSide::Player2);
                ASSERT_FALSE(legal1.empty()) << "Battle " << b << " Turn " << turns << ": P1 has no legal actions";
                ASSERT_FALSE(legal2.empty()) << "Battle " << b << " Turn " << turns << ": P2 has no legal actions";

                BattleAction a1 = legal1[rng.nextInt(0, static_cast<int>(legal1.size() - 1))];
                BattleAction a2 = legal2[rng.nextInt(0, static_cast<int>(legal2.size() - 1))];

                auto result = engine.step(state, a1, a2, rng);
                state = result.nextState;

            } else if (state.phase == BattlePhase::ForcedSwitchP1) {
                auto switches = engine.getLegalSwitches(state, PlayerSide::Player1);
                ASSERT_FALSE(switches.empty());
                BattleAction a1 = switches[rng.nextInt(0, static_cast<int>(switches.size() - 1))];

                auto result = engine.resolveForcedSwitches(state, a1, std::nullopt, rng);
                state = result.nextState;

            } else if (state.phase == BattlePhase::ForcedSwitchP2) {
                auto switches = engine.getLegalSwitches(state, PlayerSide::Player2);
                ASSERT_FALSE(switches.empty());
                BattleAction a2 = switches[rng.nextInt(0, static_cast<int>(switches.size() - 1))];

                auto result = engine.resolveForcedSwitches(state, std::nullopt, a2, rng);
                state = result.nextState;

            } else if (state.phase == BattlePhase::ForcedSwitchBoth) {
                auto switches1 = engine.getLegalSwitches(state, PlayerSide::Player1);
                auto switches2 = engine.getLegalSwitches(state, PlayerSide::Player2);
                ASSERT_FALSE(switches1.empty());
                ASSERT_FALSE(switches2.empty());

                BattleAction a1 = switches1[rng.nextInt(0, static_cast<int>(switches1.size() - 1))];
                BattleAction a2 = switches2[rng.nextInt(0, static_cast<int>(switches2.size() - 1))];

                auto result = engine.resolveForcedSwitches(state, a1, a2, rng);
                state = result.nextState;
            }
        }

        EXPECT_TRUE(state.isGameOver()) << "Battle " << b << " exceeded max turns (" << MAX_TURNS << ")";
        EXPECT_TRUE(state.winner.has_value()) << "Battle " << b << " ended without a winner";
    }
}

TEST_F(SimulationStressTest, ReproducibilityOnRandomGeneratedTeams) {
    auto runBattle = [&](uint64_t seed) -> std::pair<PlayerSide, int> {
        MersenneTwisterRNG rng(seed);
        Team team1 = TeamGenerator::generate(seed, 6, *provider, 50);
        Team team2 = TeamGenerator::generate(seed + 12345, 6, *provider, 50);

        auto damageCalc = std::make_shared<Gen1DamageCalculator>();
        auto effectDispatcher = std::make_shared<MoveEffectDispatcher>();
        BattleEngine engine(provider->getTypeChart(), damageCalc, effectDispatcher);

        BattleState state;
        state.p1Team = std::move(team1);
        state.p2Team = std::move(team2);
        state.phase = BattlePhase::ActionSelection;
        state.turnNumber = 1;

        int totalEvents = 0;
        while (!state.isGameOver()) {
            if (state.phase == BattlePhase::ActionSelection) {
                auto legal1 = engine.getLegalActions(state, PlayerSide::Player1);
                auto legal2 = engine.getLegalActions(state, PlayerSide::Player2);

                BattleAction a1 = legal1[rng.nextInt(0, static_cast<int>(legal1.size() - 1))];
                BattleAction a2 = legal2[rng.nextInt(0, static_cast<int>(legal2.size() - 1))];

                auto result = engine.step(state, a1, a2, rng);
                totalEvents += static_cast<int>(result.events.size());
                state = result.nextState;

            } else if (state.phase == BattlePhase::ForcedSwitchP1) {
                auto switches = engine.getLegalSwitches(state, PlayerSide::Player1);
                BattleAction a1 = switches[rng.nextInt(0, static_cast<int>(switches.size() - 1))];

                auto result = engine.resolveForcedSwitches(state, a1, std::nullopt, rng);
                totalEvents += static_cast<int>(result.events.size());
                state = result.nextState;

            } else if (state.phase == BattlePhase::ForcedSwitchP2) {
                auto switches = engine.getLegalSwitches(state, PlayerSide::Player2);
                BattleAction a2 = switches[rng.nextInt(0, static_cast<int>(switches.size() - 1))];

                auto result = engine.resolveForcedSwitches(state, std::nullopt, a2, rng);
                totalEvents += static_cast<int>(result.events.size());
                state = result.nextState;

            } else if (state.phase == BattlePhase::ForcedSwitchBoth) {
                auto switches1 = engine.getLegalSwitches(state, PlayerSide::Player1);
                auto switches2 = engine.getLegalSwitches(state, PlayerSide::Player2);

                BattleAction a1 = switches1[rng.nextInt(0, static_cast<int>(switches1.size() - 1))];
                BattleAction a2 = switches2[rng.nextInt(0, static_cast<int>(switches2.size() - 1))];

                auto result = engine.resolveForcedSwitches(state, a1, a2, rng);
                totalEvents += static_cast<int>(result.events.size());
                state = result.nextState;
            }
        }

        return {state.winner.value(), totalEvents};
    };

    uint64_t testSeed = 88888ULL;
    auto runA = runBattle(testSeed);
    auto runB = runBattle(testSeed);

    EXPECT_EQ(runA.first, runB.first) << "Winner mismatch across identical seed runs";
    EXPECT_EQ(runA.second, runB.second) << "Event count mismatch across identical seed runs";
}

