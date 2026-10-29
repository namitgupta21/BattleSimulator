# Pokémon Gen 1 Battle Engine & CLI Simulator (Phase 1)

A pure, deterministic, faithfully modeled Generation 1 Pokémon battle engine written in modern C++17, designed as a reusable core for future WebAssembly / N-API Node.js servers and React frontends.

![CI Status](https://img.shields.io/badge/CI-Passing-brightgreen)
![C++17](https://img.shields.io/badge/Language-C%2B%2B17-blue)
![CMake](https://img.shields.io/badge/Build-CMake-orange)
![Tests](https://img.shields.io/badge/Tests-GoogleTest%20100%25-success)

---

## Architecture & Low-Level Design (LLD)

The engine is built around a pure state-transition function with zero external I/O, globals, or wall-clock dependencies:

$$\text{step}(\text{state}, \text{actionP1}, \text{actionP2}, \text{rng}) \longrightarrow (\text{newState}, \text{eventLog})$$

```
+-------------------------------------------------------------------------+
|                                CLI Layer                                |
|   +-----------------------+                    +--------------------+   |
|   | HumanPlayer (Stdin)   |                    | RandomPlayer (Bot) |   |
|   +-----------+-----------+                    +---------+----------+   |
|               |                                          |              |
|               +--------------------+---------------------+              |
|                                    | (IPlayer interface)                |
|                                    v                                    |
|                      +---------------------------+                      |
|                      | Game Loop & CLI Renderer  |                      |
|                      +-------------+-------------+                      |
+------------------------------------|------------------------------------+
                                     |  Actions / Event stream
+------------------------------------v------------------------------------+
|                               Engine Core                               |
|                                                                         |
|   +-------------------+    +--------------------+    +--------------+   |
|   | IRandomGenerator  |    |     ITypeChart     |    | IDamageCalc  |   |
|   +---------+---------+    +---------+----------+    +-------+------+   |
|             |                        |                       |          |
|             v                        v                       v          |
|      +-------------------------------------------------------+          |
|      |                     BattleEngine                      |          |
|      +-------------------------------+-----------------------+          |
|                                      |                                  |
|                                      v                                  |
|                     +---------------------------------+                 |
|                     |      MoveEffectDispatcher       |                 |
|                     | (Damage, Status, Stages, Drain) |                 |
|                     +---------------------------------+                 |
+-------------------------------------------------------------------------+
```

### SOLID Principles in Action

1. **Single Responsibility Principle (SRP)**:
   - `BattleEngine`: Coordinates turn resolution, speed comparison, and forced switches.
   - `Gen1DamageCalculator`: Pure calculation of base damage, level multipliers, STAB, type effectiveness, and rolls.
   - `MoveEffectDispatcher`: Decouples individual effect executions (damage, status infliction, stat stages, recoil, healing).
   - `LocalJsonProvider` / `IDataProvider`: Decouples raw JSON ingestion, validation, and data persistence from engine logic.
   - `TeamGenerator`: Pure deterministic weighted roster generation guaranteeing legal Gen 1 teams.
   - `Renderer`: Renders structured `BattleEvent` records to terminal without modifying or querying business logic.
2. **Open / Closed Principle (OCP)**:
   - Move effects use the **Strategy Pattern** (`IMoveEffectHandler`). Adding new move mechanics in future phases requires registering a new handler rather than modifying `BattleEngine`.
   - Players implement `IPlayer`. Future heuristic or Minimax AI opponents plug in seamlessly.
3. **Liskov Substitution Principle (LSP)**:
   - `HumanPlayer` and `RandomPlayer` can be swapped interchangeably without altering game loop behavior.
   - `LocalJsonProvider` can be replaced with any mock `IDataProvider` in testing without altering the engine or team generation.
   - `MersenneTwisterRNG` and `MockRNG` implement `IRandomGenerator` identically.
4. **Interface Segregation Principle (ISP)**:
   - Segregated, focused interfaces: `IRandomGenerator`, `IPlayer`, `ITypeChart`, `IDamageCalculator`, `IMoveEffectHandler`, `IDataProvider`.
5. **Dependency Inversion Principle (DIP)**:
   - High-level modules (`BattleEngine`, `TeamGenerator`) depend on abstractions (`IRandomGenerator`, `ITypeChart`, `IDamageCalculator`, `IDataProvider`), not concrete implementations.

---

## Gen 1 Mechanics Implemented

- **Single Special Stat**: Stat formulas compute a unified `Special` stat used for both special attack power and special defense.
- **Gen 1 Damage Formula**:
  $$\text{LevelFactor} = \left\lfloor \frac{2 \times \text{Level}}{5} \right\rfloor + 2$$
  $$\text{BaseDamage} = \left\lfloor \frac{\text{LevelFactor} \times \text{Power} \times \frac{A}{D}}{50} \right\rfloor + 2$$
  Followed by STAB ($\lfloor \text{dmg} \times 1.5 \rfloor$), Gen 1 type effectiveness, and the authentic Gen 1 random roll: $\lfloor \text{dmg} \times R / 255 \rfloor$ where $R \in [217, 255]$.
- **Base Speed-Based Critical Hits**:
  - Regular moves: Threshold $T = \lfloor \text{BaseSpeed} / 2 \rfloor$.
  - High-crit moves (*Slash*, *Razor Leaf*): Threshold $T = \min(255, 4 \times \text{BaseSpeed})$.
  - Roll: $R \in [0, 255]$; critical if $R < T$.
  - **Gen 1 Crits Rule**: Critical hits double the attacker's level in the damage formula and **ignore both positive and negative stat stage modifiers**.
- **Faithful Gen 1 Type Quirks**:
  - Psychic is immune to Ghost ($0.0\times$).
  - Bug and Poison are mutually super-effective ($2.0\times$).
  - Ice is neutral against Fire ($1.0\times$, not resisted).
- **Status Conditions**:
  - **Burn (BRN)**: Halves effective Attack stat; inflicts $\lfloor \text{MaxHP} / 16 \rfloor$ damage at turn end.
  - **Poison (PSN)**: Inflicts $\lfloor \text{MaxHP} / 16 \rfloor$ damage at turn end.
  - **Paralysis (PAR)**: Cuts Speed to $25\%$ ($\times 0.25$); $25\%$ chance of full paralysis each turn.
  - **Sleep (SLP)**: Lasts 1–7 turns. **Gen 1 Rule**: A Pokémon waking up **cannot move on the wake-up turn**.
  - **Freeze (FRZ)**: Pokémon is completely immobilized and does not thaw naturally without external thawing.
- **Stat Stages**: Multipliers for $[-6, +6]$ range faithfully matching Gen 1 scaling.

---

## Mechanics Deliberately Deferred (Phase 1 Scope)

The following mechanics are documented in [`docs/EXCLUDED_MOVES.md`](docs/EXCLUDED_MOVES.md) and intentionally omitted from Phase 1:
1. Multi-turn trapping moves (*Wrap*, *Fire Spin*, *Clamp*, *Bind*).
2. Complex meta moves (*Metronome*, *Mimic*, *Transform*, *Mirror Move*, *Counter*, *Bide*).
3. Gen 1 specific glitch reproduction (1/256 miss on 100% moves, badge boost recalculation glitches, HP desync glitches).
4. Items & Abilities (Gen 1 featured neither).

---

## Building and Running

### Prerequisites
- Modern C++17 compiler (GCC 9+, Clang 10+, or MSVC 2019+)
- CMake 3.16+
- Python 3.8+ (for data generation script)

### 1. Build
```bash
# Configure
cmake -B build -DCMAKE_BUILD_TYPE=Release

# Build engine, CLI executable, and test suite
cmake --build build --config Release -j 4
```

### 2. Run Unit Tests
```bash
ctest --test-dir build --output-on-failure -C Release
```
Or run the GoogleTest binary directly:
```bash
./build/tests/pokemon_tests
```

### 3. Play Battle in Terminal

**Human vs Rival Bot with Generated Teams (PvE - Default):**
```bash
./build/cli/pokemon_cli
```

**Human vs Rival Bot with Fixed Classic Teams:**
```bash
./build/cli/pokemon_cli --preset
```

**Hotseat PvP (Human vs Human):**
```bash
./build/cli/pokemon_cli --mode pvp
```

**Bot vs Bot Simulation:**
```bash
./build/cli/pokemon_cli --mode bot --seed 1234
```

**Replay a Specific Team Roster (with fresh in-battle RNG):**
```bash
./build/cli/pokemon_cli --team-seed 1234
```

**Play with Turn Timer (1.5 min per move):**
```bash
./build/cli/pokemon_cli --timer
```
> **Timer Details**:
> - Players have up to **1.5 minutes (90 seconds)** to select an action or switch.
> - Countdown warnings are emitted at **1min, 30s, 15s, 10s, 5s, 4s, 3s, 2s, and 1s**.
> - If time expires, the battle terminates immediately and declares the opposing player as the winner.
> - Custom duration can be specified via `--turn-time <seconds>` (e.g. `--turn-time 30`).
> - Can also be toggled interactively when launching without flags.

### 4. Regenerating Full Gen 1 Game Data (PokeAPI Pipeline)
The engine consumes normalized data from `data/pokemon.json` and `data/moves.json`. To re-fetch and validate all 151 Pokémon and their Red/Blue move pools from PokeAPI:
```bash
python tools/fetch_data.py
```
- **Caching**: Raw responses are cached in `tools/.cache/` to minimize external requests and prevent rate-limiting.
- **Audit Reports**:
  - [`docs/EXCLUDED_MOVES.md`](docs/EXCLUDED_MOVES.md): Explicit list of excluded moves and reasons.
  - [`docs/GEN1_DATA_DEVIATIONS.md`](docs/GEN1_DATA_DEVIATIONS.md): Deviations between Gen 1 Special and modern Special Attack.
  - [`data/excluded_moves.json`](data/excluded_moves.json): Machine-readable exclusion report.
