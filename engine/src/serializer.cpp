#include "engine/serializer.hpp"
#include "nlohmann/json.hpp"

namespace engine {

using json = nlohmann::json;

namespace {

json serializePokemonObj(const PokemonInstance& p) {
    json j;
    j["speciesId"] = p.getSpeciesId();
    j["name"] = p.getName();
    j["level"] = p.getLevel();
    j["currentHp"] = p.getCurrentHp();
    j["maxHp"] = p.getMaxHp();
    j["status"] = statusToString(p.getStatus());
    j["sleepTurns"] = p.getSleepTurns();

    json stages;
    stages["attack"] = p.getStatStages().attack;
    stages["defense"] = p.getStatStages().defense;
    stages["special"] = p.getStatStages().special;
    stages["speed"] = p.getStatStages().speed;
    stages["accuracy"] = p.getStatStages().accuracy;
    stages["evasion"] = p.getStatStages().evasion;
    j["statStages"] = stages;

    json movesArr = json::array();
    for (const auto& m : p.getMoves()) {
        json mObj;
        mObj["id"] = m.def ? m.def->id : "";
        mObj["currentPp"] = m.currentPp;
        mObj["maxPp"] = m.maxPp;
        movesArr.push_back(mObj);
    }
    j["moves"] = movesArr;

    return j;
}

PokemonInstance deserializePokemonObj(const json& j, const GameDataRegistry& registry) {
    std::string speciesId = j.value("speciesId", "snorlax");
    int level = j.value("level", 50);

    const auto* sp = registry.getSpecies(speciesId);
    PokemonInstance inst;
    if (sp) {
        inst = PokemonInstance(*sp, level);
    }

    inst.setHp(j.value("currentHp", inst.getMaxHp()));
    std::string stStr = j.value("status", "NONE");
    inst.setStatus(stringToStatus(stStr), j.value("sleepTurns", 0));

    if (j.contains("statStages")) {
        const auto& stages = j["statStages"];
        inst.getStatStages().attack = stages.value("attack", 0);
        inst.getStatStages().defense = stages.value("defense", 0);
        inst.getStatStages().special = stages.value("special", 0);
        inst.getStatStages().speed = stages.value("speed", 0);
        inst.getStatStages().accuracy = stages.value("accuracy", 0);
        inst.getStatStages().evasion = stages.value("evasion", 0);
    }

    if (j.contains("moves")) {
        inst.getMoves().clear();
        for (const auto& mObj : j["moves"]) {
            std::string mId = mObj.value("id", "");
            const auto* mDef = registry.getMove(mId);
            if (mDef) {
                MoveInstance mInst;
                mInst.def = mDef;
                mInst.maxPp = mObj.value("maxPp", mDef->pp);
                mInst.currentPp = mObj.value("currentPp", mInst.maxPp);
                inst.getMoves().push_back(mInst);
            }
        }
    }

    return inst;
}

json serializeTeamObj(const Team& team) {
    json j;
    j["activeIndex"] = team.getActiveIndex();
    json members = json::array();
    for (const auto& p : team.getMembers()) {
        members.push_back(serializePokemonObj(p));
    }
    j["pokemon"] = members;
    return j;
}

Team deserializeTeamObj(const json& j, const GameDataRegistry& registry) {
    Team team;
    if (j.contains("pokemon")) {
        for (const auto& pObj : j["pokemon"]) {
            team.addPokemon(deserializePokemonObj(pObj, registry));
        }
    }
    team.setActiveIndex(j.value("activeIndex", 0));
    return team;
}

json serializeEventObj(const BattleEvent& e) {
    json j;
    j["type"] = eventTypeToString(e.type);
    j["side"] = (e.side == PlayerSide::Player1) ? "Player1" : "Player2";
    if (!e.pokemonName.empty()) j["pokemon"] = e.pokemonName;
    if (!e.moveName.empty()) j["move"] = e.moveName;
    j["intValue1"] = e.intValue1;
    j["intValue2"] = e.intValue2;
    j["doubleValue"] = e.doubleValue;
    j["status"] = statusToString(e.status);
    j["stat"] = statTypeToString(e.stat);
    if (!e.message.empty()) j["message"] = e.message;
    return j;
}

} // anonymous namespace

std::string BattleSerializer::pokemonToJson(const PokemonInstance& pokemon) {
    return serializePokemonObj(pokemon).dump(2);
}

PokemonInstance BattleSerializer::jsonToPokemon(const std::string& jsonStr, const GameDataRegistry& registry) {
    return deserializePokemonObj(json::parse(jsonStr), registry);
}

std::string BattleSerializer::stateToJson(const BattleState& state) {
    json j;
    j["turnNumber"] = state.turnNumber;
    j["phase"] = battlePhaseToString(state.phase);
    if (state.winner.has_value()) {
        j["winner"] = (state.winner.value() == PlayerSide::Player1) ? "Player1" : "Player2";
    } else {
        j["winner"] = nullptr;
    }
    j["p1Team"] = serializeTeamObj(state.p1Team);
    j["p2Team"] = serializeTeamObj(state.p2Team);
    return j.dump(2);
}

BattleState BattleSerializer::jsonToState(const std::string& jsonStr, const GameDataRegistry& registry) {
    json j = json::parse(jsonStr);
    BattleState state;
    state.turnNumber = j.value("turnNumber", 1);

    std::string phaseStr = j.value("phase", "ActionSelection");
    if (phaseStr == "ActionSelection") state.phase = BattlePhase::ActionSelection;
    else if (phaseStr == "ForcedSwitchP1") state.phase = BattlePhase::ForcedSwitchP1;
    else if (phaseStr == "ForcedSwitchP2") state.phase = BattlePhase::ForcedSwitchP2;
    else if (phaseStr == "ForcedSwitchBoth") state.phase = BattlePhase::ForcedSwitchBoth;
    else if (phaseStr == "GameOver") state.phase = BattlePhase::GameOver;

    if (j.contains("winner") && !j["winner"].is_null()) {
        std::string winStr = j["winner"].get<std::string>();
        state.winner = (winStr == "Player1") ? PlayerSide::Player1 : PlayerSide::Player2;
    }

    if (j.contains("p1Team")) state.p1Team = deserializeTeamObj(j["p1Team"], registry);
    if (j.contains("p2Team")) state.p2Team = deserializeTeamObj(j["p2Team"], registry);

    return state;
}

std::string BattleSerializer::eventsToJson(const std::vector<BattleEvent>& events) {
    json arr = json::array();
    for (const auto& e : events) {
        arr.push_back(serializeEventObj(e));
    }
    return arr.dump(2);
}

std::vector<BattleEvent> BattleSerializer::jsonToEvents(const std::string& jsonStr) {
    json arr = json::parse(jsonStr);
    std::vector<BattleEvent> result;
    for (const auto& item : arr) {
        BattleEvent e;
        std::string typeStr = item.value("type", "TurnStarted");
        if (typeStr == "TurnStarted") e.type = EventType::TurnStarted;
        else if (typeStr == "TurnEnded") e.type = EventType::TurnEnded;
        else if (typeStr == "MoveUsed") e.type = EventType::MoveUsed;
        else if (typeStr == "MoveMissed") e.type = EventType::MoveMissed;
        else if (typeStr == "DamageDealt") e.type = EventType::DamageDealt;
        else if (typeStr == "CriticalHit") e.type = EventType::CriticalHit;
        else if (typeStr == "Effectiveness") e.type = EventType::Effectiveness;
        else if (typeStr == "StatusApplied") e.type = EventType::StatusApplied;
        else if (typeStr == "StatusDamage") e.type = EventType::StatusDamage;
        else if (typeStr == "StatusBlockedAction") e.type = EventType::StatusBlockedAction;
        else if (typeStr == "StatusHealed") e.type = EventType::StatusHealed;
        else if (typeStr == "StatStageChanged") e.type = EventType::StatStageChanged;
        else if (typeStr == "PokemonHealed") e.type = EventType::PokemonHealed;
        else if (typeStr == "Fainted") e.type = EventType::Fainted;
        else if (typeStr == "SwitchedIn") e.type = EventType::SwitchedIn;
        else if (typeStr == "BattleEnded") e.type = EventType::BattleEnded;

        std::string sideStr = item.value("side", "Player1");
        e.side = (sideStr == "Player1") ? PlayerSide::Player1 : PlayerSide::Player2;
        e.pokemonName = item.value("pokemon", "");
        e.moveName = item.value("move", "");
        e.intValue1 = item.value("intValue1", 0);
        e.intValue2 = item.value("intValue2", 0);
        e.doubleValue = item.value("doubleValue", 1.0);
        e.status = stringToStatus(item.value("status", "NONE"));
        e.message = item.value("message", "");
        result.push_back(e);
    }
    return result;
}

} // namespace engine
