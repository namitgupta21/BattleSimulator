#include <gtest/gtest.h>
#include "engine/data_provider.hpp"
#include "engine/local_json_provider.hpp"
#include <unordered_set>

using namespace engine;

class DataProviderTest : public ::testing::Test {
protected:
    void SetUp() override {
        provider = std::make_unique<LocalJsonProvider>();
        ASSERT_TRUE(provider->loadAll("data"));
    }

    std::unique_ptr<LocalJsonProvider> provider;
};

TEST_F(DataProviderTest, LoadsFullGen1Roster) {
    auto speciesIds = provider->getAllSpeciesIds();
    // 150 species (151 minus Ditto, which only learns Transform)
    EXPECT_GE(speciesIds.size(), 150);

    auto moveIds = provider->getAllMoveIds();
    EXPECT_GE(moveIds.size(), 100);
}

TEST_F(DataProviderTest, EveryPokemonHasUsableDamagingMove) {
    auto speciesIds = provider->getAllSpeciesIds();
    for (const auto& id : speciesIds) {
        const auto* sp = provider->getSpecies(id);
        ASSERT_NE(sp, nullptr) << "Species not found: " << id;

        const auto& pool = !sp->learnset.empty() ? sp->learnset : sp->defaultMoves;
        ASSERT_FALSE(pool.empty()) << "Pokemon has empty move pool: " << id;

        bool hasDamaging = false;
        for (const auto& mId : pool) {
            const auto* mDef = provider->getMove(mId);
            ASSERT_NE(mDef, nullptr) << "Dangling move id '" << mId << "' in species '" << id << "'";

            if (mDef->basePower > 0) {
                hasDamaging = true;
                break;
            }
            for (const auto& eff : mDef->effects) {
                if (eff.type == EffectType::SetDamageLevel) {
                    hasDamaging = true;
                    break;
                }
            }
            if (hasDamaging) break;
        }

        EXPECT_TRUE(hasDamaging) << "Species '" << id << "' has no usable damaging moves!";
    }
}

TEST_F(DataProviderTest, EveryPokemonTypeExistsInTypeChart) {
    auto typeChart = provider->getTypeChart();
    ASSERT_NE(typeChart, nullptr);

    auto speciesIds = provider->getAllSpeciesIds();
    for (const auto& id : speciesIds) {
        const auto* sp = provider->getSpecies(id);
        ASSERT_NE(sp, nullptr);
        EXPECT_FALSE(sp->types.empty()) << "Pokemon " << id << " has no types";

        for (Type t : sp->types) {
            // Verify effectiveness check produces a valid multiplier
            double mult = typeChart->getEffectiveness(t, Type::Normal);
            EXPECT_GE(mult, 0.0);
        }
    }
}

TEST_F(DataProviderTest, Gen1RetroTypingsFaithful) {
    // Magnemite and Magneton pure Electric
    const auto* magnemite = provider->getSpecies("magnemite");
    ASSERT_NE(magnemite, nullptr);
    ASSERT_EQ(magnemite->types.size(), 1);
    EXPECT_EQ(magnemite->types[0], Type::Electric);

    // Clefairy pure Normal
    const auto* clefairy = provider->getSpecies("clefairy");
    ASSERT_NE(clefairy, nullptr);
    ASSERT_EQ(clefairy->types.size(), 1);
    EXPECT_EQ(clefairy->types[0], Type::Normal);

    // Jigglypuff pure Normal
    const auto* jigglypuff = provider->getSpecies("jigglypuff");
    ASSERT_NE(jigglypuff, nullptr);
    ASSERT_EQ(jigglypuff->types.size(), 1);
    EXPECT_EQ(jigglypuff->types[0], Type::Normal);
}

TEST_F(DataProviderTest, Gen1SpecialStatFaithful) {
    // Chansey Gen 1 Special was 105 (not modern 35 Sp. Atk)
    const auto* chansey = provider->getSpecies("chansey");
    ASSERT_NE(chansey, nullptr);
    EXPECT_EQ(chansey->baseStats.special, 105);

    // Tauros Gen 1 Special was 70 (not modern 40 Sp. Atk)
    const auto* tauros = provider->getSpecies("tauros");
    ASSERT_NE(tauros, nullptr);
    EXPECT_EQ(tauros->baseStats.special, 70);

    // Snorlax Gen 1 Special was 65
    const auto* snorlax = provider->getSpecies("snorlax");
    ASSERT_NE(snorlax, nullptr);
    EXPECT_EQ(snorlax->baseStats.special, 65);
}
