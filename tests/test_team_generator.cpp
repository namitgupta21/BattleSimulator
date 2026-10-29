#include <gtest/gtest.h>
#include "engine/team_generator.hpp"
#include "engine/local_json_provider.hpp"
#include <unordered_set>

using namespace engine;

class TeamGeneratorTest : public ::testing::Test {
protected:
    void SetUp() override {
        provider = std::make_unique<LocalJsonProvider>();
        ASSERT_TRUE(provider->loadAll("data"));
    }

    std::unique_ptr<LocalJsonProvider> provider;
};

TEST_F(TeamGeneratorTest, DeterministicGenerationWithIdenticalSeed) {
    uint64_t seed = 12345ULL;
    Team teamA = TeamGenerator::generate(seed, 6, *provider, 50);
    Team teamB = TeamGenerator::generate(seed, 6, *provider, 50);

    ASSERT_EQ(teamA.getMembers().size(), 6);
    ASSERT_EQ(teamB.getMembers().size(), 6);

    for (size_t i = 0; i < 6; ++i) {
        const auto& pA = teamA.getMembers()[i];
        const auto& pB = teamB.getMembers()[i];

        EXPECT_EQ(pA.getSpeciesId(), pB.getSpeciesId());
        EXPECT_EQ(pA.getCurrentHp(), pB.getCurrentHp());
        ASSERT_EQ(pA.getMoves().size(), pB.getMoves().size());

        for (size_t m = 0; m < pA.getMoves().size(); ++m) {
            EXPECT_EQ(pA.getMoves()[m].def->id, pB.getMoves()[m].def->id);
            EXPECT_EQ(pA.getMoves()[m].currentPp, pB.getMoves()[m].currentPp);
        }
    }
}

TEST_F(TeamGeneratorTest, DistinctPokemonOnGeneratedTeam) {
    Team team = TeamGenerator::generate(999ULL, 6, *provider, 50);
    EXPECT_EQ(team.getMembers().size(), 6);

    std::unordered_set<std::string> seenSpecies;
    for (const auto& p : team.getMembers()) {
        EXPECT_TRUE(seenSpecies.insert(p.getSpeciesId()).second)
            << "Duplicate species on team: " << p.getSpeciesId();
    }
}

TEST_F(TeamGeneratorTest, EveryMemberHasAtLeastOneDamagingMove) {
    // Test across 20 different seeds
    for (uint64_t seed = 1; seed <= 20; ++seed) {
        Team team = TeamGenerator::generate(seed, 6, *provider, 50);
        for (const auto& p : team.getMembers()) {
            bool hasDamaging = false;
            for (const auto& m : p.getMoves()) {
                if (m.def->basePower > 0) {
                    hasDamaging = true;
                    break;
                }
                for (const auto& eff : m.def->effects) {
                    if (eff.type == EffectType::SetDamageLevel) {
                        hasDamaging = true;
                        break;
                    }
                }
                if (hasDamaging) break;
            }
            EXPECT_TRUE(hasDamaging)
                << "Pokemon " << p.getSpeciesId() << " (seed " << seed << ") generated without damaging move!";
        }
    }
}

TEST_F(TeamGeneratorTest, GeneratesUpToFourMovesPerPokemon) {
    Team team = TeamGenerator::generate(42ULL, 6, *provider, 50);
    for (const auto& p : team.getMembers()) {
        EXPECT_LE(p.getMoves().size(), 4);
        EXPECT_GE(p.getMoves().size(), 1);
    }
}

