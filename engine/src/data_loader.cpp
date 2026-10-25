#include "engine/data_loader.hpp"
#include <fstream>
#include <iostream>
#include "nlohmann/json.hpp"

namespace engine {

using json = nlohmann::json;

GameDataRegistry::GameDataRegistry()
    : m_typeChart(std::make_shared<Gen1TypeChart>()) {}

GameDataRegistry& GameDataRegistry::instance() {
    static GameDataRegistry registry;
    return registry;
}

bool GameDataRegistry::loadAll(const std::string& dataDirectory) {
    std::string dir = dataDirectory;
    if (!std::ifstream(dir + "/pokemon.json").good()) {
        if (std::ifstream("../" + dir + "/pokemon.json").good()) {
            dir = "../" + dir;
        } else if (std::ifstream("../../" + dir + "/pokemon.json").good()) {
            dir = "../../" + dir;
        }
    }
    std::string sep = "/";
    if (!dir.empty() && (dir.back() == '/' || dir.back() == '\\')) {
        sep = "";
    }
    bool t = loadTypeChart(dir + sep + "type_chart.json");
    bool m = loadMoves(dir + sep + "moves.json");
    bool p = loadPokemon(dir + sep + "pokemon.json");
    return t && m && p;
}

bool GameDataRegistry::loadTypeChart(const std::string& filePath) {
    std::ifstream file(filePath);
    if (!file.is_open()) return false;

    try {
        json j;
        file >> j;
        if (j.contains("effectiveness")) {
            for (auto& [atkStr, defMap] : j["effectiveness"].items()) {
                Type atkType = stringToType(atkStr);
                for (auto& [defStr, multVal] : defMap.items()) {
                    Type defType = stringToType(defStr);
                    double mult = multVal.get<double>();
                    m_typeChart->setEffectiveness(atkType, defType, mult);
                }
            }
        }
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing type chart JSON: " << e.what() << "\n";
        return false;
    }
}

bool GameDataRegistry::loadMoves(const std::string& filePath) {
    std::ifstream file(filePath);
    if (!file.is_open()) return false;

    try {
        json j;
        file >> j;
        if (!j.contains("moves")) return false;

        for (const auto& item : j["moves"]) {
            MoveDefinition def;
            def.id = item.value("id", "");
            def.name = item.value("name", "");
            def.type = stringToType(item.value("type", "Normal"));

            std::string catStr = item.value("category", "Physical");
            if (catStr == "Physical") def.category = MoveCategory::Physical;
            else if (catStr == "Special") def.category = MoveCategory::Special;
            else def.category = MoveCategory::Status;

            def.basePower = item.value("power", 0);
            def.accuracy = item.value("accuracy", 100);
            def.pp = item.value("pp", 10);
            def.priority = item.value("priority", 0);
            def.highCrit = item.value("highCrit", false);

            if (item.contains("effects")) {
                for (const auto& eff : item["effects"]) {
                    MoveEffect effect;
                    std::string effType = eff.value("type", "Damage");
                    if (effType == "Damage") effect.type = EffectType::Damage;
                    else if (effType == "ApplyStatus") effect.type = EffectType::ApplyStatus;
                    else if (effType == "ChangeStatStage") effect.type = EffectType::ChangeStatStage;
                    else if (effType == "HealFraction") effect.type = EffectType::HealFraction;
                    else if (effType == "RecoilFraction") effect.type = EffectType::RecoilFraction;
                    else if (effType == "SetDamageLevel") effect.type = EffectType::SetDamageLevel;
                    else if (effType == "SelfFaint") effect.type = EffectType::SelfFaint;

                    effect.value = eff.value("value", 0);
                    effect.status = stringToStatus(eff.value("status", "None"));
                    effect.chancePercent = eff.value("chancePercent", 100);
                    effect.targetSelf = eff.value("targetSelf", false);

                    std::string statStr = eff.value("targetStat", "Attack");
                    if (statStr == "Attack") effect.targetStat = StatType::Attack;
                    else if (statStr == "Defense") effect.targetStat = StatType::Defense;
                    else if (statStr == "Special") effect.targetStat = StatType::Special;
                    else if (statStr == "Speed") effect.targetStat = StatType::Speed;
                    else if (statStr == "Accuracy") effect.targetStat = StatType::Accuracy;
                    else if (statStr == "Evasion") effect.targetStat = StatType::Evasion;

                    def.effects.push_back(effect);
                }
            } else {
                // Default damage effect if not specified and basePower > 0
                if (def.basePower > 0) {
                    MoveEffect eff;
                    eff.type = EffectType::Damage;
                    def.effects.push_back(eff);
                }
            }

            m_moves[def.id] = def;
        }
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing moves JSON: " << e.what() << "\n";
        return false;
    }
}

bool GameDataRegistry::loadPokemon(const std::string& filePath) {
    std::ifstream file(filePath);
    if (!file.is_open()) return false;

    try {
        json j;
        file >> j;
        if (!j.contains("pokemon")) return false;

        for (const auto& item : j["pokemon"]) {
            SpeciesDefinition species;
            species.id = item.value("id", "");
            species.name = item.value("name", "");

            if (item.contains("types")) {
                for (const auto& t : item["types"]) {
                    species.types.push_back(stringToType(t.get<std::string>()));
                }
            }

            if (item.contains("baseStats")) {
                const auto& bs = item["baseStats"];
                species.baseStats.hp = bs.value("hp", 80);
                species.baseStats.attack = bs.value("attack", 80);
                species.baseStats.defense = bs.value("defense", 80);
                species.baseStats.special = bs.value("special", 80);
                species.baseStats.speed = bs.value("speed", 80);
            }

            if (item.contains("defaultMoves")) {
                for (const auto& m : item["defaultMoves"]) {
                    species.defaultMoves.push_back(m.get<std::string>());
                }
            }

            m_species[species.id] = species;
        }
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing pokemon JSON: " << e.what() << "\n";
        return false;
    }
}

const SpeciesDefinition* GameDataRegistry::getSpecies(const std::string& id) const {
    auto it = m_species.find(id);
    return (it != m_species.end()) ? &it->second : nullptr;
}

const MoveDefinition* GameDataRegistry::getMove(const std::string& id) const {
    auto it = m_moves.find(id);
    return (it != m_moves.end()) ? &it->second : nullptr;
}

std::shared_ptr<const ITypeChart> GameDataRegistry::getTypeChart() const {
    return m_typeChart;
}

PokemonInstance GameDataRegistry::createPokemon(const std::string& speciesId, int level) const {
    const auto* sp = getSpecies(speciesId);
    if (!sp) {
        throw std::runtime_error("Unknown species id: " + speciesId);
    }
    PokemonInstance inst(*sp, level);
    for (const auto& mId : sp->defaultMoves) {
        if (inst.getMoves().size() >= 4) break;
        const auto* moveDef = getMove(mId);
        if (moveDef) {
            inst.addMove(moveDef);
        }
    }
    return inst;
}

} // namespace engine
