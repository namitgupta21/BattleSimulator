#pragma once

#include <cstdint>
#include <random>
#include <vector>
#include <queue>

namespace engine {

/**
 * @brief Interface for seedable random number generation.
 * Follows Dependency Inversion Principle (DIP) so BattleEngine depends on an abstraction.
 */
class IRandomGenerator {
public:
    virtual ~IRandomGenerator() = default;

    /// Generates a random integer in [min, max] inclusive
    virtual uint32_t nextInt(uint32_t min, uint32_t max) = 0;

    /// Rolls a probability check [1, 100], returns true if <= percent
    virtual bool rollPercent(int percent) = 0;

    /// Generates a random double in [0.0, 1.0)
    virtual double nextDouble() = 0;
};

/**
 * @brief Standard seedable Mersenne Twister RNG implementation.
 * 
 * 🥚 Easter Egg: Named after the 24th Mersenne prime (2^19937 - 1) and Matsumoto &
 * Nishimura's 1997 matrix-twisting algorithm. Its period of ~4.3 x 10^6001 rolls has
 * vastly more states than the number of atoms in the observable universe!
 */
class MersenneTwisterRNG : public IRandomGenerator {
public:
    explicit MersenneTwisterRNG(uint64_t seed = 5489U)
        : m_seed(seed), m_rng(seed) {}

    void reseed(uint64_t seed) {
        m_seed = seed;
        m_rng.seed(seed);
    }

    uint64_t getSeed() const { return m_seed; }

    uint32_t nextInt(uint32_t min, uint32_t max) override {
        if (min >= max) return min;
        std::uniform_int_distribution<uint32_t> dist(min, max);
        return dist(m_rng);
    }

    bool rollPercent(int percent) override {
        if (percent <= 0) return false;
        if (percent >= 100) return true;
        return nextInt(1, 100) <= static_cast<uint32_t>(percent);
    }

    double nextDouble() override {
        std::uniform_real_distribution<double> dist(0.0, 1.0);
        return dist(m_rng);
    }

private:
    uint64_t m_seed;
    std::mt19937 m_rng;
};

/**
 * @brief Deterministic mock RNG for unit testing exact rolls without randomness.
 */
class MockRNG : public IRandomGenerator {
public:
    void queueInt(uint32_t val) { m_ints.push(val); }
    void queueBool(bool val) { m_bools.push(val); }

    uint32_t nextInt(uint32_t min, uint32_t max) override {
        if (!m_ints.empty()) {
            uint32_t v = m_ints.front();
            m_ints.pop();
            return v;
        }
        return min;
    }

    bool rollPercent(int percent) override {
        if (!m_bools.empty()) {
            bool v = m_bools.front();
            m_bools.pop();
            return v;
        }
        return percent >= 100;
    }

    double nextDouble() override {
        return 0.0;
    }

private:
    std::queue<uint32_t> m_ints;
    std::queue<bool> m_bools;
};

} // namespace engine
