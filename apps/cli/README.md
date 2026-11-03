# Pokémon Gen 1 Battle Engine - Standalone CLI

An interactive terminal-based client for the Generation 1 Pokémon battle engine. Supports Human vs AI (PvE), local 2-player hotseat (PvP), and headless AI vs AI simulation (bot mode), with optional per-turn countdown timers.

---

## Building the CLI

From the project root:

```bash
# Configure build
cmake -B build -DCMAKE_BUILD_TYPE=Release

# Build the CLI executable
cmake --build build --target pokemon_cli --config Release
```

The executable will be located at:
- **Windows**: `build/apps/cli/pokemon_cli.exe` (or `build/apps/cli/Release/pokemon_cli.exe` depending on generator)
- **Linux / macOS**: `build/apps/cli/pokemon_cli`

---

## Playing & Usage

```bash
pokemon_cli [options]
```

### Options
- `--mode <pve|pvp|bot>`: Battle mode (default: `pve`).
- `--timer, -t`: Enable per-move turn timer (default: 90 seconds).
- `--no-timer`: Explicitly disable the turn timer.
- `--turn-time <seconds>`: Custom turn timer duration (e.g. `--turn-time 30`).
- `--seed <uint64>`: Master RNG seed for deterministic battle replays.
- `--team-seed <uint64>`: Seed specifically for team roster generation.
- `--preset`: Use classic iconic competitive rosters (Snorlax, Alakazam, Tauros, etc.).
- `--random`: Use deterministic `TeamGenerator` to create random rosters (default).
- `--data <path>`: Custom path to data directory containing `pokemon.json`, `moves.json`, and `type_chart.json`.
- `--help`: Display usage information.

### Examples

```bash
# Standard game vs Rival Bot (interactive prompt for timer)
./build/apps/cli/pokemon_cli

# 2-Player local hotseat with iconic classic rosters
./build/apps/cli/pokemon_cli --mode pvp --preset

# Fast-paced battle with 15-second turn timer
./build/apps/cli/pokemon_cli --turn-time 15

# Replay an exact battle seed
./build/apps/cli/pokemon_cli --seed 1259288583660435056
```
