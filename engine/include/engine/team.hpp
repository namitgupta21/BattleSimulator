#pragma once

#include <vector>
#include <optional>
#include <stdexcept>
#include "pokemon.hpp"

namespace engine {

class Team {
public:
    Team() = default;

    explicit Team(std::vector<PokemonInstance> members)
        : m_members(std::move(members)), m_activeIdx(0) {}

    void addPokemon(PokemonInstance p) {
        if (m_members.size() < 6) {
            m_members.push_back(std::move(p));
        }
    }

    size_t size() const { return m_members.size(); }
    bool empty() const { return m_members.empty(); }

    const std::vector<PokemonInstance>& getMembers() const { return m_members; }
    std::vector<PokemonInstance>& getMembers() { return m_members; }

    int getActiveIndex() const { return m_activeIdx; }

    const PokemonInstance* getActivePokemon() const {
        if (m_activeIdx >= 0 && m_activeIdx < static_cast<int>(m_members.size())) {
            return &m_members[m_activeIdx];
        }
        return nullptr;
    }

    PokemonInstance* getActivePokemon() {
        if (m_activeIdx >= 0 && m_activeIdx < static_cast<int>(m_members.size())) {
            return &m_members[m_activeIdx];
        }
        return nullptr;
    }

    const PokemonInstance* getPokemon(size_t index) const {
        if (index < m_members.size()) return &m_members[index];
        return nullptr;
    }

    PokemonInstance* getPokemon(size_t index) {
        if (index < m_members.size()) return &m_members[index];
        return nullptr;
    }

    bool hasAlivePokemon() const {
        for (const auto& p : m_members) {
            if (!p.isFainted()) return true;
        }
        return false;
    }

    std::vector<int> getLegalSwitchIndices() const {
        std::vector<int> result;
        for (size_t i = 0; i < m_members.size(); ++i) {
            if (static_cast<int>(i) != m_activeIdx && !m_members[i].isFainted()) {
                result.push_back(static_cast<int>(i));
            }
        }
        return result;
    }

    bool canSwitchTo(int index) const {
        if (index < 0 || index >= static_cast<int>(m_members.size())) return false;
        if (index == m_activeIdx) return false;
        return !m_members[index].isFainted();
    }

    bool switchTo(int index) {
        if (!canSwitchTo(index)) return false;
        if (auto* current = getActivePokemon()) {
            current->resetStatStages();
        }
        m_activeIdx = index;
        return true;
    }

    void setActiveIndex(int idx) {
        m_activeIdx = idx;
    }

private:
    std::vector<PokemonInstance> m_members;
    int m_activeIdx{0};
};

} // namespace engine
