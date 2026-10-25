#include <iostream>
#include <string>
#include <memory>
#include <filesystem>
#include "engine/engine.hpp"
#include "engine/data_loader.hpp"
#include "engine/rng.hpp"
#include "cli/player.hpp"
#include "cli/human_player.hpp"
#include "cli/random_player.hpp"
#include "cli/renderer.hpp"

namespace fs = std::filesystem;

int main(int argc, char* argv[]) {
    uint64_t seed = 42U;
    std::string mode = "pve"; // "pvp", "pve", or "bot"
    std::string dataDir = "data";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--seed" && i + 1 < argc) {
            seed = std::stoull(argv[++i]);
        } else if (arg == "--mode" && i + 1 < argc) {
            mode = argv[++i];
        } else if (arg == "--data" && i + 1 < argc) {
            dataDir = argv[++i];
        } else if (arg == "--help") {
            std::cout << "Usage: pokemon_cli [options]\n"
                      << "  --seed <uint>   Seed for random generator (default: 42)\n"
                      << "  --mode <mode>   Game mode: 'pve' (default), 'pvp', or 'bot'\n"
                      << "  --data <path>   Path to data directory (default: 'data')\n";
            return 0;
        }
    }

    // Locate data directory if running from build/
    if (!fs::exists(dataDir + "/pokemon.json")) {
        if (fs::exists("../data/pokemon.json")) {
            dataDir = "../data";
        } else if (fs::exists("../../data/pokemon.json")) {
            dataDir = "../../data";
        }
    }

    std::cout << "============================================================\n";
    std::cout << "       POKEMON GEN 1 BATTLE ENGINE (CLI SIMULATOR)          \n";
    std::cout << "============================================================\n";
    std::cout << "Loading game data from: " << dataDir << "\n";

    auto& registry = engine::GameDataRegistry::instance();
    if (!registry.loadAll(dataDir)) {
        std::cerr << "Failed to load game data from: " << dataDir << "\n";
        return 1;
    }

    std::cout << "Loaded " << registry.getAllSpecies().size() << " species and "
              << registry.getAllMoves().size() << " moves.\n";
    std::cout << "Battle Seed: " << seed << " | Mode: " << mode << "\n";

    engine::MersenneTwisterRNG rng(seed);
    engine::BattleEngine engine(
        registry.getTypeChart(),
        std::make_shared<engine::Gen1DamageCalculator>(),
        std::make_shared<engine::MoveEffectDispatcher>()
    );

    // Setup Teams (iconic Gen 1 competitive rosters)
    engine::Team team1;
    team1.addPokemon(registry.createPokemon("snorlax", 50));
    team1.addPokemon(registry.createPokemon("alakazam", 50));
    team1.addPokemon(registry.createPokemon("tauros", 50));
    team1.addPokemon(registry.createPokemon("starmie", 50));
    team1.addPokemon(registry.createPokemon("zapdos", 50));
    team1.addPokemon(registry.createPokemon("gengar", 50));

    engine::Team team2;
    team2.addPokemon(registry.createPokemon("chansey", 50));
    team2.addPokemon(registry.createPokemon("exeggutor", 50));
    team2.addPokemon(registry.createPokemon("cloyster", 50));
    team2.addPokemon(registry.createPokemon("rhydon", 50));
    team2.addPokemon(registry.createPokemon("slowbro", 50));
    team2.addPokemon(registry.createPokemon("jolteon", 50));

    engine::BattleState state;
    state.p1Team = std::move(team1);
    state.p2Team = std::move(team2);
    state.phase = engine::BattlePhase::ActionSelection;
    state.turnNumber = 1;

    // Configure Player decision sources (IPlayer interface)
    std::unique_ptr<cli::IPlayer> p1;
    std::unique_ptr<cli::IPlayer> p2;

    if (mode == "pvp") {
        p1 = std::make_unique<cli::HumanPlayer>("Player 1");
        p2 = std::make_unique<cli::HumanPlayer>("Player 2");
    } else if (mode == "bot") {
        p1 = std::make_unique<cli::RandomPlayer>(rng, "Bot 1");
        p2 = std::make_unique<cli::RandomPlayer>(rng, "Bot 2");
    } else { // default: pve
        p1 = std::make_unique<cli::HumanPlayer>("Player 1");
        p2 = std::make_unique<cli::RandomPlayer>(rng, "Rival Bot");
    }

    std::cout << "\nBattle started between Player 1 (" 
              << state.getActivePokemon(engine::PlayerSide::Player1)->getName() 
              << ") and Player 2 (" 
              << state.getActivePokemon(engine::PlayerSide::Player2)->getName() << ")!\n";

    // Main Game Loop
    while (!state.isGameOver()) {
        if (state.phase == engine::BattlePhase::ActionSelection) {
            cli::Renderer::renderBattleState(state);

            auto acts1 = engine.getLegalActions(state, engine::PlayerSide::Player1);
            auto acts2 = engine.getLegalActions(state, engine::PlayerSide::Player2);

            auto a1 = p1->chooseAction(state, engine::PlayerSide::Player1, acts1);
            auto a2 = p2->chooseAction(state, engine::PlayerSide::Player2, acts2);

            auto result = engine.step(state, a1, a2, rng);
            cli::Renderer::renderEvents(result.events);
            state = result.nextState;

        } else if (state.phase == engine::BattlePhase::ForcedSwitchP1) {
            auto switches = engine.getLegalSwitches(state, engine::PlayerSide::Player1);
            auto a1 = p1->chooseForcedSwitch(state, engine::PlayerSide::Player1, switches);

            auto result = engine.resolveForcedSwitches(state, a1, std::nullopt, rng);
            cli::Renderer::renderEvents(result.events);
            state = result.nextState;

        } else if (state.phase == engine::BattlePhase::ForcedSwitchP2) {
            auto switches = engine.getLegalSwitches(state, engine::PlayerSide::Player2);
            auto a2 = p2->chooseForcedSwitch(state, engine::PlayerSide::Player2, switches);

            auto result = engine.resolveForcedSwitches(state, std::nullopt, a2, rng);
            cli::Renderer::renderEvents(result.events);
            state = result.nextState;

        } else if (state.phase == engine::BattlePhase::ForcedSwitchBoth) {
            auto switches1 = engine.getLegalSwitches(state, engine::PlayerSide::Player1);
            auto switches2 = engine.getLegalSwitches(state, engine::PlayerSide::Player2);

            auto a1 = p1->chooseForcedSwitch(state, engine::PlayerSide::Player1, switches1);
            auto a2 = p2->chooseForcedSwitch(state, engine::PlayerSide::Player2, switches2);

            auto result = engine.resolveForcedSwitches(state, a1, a2, rng);
            cli::Renderer::renderEvents(result.events);
            state = result.nextState;
        }
    }

    return 0;
}
