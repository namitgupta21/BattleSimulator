#include "engine/team_generator.hpp"
#include "engine/rng.hpp"
#include <algorithm>
#include <stdexcept>
#include <unordered_set>

namespace engine {

namespace {

bool isDamagingMove(const MoveDefinition* def) {
    if (!def) return false;
    if (def->basePower > 0) return true;
    for (const auto& eff : def->effects) {
        if (eff.type == EffectType::SetDamageLevel) return true;
    }
    return false;
}

bool isStab(const MoveDefinition* def, const SpeciesDefinition* sp) {
    if (!def || !sp) return false;
    for (Type t : sp->types) {
        if (t == def->type) return true;
    }
    return false;
}

int getMoveWeight(const MoveDefinition* def, const SpeciesDefinition* sp) {
    if (isDamagingMove(def)) {
        return isStab(def, sp) ? 3 : 2;
    }
    return 1;
}

const MoveDefinition* sampleWeightedMove(
    const std::vector<const MoveDefinition*>& candidates,
    const SpeciesDefinition* sp,
    IRandomGenerator& rng
) {
    if (candidates.empty()) return nullptr;
    if (candidates.size() == 1) return candidates[0];

    int totalWeight = 0;
    for (const auto* m : candidates) {
        totalWeight += getMoveWeight(m, sp);
    }

    int roll = rng.nextInt(1, totalWeight);
    int current = 0;
    for (const auto* m : candidates) {
        current += getMoveWeight(m, sp);
        if (roll <= current) {
            return m;
        }
    }
    return candidates.back();
}

} // anonymous namespace

Team TeamGenerator::generate(
    uint64_t seed,
    size_t teamSize,
    const IDataProvider& provider,
    int level
) {
    MersenneTwisterRNG rng(seed);
    Team team;

    std::vector<std::string> allSpecies = provider.getAllSpeciesIds();
    if (allSpecies.empty()) {
        throw std::runtime_error("No species available in data provider.");
    }

    // Filter valid species that have at least one usable damaging move
    std::vector<std::string> validSpecies;
    for (const auto& spId : allSpecies) {
        const auto* sp = provider.getSpecies(spId);
        if (!sp) continue;

        bool hasDmg = false;
        const auto& movePool = !sp->learnset.empty() ? sp->learnset : sp->defaultMoves;
        for (const auto& mId : movePool) {
            const auto* mDef = provider.getMove(mId);
            if (isDamagingMove(mDef)) {
                hasDmg = true;
                break;
            }
        }
        if (hasDmg) {
            validSpecies.push_back(spId);
        }
    }

    if (validSpecies.empty()) {
        throw std::runtime_error("No valid species with damaging moves found.");
    }

    size_t actualCount = std::min(teamSize, validSpecies.size());

    // Deterministic Fisher-Yates partial shuffle
    for (size_t i = 0; i < actualCount; ++i) {
        int swapIdx = rng.nextInt(static_cast<int>(i), static_cast<int>(validSpecies.size() - 1));
        std::swap(validSpecies[i], validSpecies[swapIdx]);
    }

    for (size_t i = 0; i < actualCount; ++i) {
        const std::string& spId = validSpecies[i];
        const auto* sp = provider.getSpecies(spId);
        PokemonInstance inst(*sp, level);

        const auto& rawPool = !sp->learnset.empty() ? sp->learnset : sp->defaultMoves;
        std::vector<const MoveDefinition*> availableMoves;
        std::vector<const MoveDefinition*> damagingMoves;

        for (const auto& mId : rawPool) {
            const auto* mDef = provider.getMove(mId);
            if (mDef) {
                availableMoves.push_back(mDef);
                if (isDamagingMove(mDef)) {
                    damagingMoves.push_back(mDef);
                }
            }
        }

        std::vector<const MoveDefinition*> chosenMoves;

        if (availableMoves.size() <= 4) {
            chosenMoves = availableMoves;
        } else {
            // Guarantee at least 1 damaging move
            const auto* firstDmg = sampleWeightedMove(damagingMoves, sp, rng);
            if (firstDmg) {
                chosenMoves.push_back(firstDmg);
            }

            // Remove already chosen from available
            std::vector<const MoveDefinition*> remaining;
            for (const auto* m : availableMoves) {
                if (m != firstDmg) {
                    remaining.push_back(m);
                }
            }

            while (chosenMoves.size() < 4 && !remaining.empty()) {
                const auto* nextM = sampleWeightedMove(remaining, sp, rng);
                if (!nextM) break;
                chosenMoves.push_back(nextM);
                remaining.erase(std::remove(remaining.begin(), remaining.end(), nextM), remaining.end());
            }
        }

        for (const auto* mDef : chosenMoves) {
            inst.addMove(mDef);
        }

        team.addPokemon(inst);
    }

    return team;
}

} // namespace engine

