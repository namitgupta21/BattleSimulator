#pragma once

#include <string>
#include <vector>
#include "types.hpp"

namespace engine {

enum class EffectType {
    Damage,
    ApplyStatus,
    ChangeStatStage,
    HealFraction,
    RecoilFraction,
    SetDamageLevel,
    SelfFaint
};

struct MoveEffect {
    EffectType type{EffectType::Damage};
    int value{0};                              // Stage delta (+2, -1), or percentage (e.g., 50 for 50% heal)
    StatusEffect status{StatusEffect::None};
    int chancePercent{100};                    // Probability [1, 100]
    StatType targetStat{StatType::Attack};
    bool targetSelf{false};
};

struct MoveDefinition {
    std::string id;
    std::string name;
    Type type{Type::Normal};
    MoveCategory category{MoveCategory::Physical};
    int basePower{0};
    int accuracy{100};                         // 1-100 base accuracy
    int pp{0};
    int priority{0};                           // Gen 1: Quick Attack = +1, others = 0
    bool highCrit{false};                      // High crit ratio (Slash, Razor Leaf)
    std::vector<MoveEffect> effects;
};

struct MoveInstance {
    const MoveDefinition* def{nullptr};
    int currentPp{0};
    int maxPp{0};

    bool hasPp() const { return currentPp > 0; }
    void deductPp() { if (currentPp > 0) currentPp--; }
};

} // namespace engine
