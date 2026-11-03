# BattleSimulator Monorepo

[![CI](https://github.com/namitgupta21/BattleSimulator/actions/workflows/ci.yml/badge.svg)](https://github.com/namitgupta21/BattleSimulator/actions/workflows/ci.yml)
![C++17](https://img.shields.io/badge/Language-C%2B%2B17-blue.svg?logo=cplusplus)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Platform-Node.js%2022+-green.svg?logo=node.js)
![CMake](https://img.shields.io/badge/Build-CMake%203.16+-orange.svg?logo=cmake)
![Tests](https://img.shields.io/badge/Tests-CTest%20%26%20Node%20(45%2F45%20Passed)-brightgreen.svg)
![Platforms](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

A high-performance monorepo containing a pure, deterministic Generation 1 Pokémon battle simulation engine in **C++17**, an interactive terminal CLI, and an authoritative **Node.js + TypeScript + Socket.IO** multiplayer server with N-API native bindings.

Engineered following strict **SOLID design principles**, the C++ core simulation logic is 100% decoupled from wall-clock time, filesystems, and presentation layers. It operates as a pure state-transition function:

$$\text{step}(S_t, A_1, A_2, \text{RNG}) \longrightarrow (S_{t+1}, \vec{E})$$

---

## 🏗️ Monorepo Architecture & Layout

```text
├── engine/                     # Core C++17 battle simulation library (pure, functional, deterministic)
├── apps/
│   ├── cli/                    # Standalone interactive terminal client with countdown timers
│   └── server/                 # Authoritative Node.js + TypeScript + Socket.IO multiplayer server
├── packages/
│   ├── protocol/               # Shared TypeScript domain types and Zod runtime validation schemas
│   └── engine-binding/         # N-API native C++ binding (node-addon-api) and TypeScript EngineAdapter
├── data/                       # Gen 1 JSON data files (species, moves, type chart)
├── tools/                      # Offline data extraction & ingestion pipelines (PokeAPI v2)
├── tests/                      # C++ unit tests (GoogleTest, 22 test suites)
└── docs/                       # Architecture diagrams and ROADMAP.md
```

---

## ⚡ Key Features

* **Authentic Gen 1 Mechanics**: Speed-based critical hits, unified Special stat, retro-typings, faithful type-matchup quirks (Psychic immune to Ghost; Bug/Poison mutually super-effective), and Gen 1 sleep/paralysis/freeze rules.
* **Full 151 Pokémon Roster**: Supports all 151 Gen 1 Pokémon and over 100 combat moves normalized directly from PokeAPI v2 without runtime API dependencies.
* **Authoritative Multiplayer Server**: Room lifecycle management, 2-player matchmaking by 6-character room codes, simultaneous action resolution, and rate-limiting.
* **Server-Owned Move Clock**: Fixed 90-second turn decision timer with automatic timeout forfeiture. Pure engine core runs completely free of wall-clock time.
* **Strict Fog of War**: The server never transmits private opponent information (exact HP, bench species, unrevealed moves). Clients receive only HP percentage and moves revealed in combat.
* **Resilient Reconnections**: App-level session tokens allow disconnected players to reconnect within a 30-second grace period while the turn clock keeps ticking.
* **Pure Determinism & Seeded Replays**: Bit-for-bit reproducible battles using Mersenne Twister RNG (`std::mt19937`). Any battle can be replayed identically from the server replay log.
* **Zero Engine Dependencies**: The engine core compiles without external networking or UI libraries.

---

## 💻 Prerequisites & System Setup

To build and run this project on any machine, ensure you have a modern **C++17 compiler**, **CMake 3.16+**, and **Python 3.8+** (for the optional data pipeline).

### 🪟 Windows
1. **Compiler**: Install [Visual Studio 2022](https://visualstudio.microsoft.com/) (select **"Desktop development with C++"**) **OR** install [MinGW-w64](https://www.mingw-w64.org/) / [MSYS2](https://www.msys2.org/).
2. **CMake**: Install [CMake](https://cmake.org/download/) (select *"Add CMake to the system PATH"*).
3. **Git**: Install [Git for Windows](https://git-scm.com/).
4. **Python**: Install [Python 3.10+](https://www.python.org/downloads/) (check *"Add Python to PATH"*).

### 🐧 Ubuntu / Debian Linux
Run the following in your terminal:
```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake ninja-build g++ git python3 python3-pip
```

### 🍎 macOS
Using [Homebrew](https://brew.sh/):
```bash
brew install cmake ninja git python3
# Xcode Command Line Tools provide Clang with C++17 support:
xcode-select --install
```

---

## 🚀 Building and Running

### 1. C++ Engine & Standalone CLI
To build the standalone C++ simulation engine, CLI, and GoogleTest suite:
```bash
# Configure build directory in Release mode
cmake -B build -DCMAKE_BUILD_TYPE=Release

# Compile C++ engine, CLI, and test suite
cmake --build build --config Release

# Run C++ unit tests
ctest --test-dir build --output-on-failure

# Launch the interactive CLI
./build/apps/cli/pokemon_cli
```
*(On Windows, run `.\build\apps\cli\pokemon_cli.exe`). See [`apps/cli/README.md`](apps/cli/README.md) for full CLI documentation and options.*

### 2. Node.js Authoritative Multiplayer Server
The server is written in TypeScript and runs on Node.js 22+ using native N-API bindings to the C++ battle engine:
```bash
# Install all monorepo workspace dependencies
npm install

# Build C++ native addon and TypeScript packages
npm run build

# Run all TypeScript test suites (protocol, native adapter, server, integration)
npm test

# Start the multiplayer server (defaults to port 3000)
npm start --workspace=@pokemon/server
```

### 3. Running with Docker
A multi-stage Dockerfile builds the C++ engine binding and runs the lightweight server image:
```bash
# Build Docker image
docker build -t pokemon-battle-server .

# Run container exposing port 3000
docker run -p 3000:3000 pokemon-battle-server
```

### 4. Deterministic Battle Replay System
Every battle executed on either the CLI or multiplayer server is bit-for-bit deterministic:
* **In CLI**: Replay any game identically using `--seed <seed_number>`:
  ```bash
  ./build/apps/cli/pokemon_cli --seed 42 --mode bot
  ```
* **On Server**: The server records the RNG seed, teams, and turn-by-turn action log for every match. Fetch the full deterministic replay via HTTP:
  ```bash
  curl http://localhost:3000/replay/<battleId>
  ```
  The returned replay record can be fed into `adapter.createBattle(record.seed, record.p1Team, record.p2Team)` to simulate and verify identical battle progression.

---

## 🎮 CLI Command Reference

The executable supports comprehensive command-line flags:

```bash
pokemon_cli [options]
```

| Flag | Parameter | Default | Description |
| :--- | :--- | :--- | :--- |
| `--mode` | `pve` \| `pvp` \| `bot` | `pve` | **pve**: Human vs Bot.<br>**pvp**: Local 2-Player Hotseat.<br>**bot**: Automated Bot vs Bot simulation. |
| `--timer`, `-t` | *None* | `OFF` | Enables the battle turn timer (default: 90 seconds / 1.5 min per move). |
| `--no-timer` | *None* | `ON` | Explicitly disables the turn timer (prompt will not appear). |
| `--turn-time` | `<seconds>` | `90` | Sets a custom turn duration in seconds (e.g., `--turn-time 30` automatically enables the timer). |
| `--seed` | `<uint64>` | Random | Sets the master RNG seed for deterministic battle replays and roster generation. |
| `--team-seed` | `<uint64>` | `seed` | Overrides the RNG seed specifically for roster generation while rolling fresh in-battle RNG. |
| `--preset` | *None* | `false` | Uses iconic classic competitive teams (Snorlax, Alakazam, Tauros, Starmie, Zapdos, Gengar) instead of randomized rosters. |
| `--random` | *None* | `true` | Uses the deterministic TeamGenerator to build random legal teams. |
| `--data` | `<path>` | `data` | Custom path to the directory containing `pokemon.json`, `moves.json`, and `type_chart.json`. |
| `--help` | *None* | — | Displays the help and usage menu. |

### Example Invocations

```bash
# 1. Standard game with 1.5-minute turn timer
./build/apps/cli/pokemon_cli --timer

# 2. Fast blitz game with a 15-second timer per move
./build/apps/cli/pokemon_cli --turn-time 15

# 3. Two-player hotseat match with iconic classic Gen 1 teams
./build/apps/cli/pokemon_cli --mode pvp --preset

# 4. Headless Bot-vs-Bot simulation with an exact replay seed
./build/apps/cli/pokemon_cli --mode bot --seed 1259288583660435056

# 5. Play with the exact same Pokémon rosters but roll fresh battle RNG
./build/apps/cli/pokemon_cli --team-seed 1259288583660435056
```

---

## 📐 Low-Level Design (LLD)

### 1. Component Architecture
The system is divided into three isolated layers: **Offline Data Pipeline**, **Pure Engine Core**, and **Presentation/CLI**.

```mermaid
flowchart TD
    subgraph Pipeline ["Offline Pipeline (tools/ & data/)"]
        PokeAPI["PokeAPI v2 (REST)"] -->|"Cached JSON"| Fetcher["fetch_data.py"]
        Fetcher -->|"Filters & Retypings"| DataFiles["data/pokemon.json<br/>data/moves.json<br/>data/type_chart.json"]
    end

    subgraph Core ["Engine Core (engine/) [Pure C++17, Zero Wall-Clock]"]
        DataFiles --> LocalProvider["LocalJsonProvider"]
        LocalProvider -.->|"implements"| IDataProvider["IDataProvider"]
        IDataProvider --> Registry["GameDataRegistry"]
        Registry --> TeamGen["TeamGenerator (Deterministic)"]
        
        State["BattleState (Immutable Snapshot)"] --> BattleEngine["BattleEngine::step()"]
        ActionP1["BattleAction (P1)"] --> BattleEngine
        ActionP2["BattleAction (P2)"] --> BattleEngine
        RNG["MersenneTwisterRNG"] -.->|"implements"| IRandom["IRandomGenerator"]
        IRandom --> BattleEngine
        
        BattleEngine --> DamageCalc["Gen1DamageCalculator"]
        BattleEngine --> Effects["MoveEffectDispatcher"]
        BattleEngine --> StepRes["StepResult { nextState, events }"]
    end

    subgraph Presentation ["Presentation & Player Layer (cli/)"]
        StepRes --> Renderer["cli::Renderer (ASCII & ANSI Colors)"]
        TimedInput["cli::TimedInput (Async Thread + Warnings)"] --> HumanPlayer["cli::HumanPlayer"]
        IRandom --> RandomPlayer["cli::RandomPlayer (Bot AI)"]
        HumanPlayer -.->|"implements"| IPlayer["IPlayer Interface"]
        RandomPlayer -.->|"implements"| IPlayer
        IPlayer --> MainLoop["cli/src/main.cpp"]
    end
```

---

### 2. Class & Interface Hierarchy
Employs the **Dependency Inversion Principle (DIP)** and **Strategy Pattern** across all critical subsystems:

```mermaid
classDiagram
    class IDataProvider {
        <<interface>>
        +getSpecies(id) const SpeciesDefinition*
        +getMove(id) const MoveDefinition*
        +getTypeChart() const shared_ptr~ITypeChart~
        +getAllSpeciesIds() vector~string~
        +getAllMoveIds() vector~string~
        +createPokemon(id, level) PokemonInstance
    }
    
    class LocalJsonProvider {
        -shared_ptr~Gen1TypeChart~ m_typeChart
        -unordered_map m_species
        -unordered_map m_moves
        +loadAll(dataDir) bool
    }
    IDataProvider <|.. LocalJsonProvider
    LocalJsonProvider <|-- GameDataRegistry

    class IRandomGenerator {
        <<interface>>
        +nextInt(min, max) uint32
        +rollPercent(percent) bool
        +nextDouble() double
    }
    class MersenneTwisterRNG {
        -mt19937 m_rng
        +reseed(seed) void
    }
    class MockRNG {
        -queue~uint32~ m_intQueue
        +pushInt(val) void
    }
    IRandomGenerator <|.. MersenneTwisterRNG
    IRandomGenerator <|.. MockRNG

    class IPlayer {
        <<interface>>
        +getName() string
        +chooseAction(state, side, legalActions) optional~BattleAction~
        +chooseForcedSwitch(state, side, legalSwitches) optional~BattleAction~
    }
    class HumanPlayer {
        -string m_name
        -bool m_enableTimer
        -int m_timeoutSeconds
    }
    class RandomPlayer {
        -IRandomGenerator& m_rng
        -string m_name
    }
    IPlayer <|.. HumanPlayer
    IPlayer <|.. RandomPlayer

    class BattleEngine {
        -shared_ptr~ITypeChart~ m_typeChart
        -shared_ptr~IDamageCalculator~ m_damageCalc
        -shared_ptr~MoveEffectDispatcher~ m_effects
        +step(state, action1, action2, rng) StepResult
        +resolveForcedSwitches(state, switch1, switch2, rng) StepResult
        +getLegalActions(state, side) vector~BattleAction~
        +getLegalSwitches(state, side) vector~BattleAction~
    }
```

---

### 3. Turn Execution Sequence
The resolution pipeline within `BattleEngine::step()` faithfully matches Gen 1 battle rounds:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Main Game Loop
    participant Eng as BattleEngine
    participant DMG as Gen1DamageCalculator
    participant EFF as MoveEffectDispatcher

    Client->>Eng: step(state, actionP1, actionP2, rng)
    Note over Eng: 1. Determine Turn Priority<br/>(Switches First > Priority Moves > Natural Speed)
    
    opt Any player chose Switch
        Eng->>Eng: Perform Switch action(s)
    end

    rect rgba(56, 189, 248, 0.10)
    Note over Eng: 2. First Combatant Action
    Eng->>Eng: Status Check (Sleep / Freeze / 25% Full Paralysis / Confusion)
    opt Able to act
        Eng->>Eng: Accuracy Roll (1..255 RNG check)
        opt Move Hits
            Eng->>DMG: calculateDamage(attacker, defender, move, rng)
            DMG-->>Eng: damage, isCritical, effectiveness
            Eng->>Eng: Apply damage to Defender HP
            Eng->>EFF: applyEffects(move, attacker, defender, damage, rng)
            EFF-->>Eng: stat modifiers, ailments, recoil, drain
            Eng->>Eng: Check Defender Fainted
        end
    end
    end

    rect rgba(251, 146, 60, 0.10)
    Note over Eng: 3. Second Combatant Action (if not fainted)
    opt Second combatant still alive
        Eng->>Eng: Execute Move sequence (Status -> Accuracy -> Damage -> Effects)
    end
    end

    Note over Eng: 4. End-of-Turn Residuals<br/>(Poison / Burn tick, Toxic counter increase)
    Note over Eng: 5. Transition Phase<br/>(ActionSelection, ForcedSwitch, or GameOver)
    
    Eng-->>Client: StepResult (nextState, events)
```

---

### 4. Battle Phase State Machine
Battles transition through strict deterministic phases:

```mermaid
stateDiagram-v2
    [*] --> ActionSelection
    
    ActionSelection --> ActionSelection : Both Pokémon attack / switch & both survive
    ActionSelection --> ForcedSwitchP1 : P1 active Pokémon faints (P2 survives)
    ActionSelection --> ForcedSwitchP2 : P2 active Pokémon faints (P1 survives)
    ActionSelection --> ForcedSwitchBoth : Both active Pokémon faint simultaneously (e.g. Explosion/Recoil)
    ActionSelection --> GameOver : One or both teams wiped out / Timer Timeout
    
    ForcedSwitchP1 --> ActionSelection : P1 replacement sent out
    ForcedSwitchP1 --> GameOver : P1 has no remaining Pokémon
    
    ForcedSwitchP2 --> ActionSelection : P2 replacement sent out
    ForcedSwitchP2 --> GameOver : P2 has no remaining Pokémon
    
    ForcedSwitchBoth --> ActionSelection : Both replacements sent out
    ForcedSwitchBoth --> GameOver : Either team has no remaining Pokémon
    
    GameOver --> [*]
```

---

## 🎯 Gen 1 Game Mechanics Fidelity

The engine enforces canonical Generation 1 mechanics:

1. **Unified Special Stat**:
   * Gen 1 did not have separate Special Attack and Special Defense stats. The single `Special` stat calculates both special damage dealt and special damage received.
2. **Authentic Gen 1 Damage Formula**:
   $$\text{LevelFactor} = \left\lfloor \frac{2 \times \text{Level} \times C}{5} \right\rfloor + 2$$
   $$\text{BaseDamage} = \left\lfloor \frac{\text{LevelFactor} \times \text{Power} \times \frac{A}{D}}{50} \right\rfloor + 2$$
   $$\text{Damage} = \lfloor \text{BaseDamage} \times \text{STAB} \times \text{Type}_1 \times \text{Type}_2 \times \frac{R}{255} \rfloor$$
   *where $R \in [217, 255]$ is uniform random variance.*
3. **Speed-Based Critical Hits ($C$)**:
   * Regular moves: Threshold $T = \lfloor \text{BaseSpeed} / 2 \rfloor$.
   * High-crit moves (*Slash*, *Razor Leaf*, *Crabhammer*): Threshold $T = \min(255, 4 \times \text{BaseSpeed})$.
   * Critical hits double the attacker's level ($C = 2$) and **ignore all attacker and defender stat stage modifiers**.
4. **Status Conditions**:
   * **Burn (BRN)**: Halves effective Attack stat; inflicts $\lfloor \text{MaxHP} / 16 \rfloor$ turn-end residual damage.
   * **Poison (PSN)**: Inflicts $\lfloor \text{MaxHP} / 16 \rfloor$ turn-end residual damage.
   * **Paralysis (PAR)**: Cuts Speed to $25\%$ ($\times 0.25$); $25\%$ chance of full paralysis each turn.
   * **Sleep (SLP)**: Lasts 1–7 turns. A Pokémon waking up **cannot move on its wake-up turn**.
   * **Freeze (FRZ)**: Pokémon is completely immobilized and does not thaw naturally.
5. **Simultaneous KO Rules**:
   * If both players' final Pokémon faint at the same time (e.g. from *Explosion*, *Self-Destruct*, or recoil from *Double-Edge*), the match ends in a **Draw** (`state.winner = std::nullopt`).

---

## 🔁 Deterministic Replay System

Every battle completed in the simulator displays its reproduction commands:

```text
============================================================
 BATTLE COMPLETE
   Battle Seed : 1259288583660435056
   Team Seed   : 1259288583660435056
 To replay this exact battle:
   .\build\cli\pokemon_cli.exe --seed 1259288583660435056
 To replay just these rosters with fresh battle RNG:
   .\build\cli\pokemon_cli.exe --team-seed 1259288583660435056
============================================================
```

* **`--seed <seed>`**: Replays the **entire battle identically**. The roster, move selections, critical hits, damage rolls, and status procs will execute bit-for-bit the same.
* **`--team-seed <teamSeed>`**: Preserves the **exact same Pokémon and move pools**, but runs fresh randomized in-battle decision making and damage rolls.

---

## 📦 Data Pipeline (PokeAPI Ingestion)

Game data is normalized offline and shipped with the repository in `data/`. The engine **never calls PokeAPI at runtime**.

To re-fetch and generate the dataset from PokeAPI:
```bash
python tools/fetch_data.py
```
* **Disk Caching**: Raw HTTP responses are saved in `tools/.cache/` to ensure re-runs never spam PokeAPI and run in seconds.
* **Retro-Typing Corrections**: Restores Gen 1 typings (e.g., Magnemite is pure `Electric`, not `Electric/Steel`; Clefairy is pure `Normal`, not `Fairy`).
* **Learnset Filtering**: Restricts moves to the canonical `red-blue` version group.
* **Exclusion Reports**: Moves with complex multi-turn mechanics outside Phase 1 are explicitly documented in [`docs/EXCLUDED_MOVES.md`](docs/EXCLUDED_MOVES.md) and [`data/excluded_moves.json`](data/excluded_moves.json).

---

## 🧪 Automated Testing & CI

Continuous Integration runs on every push and pull request across **Ubuntu Linux** and **Windows** via GitHub Actions.

The suite contains **22 GoogleTest test suites** verifying 100% of core engine functionality:

```text
[==========] Running 22 tests from 9 test suites.
[  PASSED  ] DamageCalcTest.KnownReferenceDamageCalculation
[  PASSED  ] DamageCalcTest.SetDamageLevelMoves
[  PASSED  ] TypeChartTest.Gen1FaithfulMatchups
[  PASSED  ] TurnOrderTest.PriorityMovesMoveFirstRegardlessOfSpeed
[  PASSED  ] TurnOrderTest.NaturalSpeedDeterminesOrderWhenPriorityTied
[  PASSED  ] StatusTest.BurnCutsAttackAndDealsTurnEndDamage
[  PASSED  ] StatusTest.SleepBlocksActionAndCannotAttackOnWakeTurn
[  PASSED  ] StatusTest.ParalysisReducesSpeedToQuarter
[  PASSED  ] DeterminismTest.IdenticalSeedAndInputsProduceIdenticalBattle
[  PASSED  ] SerializationTest.BattleStateJsonRoundTrip
[  PASSED  ] SerializationTest.EventsJsonRoundTrip
[  PASSED  ] DataProviderTest.LoadsFullGen1Roster
[  PASSED  ] DataProviderTest.EveryPokemonHasUsableDamagingMove
[  PASSED  ] DataProviderTest.EveryPokemonTypeExistsInTypeChart
[  PASSED  ] DataProviderTest.Gen1RetroTypingsFaithful
[  PASSED  ] DataProviderTest.Gen1SpecialStatFaithful
[  PASSED  ] TeamGeneratorTest.DeterministicGenerationWithIdenticalSeed
[  PASSED  ] TeamGeneratorTest.DistinctPokemonOnGeneratedTeam
[  PASSED  ] TeamGeneratorTest.EveryMemberHasAtLeastOneDamagingMove
[  PASSED  ] TeamGeneratorTest.GeneratesUpToFourMovesPerPokemon
[  PASSED  ] SimulationStressTest.MultipleSeededBattlesCompleteWithoutHangsOrCrashes
[  PASSED  ] SimulationStressTest.ReproducibilityOnRandomGeneratedTeams
[==========] 22 tests ran. (100% PASSED)
```

---

## ⚖️ Legal Disclaimer & Credits

### Trademark & Copyright Notice
* **Pokémon**, Pokémon character names, Pokémon Red, Pokémon Blue, Pokémon Yellow, move names, and related indicia are trademarks, registered trademarks, and copyrights of **Nintendo Co., Ltd.**, **Creatures Inc.**, and **GAME FREAK inc.**
* This repository is an **independent, non-commercial, open-source educational project** developed solely to study and demonstrate game engine architecture, deterministic state machines, and clean C++17 design patterns.
* This project is **not** affiliated with, endorsed by, or sponsored by Nintendo, Game Freak, or Creatures Inc.
* **No Copyrighted Game Assets**: This codebase does **not** include, distribute, or require proprietary ROMs, official sprites, textures, audio files, or game binaries. All data structures are normalized numeric statistics and string definitions.

### Credits & Acknowledgments
* **Nintendo & GAME FREAK**: For creating the original Pokémon Generation 1 battle system that inspired this architectural study.
* **[PokeAPI](https://pokeapi.co/)**: For maintaining the open-source Pokémon REST API consumed by our offline data pipeline (`tools/fetch_data.py`).
* **[Smogon](https://www.smogon.com/) & [Pokémon Showdown](https://pokemonshowdown.com/)**: For extensive research and comprehensive technical documentation on Gen 1 cartridge battle mechanics, damage formulas, and type quirks.
* **[nlohmann/json](https://github.com/nlohmann/json)**: JSON for Modern C++ by Niels Lohmann (Licensed under the MIT License).
* **[GoogleTest](https://github.com/google/googletest)**: C++ testing framework by Google LLC (Licensed under the BSD 3-Clause License).

---

## 📄 License
The underlying source code of this software engine is released under the [MIT License](LICENSE). See [`LICENSE`](LICENSE) for full terms and conditions.
