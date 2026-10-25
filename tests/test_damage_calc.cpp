#include <gtest/gtest.h>
#include "engine/damage_calc.hpp"
#include "engine/type_chart.hpp"
#include "engine/rng.hpp"

using namespace engine;

class DamageCalcTest : public ::testing::Test {
protected:
    Gen1TypeChart chart;
    Gen1DamageCalculator calc;
};

TEST_F(DamageCalcTest, KnownReferenceDamageCalculation) {
    // Construct test species
    SpeciesDefinition attackerSp;
    attackerSp.id = "snorlax";
    attackerSp.name = "Snorlax";
    attackerSp.types = {Type::Normal};
    // With base Attack 110 at Level 50, DV 15, statExp 0:
    // Stat = floor(((110 + 15) * 2) * 50 / 100) + 5 = 125 * 100 / 100 + 5 = 130
    attackerSp.baseStats = {160, 110, 65, 65, 30};

    SpeciesDefinition defenderSp;
    defenderSp.id = "golem";
    defenderSp.name = "Golem";
    defenderSp.types = {Type::Rock, Type::Ground};
    defenderSp.baseStats = {80, 120, 130, 55, 45};

    PokemonInstance attacker(attackerSp, 50);
    PokemonInstance defender(defenderSp, 50);

    MoveDefinition bodySlam;
    bodySlam.id = "body-slam";
    bodySlam.name = "Body Slam";
    bodySlam.type = Type::Normal;
    bodySlam.category = MoveCategory::Physical;
    bodySlam.basePower = 85;
    bodySlam.accuracy = 100;
    bodySlam.pp = 15;

    // Test with MockRNG: Hit roll = 1 (hits), No crit roll = 255, Max damage roll = 255
    MockRNG rng;
    rng.queueInt(1);   // Accuracy hit check (1 <= 100)
    rng.queueInt(255); // Crit check (255 >= threshold -> no crit)
    rng.queueInt(255); // Random damage factor 255/255

    DamageResult res = calc.calculate(attacker, defender, bodySlam, chart, rng);

    EXPECT_TRUE(res.hit);
    EXPECT_FALSE(res.isCritical);
    EXPECT_TRUE(res.isStab);
    // Rock resists Normal (0.5x), Ground is neutral (1.0x) -> 0.5x total
    EXPECT_DOUBLE_EQ(res.effectiveness, 0.5);
    EXPECT_GT(res.damage, 0);

    // Test minimum damage roll (217)
    MockRNG rngMin;
    rngMin.queueInt(1);
    rngMin.queueInt(255);
    rngMin.queueInt(217);

    DamageResult resMin = calc.calculate(attacker, defender, bodySlam, chart, rngMin);
    EXPECT_LE(resMin.damage, res.damage);
}

TEST_F(DamageCalcTest, SetDamageLevelMoves) {
    SpeciesDefinition attackerSp;
    attackerSp.id = "alakazam";
    attackerSp.types = {Type::Psychic};
    attackerSp.baseStats = {55, 50, 45, 135, 120};

    SpeciesDefinition defenderSp;
    defenderSp.id = "snorlax";
    defenderSp.types = {Type::Normal};
    defenderSp.baseStats = {160, 110, 65, 65, 30};

    PokemonInstance attacker(attackerSp, 50);
    PokemonInstance defender(defenderSp, 50);

    MoveDefinition seismicToss;
    seismicToss.id = "seismic-toss";
    seismicToss.type = Type::Fighting;
    seismicToss.category = MoveCategory::Physical;
    seismicToss.accuracy = 100;
    MoveEffect eff;
    eff.type = EffectType::SetDamageLevel;
    seismicToss.effects.push_back(eff);

    MockRNG rng;
    rng.queueInt(1);

    DamageResult res = calc.calculate(attacker, defender, seismicToss, chart, rng);
    // Seismic Toss deals damage exactly equal to user level (50)
    EXPECT_EQ(res.damage, 50);
}
