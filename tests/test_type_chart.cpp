#include <gtest/gtest.h>
#include "engine/type_chart.hpp"

using namespace engine;

class TypeChartTest : public ::testing::Test {
protected:
    Gen1TypeChart chart;
};

TEST_F(TypeChartTest, Gen1FaithfulMatchups) {
    // Gen 1: Psychic is immune to Ghost!
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Ghost, Type::Psychic), 0.0);

    // Gen 1: Bug and Poison are mutually super effective!
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Bug, Type::Poison), 2.0);
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Poison, Type::Bug), 2.0);

    // Gen 1: Ice is neutral against Fire (not resisted as in Gen 2+)
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Ice, Type::Fire), 1.0);

    // Standard immunities
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Normal, Type::Ghost), 0.0);
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Fighting, Type::Ghost), 0.0);
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Electric, Type::Ground), 0.0);
    EXPECT_DOUBLE_EQ(chart.getEffectiveness(Type::Ground, Type::Flying), 0.0);

    // Dual typing multiplication
    std::vector<Type> grassPoison = {Type::Grass, Type::Poison};
    // Psychic vs Grass/Poison: Psychic is neutral to Grass (1.0), super effective to Poison (2.0) -> 2.0
    EXPECT_DOUBLE_EQ(chart.getMultiplier(Type::Psychic, grassPoison), 2.0);

    // Fire vs Grass/Bug: Fire is super effective to both Grass (2.0) and Bug (2.0) -> 4.0
    std::vector<Type> grassBug = {Type::Grass, Type::Bug};
    EXPECT_DOUBLE_EQ(chart.getMultiplier(Type::Fire, grassBug), 4.0);

    // Ground vs Flying/Bug = 0.0 * 0.5 = 0.0
    std::vector<Type> flyingBug = {Type::Flying, Type::Bug};
    EXPECT_DOUBLE_EQ(chart.getMultiplier(Type::Ground, flyingBug), 0.0);
}
