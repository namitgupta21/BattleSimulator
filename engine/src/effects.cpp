#include "engine/effects.hpp"
#include <algorithm>

namespace engine {

namespace {

class DamageEffectHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::Damage; }

    void execute(const MoveEffect&, EffectContext& ctx) override {
        if (ctx.damageResult.damage <= 0) return;

        ctx.defender.takeDamage(ctx.damageResult.damage);
        ctx.eventLog.push_back(BattleEvent::damageDealt(
            ctx.defenderSide,
            ctx.defender.getName(),
            ctx.damageResult.damage,
            ctx.defender.getCurrentHp(),
            ctx.defender.getMaxHp()
        ));

        if (ctx.defender.isFainted()) {
            ctx.eventLog.push_back(BattleEvent::fainted(ctx.defenderSide, ctx.defender.getName()));
        }
    }
};

class SetDamageLevelHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::SetDamageLevel; }

    void execute(const MoveEffect&, EffectContext& ctx) override {
        int dmg = ctx.attacker.getLevel();
        ctx.defender.takeDamage(dmg);
        ctx.eventLog.push_back(BattleEvent::damageDealt(
            ctx.defenderSide,
            ctx.defender.getName(),
            dmg,
            ctx.defender.getCurrentHp(),
            ctx.defender.getMaxHp()
        ));

        if (ctx.defender.isFainted()) {
            ctx.eventLog.push_back(BattleEvent::fainted(ctx.defenderSide, ctx.defender.getName()));
        }
    }
};

class ApplyStatusEffectHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::ApplyStatus; }

    void execute(const MoveEffect& effect, EffectContext& ctx) override {
        if (!ctx.rng.rollPercent(effect.chancePercent)) return;

        PokemonInstance& target = effect.targetSelf ? ctx.attacker : ctx.defender;
        PlayerSide targetSide = effect.targetSelf ? ctx.attackerSide : ctx.defenderSide;

        if (target.isFainted() || target.getStatus() != StatusEffect::None) return;

        // Gen 1 type immunities to status
        if (effect.status == StatusEffect::Burn) {
            for (Type t : target.getTypes()) {
                if (t == Type::Fire) return; // Fire cannot be burned
            }
        } else if (effect.status == StatusEffect::Poison) {
            for (Type t : target.getTypes()) {
                if (t == Type::Poison) return; // Poison cannot be poisoned
            }
        } else if (effect.status == StatusEffect::Freeze) {
            for (Type t : target.getTypes()) {
                if (t == Type::Ice) return; // Ice cannot be frozen in Gen 1
            }
        }

        // Gen 1 sleep lasts 1 to 7 turns
        int sleepDuration = 0;
        if (effect.status == StatusEffect::Sleep) {
            sleepDuration = ctx.rng.nextInt(1, 7);
        }

        if (target.applyStatus(effect.status, sleepDuration)) {
            ctx.eventLog.push_back(BattleEvent::statusApplied(targetSide, target.getName(), effect.status));
        }
    }
};

class ChangeStatStageEffectHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::ChangeStatStage; }

    void execute(const MoveEffect& effect, EffectContext& ctx) override {
        if (!ctx.rng.rollPercent(effect.chancePercent)) return;

        PokemonInstance& target = effect.targetSelf ? ctx.attacker : ctx.defender;
        PlayerSide targetSide = effect.targetSelf ? ctx.attackerSide : ctx.defenderSide;

        if (target.isFainted()) return;

        int actual = target.getStatStages().modify(effect.targetStat, effect.value);
        int newStage = target.getStatStages().get(effect.targetStat);

        ctx.eventLog.push_back(BattleEvent::statStageChanged(
            targetSide,
            target.getName(),
            effect.targetStat,
            actual,
            newStage
        ));
    }
};

class HealFractionEffectHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::HealFraction; }

    void execute(const MoveEffect& effect, EffectContext& ctx) override {
        PokemonInstance& target = effect.targetSelf ? ctx.attacker : ctx.defender;
        PlayerSide targetSide = effect.targetSelf ? ctx.attackerSide : ctx.defenderSide;

        if (target.isFainted()) return;

        int healAmount = 0;
        if (ctx.damageResult.damage > 0) {
            // Drain move (e.g. Mega Drain: drains 50% of damage dealt)
            healAmount = std::max(1, (ctx.damageResult.damage * effect.value) / 100);
        } else {
            // Direct heal move (e.g. Recover: heals 50% of max HP)
            healAmount = (target.getMaxHp() * effect.value) / 100;
        }

        int actual = target.heal(healAmount);
        ctx.eventLog.push_back(BattleEvent::pokemonHealed(
            targetSide,
            target.getName(),
            actual,
            target.getCurrentHp(),
            target.getMaxHp()
        ));
    }
};

class RecoilFractionEffectHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::RecoilFraction; }

    void execute(const MoveEffect& effect, EffectContext& ctx) override {
        if (ctx.damageResult.damage <= 0) return;

        int recoil = std::max(1, (ctx.damageResult.damage * effect.value) / 100);
        ctx.attacker.takeDamage(recoil);

        ctx.eventLog.push_back(BattleEvent::damageDealt(
            ctx.attackerSide,
            ctx.attacker.getName(),
            recoil,
            ctx.attacker.getCurrentHp(),
            ctx.attacker.getMaxHp()
        ));

        if (ctx.attacker.isFainted()) {
            ctx.eventLog.push_back(BattleEvent::fainted(ctx.attackerSide, ctx.attacker.getName()));
        }
    }
};

class SelfFaintEffectHandler : public IMoveEffectHandler {
public:
    EffectType getType() const override { return EffectType::SelfFaint; }

    void execute(const MoveEffect&, EffectContext& ctx) override {
        ctx.attacker.takeDamage(ctx.attacker.getCurrentHp());
        ctx.eventLog.push_back(BattleEvent::fainted(ctx.attackerSide, ctx.attacker.getName()));
    }
};

} // anonymous namespace

MoveEffectDispatcher::MoveEffectDispatcher() {
    registerHandler(std::make_unique<DamageEffectHandler>());
    registerHandler(std::make_unique<SetDamageLevelHandler>());
    registerHandler(std::make_unique<ApplyStatusEffectHandler>());
    registerHandler(std::make_unique<ChangeStatStageEffectHandler>());
    registerHandler(std::make_unique<HealFractionEffectHandler>());
    registerHandler(std::make_unique<RecoilFractionEffectHandler>());
    registerHandler(std::make_unique<SelfFaintEffectHandler>());
}

void MoveEffectDispatcher::registerHandler(std::unique_ptr<IMoveEffectHandler> handler) {
    if (handler) {
        m_handlers[static_cast<int>(handler->getType())] = std::move(handler);
    }
}

void MoveEffectDispatcher::dispatch(const MoveEffect& effect, EffectContext& ctx) const {
    auto it = m_handlers.find(static_cast<int>(effect.type));
    if (it != m_handlers.end()) {
        it->second->execute(effect, ctx);
    }
}

} // namespace engine
