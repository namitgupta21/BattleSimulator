#include <gtest/gtest.h>
#include "engine/serializer.hpp"
#include "engine/data_loader.hpp"

using namespace engine;

class SerializationTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Load data if available
        GameDataRegistry::instance().loadAll("data");
    }
};

TEST_F(SerializationTest, BattleStateJsonRoundTrip) {
    auto& reg = GameDataRegistry::instance();

    BattleState state;
    state.turnNumber = 7;
    state.phase = BattlePhase::ActionSelection;

    Team team1;
    PokemonInstance snorlax = reg.createPokemon("snorlax", 50);
    snorlax.takeDamage(45);
    snorlax.applyStatus(StatusEffect::Paralysis);
    snorlax.getStatStages().modify(StatType::Attack, 2);
    snorlax.getStatStages().modify(StatType::Defense, -1);
    if (!snorlax.getMoves().empty()) {
        snorlax.getMoves()[0].deductPp();
    }
    team1.addPokemon(snorlax);

    PokemonInstance alakazam = reg.createPokemon("alakazam", 50);
    team1.addPokemon(alakazam);

    Team team2;
    PokemonInstance tauros = reg.createPokemon("tauros", 50);
    tauros.takeDamage(30);
    team2.addPokemon(tauros);

    state.p1Team = team1;
    state.p2Team = team2;

    std::string jsonStr = BattleSerializer::stateToJson(state);
    EXPECT_FALSE(jsonStr.empty());

    BattleState restored = BattleSerializer::jsonToState(jsonStr, reg);

    EXPECT_EQ(restored.turnNumber, 7);
    EXPECT_EQ(restored.phase, BattlePhase::ActionSelection);

    const auto* p1Active = restored.getActivePokemon(PlayerSide::Player1);
    ASSERT_NE(p1Active, nullptr);
    EXPECT_EQ(p1Active->getName(), "Snorlax");
    EXPECT_EQ(p1Active->getCurrentHp(), snorlax.getCurrentHp());
    EXPECT_EQ(p1Active->getStatus(), StatusEffect::Paralysis);
    EXPECT_EQ(p1Active->getStatStages().attack, 2);
    EXPECT_EQ(p1Active->getStatStages().defense, -1);
    if (!p1Active->getMoves().empty()) {
        EXPECT_EQ(p1Active->getMoves()[0].currentPp, snorlax.getMoves()[0].currentPp);
    }

    const auto* p2Active = restored.getActivePokemon(PlayerSide::Player2);
    ASSERT_NE(p2Active, nullptr);
    EXPECT_EQ(p2Active->getName(), "Tauros");
    EXPECT_EQ(p2Active->getCurrentHp(), tauros.getCurrentHp());
}

TEST_F(SerializationTest, EventsJsonRoundTrip) {
    std::vector<BattleEvent> original;
    original.push_back(BattleEvent::turnStarted(3));
    original.push_back(BattleEvent::moveUsed(PlayerSide::Player1, "Snorlax", "Body Slam"));
    original.push_back(BattleEvent::criticalHit(PlayerSide::Player2));
    original.push_back(BattleEvent::damageDealt(PlayerSide::Player2, "Chansey", 120, 250, 370));
    original.push_back(BattleEvent::statusApplied(PlayerSide::Player2, "Chansey", StatusEffect::Paralysis));
    original.push_back(BattleEvent::turnEnded(3));

    std::string jsonStr = BattleSerializer::eventsToJson(original);
    EXPECT_FALSE(jsonStr.empty());

    std::vector<BattleEvent> restored = BattleSerializer::jsonToEvents(jsonStr);

    ASSERT_EQ(restored.size(), original.size());
    for (size_t i = 0; i < original.size(); ++i) {
        EXPECT_EQ(restored[i].type, original[i].type);
        EXPECT_EQ(restored[i].side, original[i].side);
        EXPECT_EQ(restored[i].pokemonName, original[i].pokemonName);
        EXPECT_EQ(restored[i].moveName, original[i].moveName);
        EXPECT_EQ(restored[i].intValue1, original[i].intValue1);
        EXPECT_EQ(restored[i].intValue2, original[i].intValue2);
        EXPECT_EQ(restored[i].status, original[i].status);
    }
}
