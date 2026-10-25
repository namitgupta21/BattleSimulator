#pragma once

#include <vector>
#include <unordered_map>
#include "types.hpp"

namespace engine {

/**
 * @brief Interface for Type Effectiveness calculations (DIP).
 */
class ITypeChart {
public:
    virtual ~ITypeChart() = default;
    virtual double getEffectiveness(Type attackType, Type defenderType) const = 0;
    virtual double getMultiplier(Type attackType, const std::vector<Type>& defenderTypes) const = 0;
};

/**
 * @brief Faithful Gen 1 Type Effectiveness implementation.
 */
class Gen1TypeChart : public ITypeChart {
public:
    Gen1TypeChart();

    double getEffectiveness(Type attackType, Type defenderType) const override;
    double getMultiplier(Type attackType, const std::vector<Type>& defenderTypes) const override;

    void setEffectiveness(Type attackType, Type defenderType, double mult);

private:
    // 16x16 matrix (Type count <= 16)
    static constexpr size_t NUM_TYPES = 16;
    double m_matrix[NUM_TYPES][NUM_TYPES];

    void initializeDefaults();
};

} // namespace engine
