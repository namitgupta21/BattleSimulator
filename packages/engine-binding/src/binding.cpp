#include <napi.h>
#include <string>
#include <vector>
#include <memory>
#include <optional>

#include "engine/engine.hpp"
#include "engine/data_loader.hpp"
#include "engine/team_generator.hpp"
#include "engine/serializer.hpp"
#include "engine/rng.hpp"

namespace {

engine::BattleAction parseAction(const Napi::Value& val) {
    engine::BattleAction act;
    if (val.IsObject()) {
        Napi::Object obj = val.As<Napi::Object>();
        std::string typeStr = obj.Get("type").As<Napi::String>().Utf8Value();
        int idx = obj.Get("index").As<Napi::Number>().Int32Value();
        act.type = (typeStr == "Switch") ? engine::ActionType::Switch : engine::ActionType::Move;
        act.index = idx;
    }
    return act;
}

Napi::Array actionsToArray(napi_env env, const std::vector<engine::BattleAction>& actions) {
    Napi::Array arr = Napi::Array::New(env, actions.size());
    for (size_t i = 0; i < actions.size(); ++i) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("type", Napi::String::New(env, actions[i].type == engine::ActionType::Switch ? "Switch" : "Move"));
        obj.Set("index", Napi::Number::New(env, actions[i].index));
        arr.Set(i, obj);
    }
    return arr;
}

class BattleSessionWrap : public Napi::ObjectWrap<BattleSessionWrap> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    BattleSessionWrap(const Napi::CallbackInfo& info);

private:
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value GetLegalActions(const Napi::CallbackInfo& info);
    Napi::Value GetLegalSwitches(const Napi::CallbackInfo& info);
    Napi::Value Step(const Napi::CallbackInfo& info);
    Napi::Value ResolveForcedSwitches(const Napi::CallbackInfo& info);
    Napi::Value IsEngineTimerEnabled(const Napi::CallbackInfo& info);
    Napi::Value IsGameOver(const Napi::CallbackInfo& info);
    Napi::Value GetWinner(const Napi::CallbackInfo& info);

    engine::BattleEngine m_engine;
    engine::BattleState m_state;
    engine::MersenneTwisterRNG m_rng;
};

Napi::Object BattleSessionWrap::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "BattleSessionWrap", {
        InstanceMethod("getState", &BattleSessionWrap::GetState),
        InstanceMethod("getLegalActions", &BattleSessionWrap::GetLegalActions),
        InstanceMethod("getLegalSwitches", &BattleSessionWrap::GetLegalSwitches),
        InstanceMethod("step", &BattleSessionWrap::Step),
        InstanceMethod("resolveForcedSwitches", &BattleSessionWrap::ResolveForcedSwitches),
        InstanceMethod("isEngineTimerEnabled", &BattleSessionWrap::IsEngineTimerEnabled),
        InstanceMethod("isGameOver", &BattleSessionWrap::IsGameOver),
        InstanceMethod("getWinner", &BattleSessionWrap::GetWinner),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    return exports;
}

BattleSessionWrap::BattleSessionWrap(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<BattleSessionWrap>(info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected (seed: number, team1Json: string, team2Json: string)").ThrowAsJavaScriptException();
        return;
    }

    uint64_t seed = static_cast<uint64_t>(info[0].As<Napi::Number>().Int64Value());
    std::string team1Json = info[1].As<Napi::String>().Utf8Value();
    std::string team2Json = info[2].As<Napi::String>().Utf8Value();

    m_rng.reseed(seed);
    m_state.turnNumber = 1;
    m_state.phase = engine::BattlePhase::ActionSelection;
    m_state.p1Team = engine::BattleSerializer::jsonToTeam(team1Json, engine::GameDataRegistry::instance());
    m_state.p2Team = engine::BattleSerializer::jsonToTeam(team2Json, engine::GameDataRegistry::instance());
}

Napi::Value BattleSessionWrap::GetState(const Napi::CallbackInfo& info) {
    std::string jsonStr = engine::BattleSerializer::stateToJson(m_state);
    return Napi::String::New(info.Env(), jsonStr);
}

Napi::Value BattleSessionWrap::GetLegalActions(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        return Napi::Array::New(env, 0);
    }
    std::string sideStr = info[0].As<Napi::String>().Utf8Value();
    engine::PlayerSide side = (sideStr == "Player2") ? engine::PlayerSide::Player2 : engine::PlayerSide::Player1;
    auto actions = m_engine.getLegalActions(m_state, side);
    return actionsToArray(env, actions);
}

Napi::Value BattleSessionWrap::GetLegalSwitches(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        return Napi::Array::New(env, 0);
    }
    std::string sideStr = info[0].As<Napi::String>().Utf8Value();
    engine::PlayerSide side = (sideStr == "Player2") ? engine::PlayerSide::Player2 : engine::PlayerSide::Player1;
    auto actions = m_engine.getLegalSwitches(m_state, side);
    return actionsToArray(env, actions);
}

Napi::Value BattleSessionWrap::Step(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected action1 and action2").ThrowAsJavaScriptException();
        return env.Null();
    }

    engine::BattleAction a1 = parseAction(info[0]);
    engine::BattleAction a2 = parseAction(info[1]);

    auto result = m_engine.step(m_state, a1, a2, m_rng);
    m_state = result.nextState;

    Napi::Object out = Napi::Object::New(env);
    out.Set("nextStateJson", Napi::String::New(env, engine::BattleSerializer::stateToJson(m_state)));
    out.Set("eventsJson", Napi::String::New(env, engine::BattleSerializer::eventsToJson(result.events)));
    return out;
}

Napi::Value BattleSessionWrap::ResolveForcedSwitches(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::optional<engine::BattleAction> optP1 = std::nullopt;
    std::optional<engine::BattleAction> optP2 = std::nullopt;

    if (info.Length() > 0 && !info[0].IsNull() && !info[0].IsUndefined()) {
        optP1 = parseAction(info[0]);
    }
    if (info.Length() > 1 && !info[1].IsNull() && !info[1].IsUndefined()) {
        optP2 = parseAction(info[1]);
    }

    auto result = m_engine.resolveForcedSwitches(m_state, optP1, optP2, m_rng);
    m_state = result.nextState;

    Napi::Object out = Napi::Object::New(env);
    out.Set("nextStateJson", Napi::String::New(env, engine::BattleSerializer::stateToJson(m_state)));
    out.Set("eventsJson", Napi::String::New(env, engine::BattleSerializer::eventsToJson(result.events)));
    return out;
}

Napi::Value BattleSessionWrap::IsEngineTimerEnabled(const Napi::CallbackInfo& info) {
    // By architecture and contract, the engine created through the adapter factory
    // never enables or executes any wall-clock timer. The server owns the clock.
    return Napi::Boolean::New(info.Env(), false);
}

Napi::Value BattleSessionWrap::IsGameOver(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), m_state.isGameOver());
}

Napi::Value BattleSessionWrap::GetWinner(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (m_state.winner.has_value()) {
        std::string win = (m_state.winner.value() == engine::PlayerSide::Player1) ? "Player1" : "Player2";
        return Napi::String::New(env, win);
    }
    return env.Null();
}

Napi::Value LoadData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string dataDir = "./data";
    if (info.Length() > 0 && info[0].IsString()) {
        dataDir = info[0].As<Napi::String>().Utf8Value();
    }
    bool success = engine::GameDataRegistry::instance().loadAll(dataDir);
    return Napi::Boolean::New(env, success);
}

Napi::Value GenerateTeam(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected (seed: number, teamSize: number, [level: number])").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint64_t seed = static_cast<uint64_t>(info[0].As<Napi::Number>().Int64Value());
    size_t teamSize = static_cast<size_t>(info[1].As<Napi::Number>().Int32Value());
    int level = (info.Length() >= 3 && info[2].IsNumber()) ? info[2].As<Napi::Number>().Int32Value() : 50;

    auto team = engine::TeamGenerator::generate(seed, teamSize, engine::GameDataRegistry::instance(), level);
    std::string teamJson = engine::BattleSerializer::teamToJson(team);
    return Napi::String::New(env, teamJson);
}

Napi::Value CreateBattle(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected (seed: number, team1Json: string, team2Json: string)").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::FunctionReference* constructor = env.GetInstanceData<Napi::FunctionReference>();
    if (!constructor) {
        Napi::Error::New(env, "BattleSession constructor not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object instance = constructor->New({ info[0], info[1], info[2] });
    return instance;
}

} // anonymous namespace

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    BattleSessionWrap::Init(env, exports);
    exports.Set("loadData", Napi::Function::New(env, LoadData));
    exports.Set("generateTeam", Napi::Function::New(env, GenerateTeam));
    exports.Set("createBattle", Napi::Function::New(env, CreateBattle));
    return exports;
}

NODE_API_MODULE(pokemon_engine_binding, InitAll)
