#pragma once

#include <string>
#include <string_view>

namespace engine {

enum class Type {
    Normal,
    Fire,
    Water,
    Grass,
    Electric,
    Ice,
    Fighting,
    Poison,
    Ground,
    Flying,
    Psychic,
    Bug,
    Rock,
    Ghost,
    Dragon,
    None
};

enum class MoveCategory {
    Physical,
    Special,
    Status
};

enum class StatusEffect {
    None,
    Paralysis,
    Burn,
    Poison,
    Sleep,
    Freeze,
    Confusion
};

enum class StatType {
    Attack,
    Defense,
    Special,
    Speed,
    Accuracy,
    Evasion
};

enum class PlayerSide {
    Player1,
    Player2
};

inline PlayerSide getOpposingSide(PlayerSide side) {
    return (side == PlayerSide::Player1) ? PlayerSide::Player2 : PlayerSide::Player1;
}

inline std::string_view typeToString(Type t) {
    switch (t) {
        case Type::Normal: return "Normal";
        case Type::Fire: return "Fire";
        case Type::Water: return "Water";
        case Type::Grass: return "Grass";
        case Type::Electric: return "Electric";
        case Type::Ice: return "Ice";
        case Type::Fighting: return "Fighting";
        case Type::Poison: return "Poison";
        case Type::Ground: return "Ground";
        case Type::Flying: return "Flying";
        case Type::Psychic: return "Psychic";
        case Type::Bug: return "Bug";
        case Type::Rock: return "Rock";
        case Type::Ghost: return "Ghost";
        case Type::Dragon: return "Dragon";
        default: return "None";
    }
}

inline Type stringToType(std::string_view str) {
    if (str == "Normal") return Type::Normal;
    if (str == "Fire") return Type::Fire;
    if (str == "Water") return Type::Water;
    if (str == "Grass") return Type::Grass;
    if (str == "Electric") return Type::Electric;
    if (str == "Ice") return Type::Ice;
    if (str == "Fighting") return Type::Fighting;
    if (str == "Poison") return Type::Poison;
    if (str == "Ground") return Type::Ground;
    if (str == "Flying") return Type::Flying;
    if (str == "Psychic") return Type::Psychic;
    if (str == "Bug") return Type::Bug;
    if (str == "Rock") return Type::Rock;
    if (str == "Ghost") return Type::Ghost;
    if (str == "Dragon") return Type::Dragon;
    return Type::None;
}

inline std::string_view statusToString(StatusEffect s) {
    switch (s) {
        case StatusEffect::Paralysis: return "PAR";
        case StatusEffect::Burn: return "BRN";
        case StatusEffect::Poison: return "PSN";
        case StatusEffect::Sleep: return "SLP";
        case StatusEffect::Freeze: return "FRZ";
        case StatusEffect::Confusion: return "CONF";
        default: return "NONE";
    }
}

inline StatusEffect stringToStatus(std::string_view str) {
    if (str == "Paralysis" || str == "PAR") return StatusEffect::Paralysis;
    if (str == "Burn" || str == "BRN") return StatusEffect::Burn;
    if (str == "Poison" || str == "PSN") return StatusEffect::Poison;
    if (str == "Sleep" || str == "SLP") return StatusEffect::Sleep;
    if (str == "Freeze" || str == "FRZ") return StatusEffect::Freeze;
    if (str == "Confusion" || str == "CONF") return StatusEffect::Confusion;
    return StatusEffect::None;
}

inline std::string_view statTypeToString(StatType s) {
    switch (s) {
        case StatType::Attack: return "Attack";
        case StatType::Defense: return "Defense";
        case StatType::Special: return "Special";
        case StatType::Speed: return "Speed";
        case StatType::Accuracy: return "Accuracy";
        case StatType::Evasion: return "Evasion";
    }
    return "Unknown";
}

} // namespace engine
