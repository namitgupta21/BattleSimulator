# Pokémon Battle Engine - Roadmap & Out of Scope (Phase 1)

This document tracks future features and intentionally omitted mechanics for Phase 1.

## Phase 1 Deliberate Omissions (Gen 1 Engine Core)

1. **Multi-Turn Trapping Moves**:
   - Moves like *Wrap*, *Bind*, *Fire Spin*, and *Clamp* have idiosyncratic and complex Gen 1 mechanics (immobilizing opponents across multiple turns and preventing input). Deferred to a dedicated multi-turn mechanics phase.
2. **Special Meta Moves**:
   - *Metronome*, *Mimic*, *Mirror Move*, *Transform*, *Counter*, and *Bide*. These require specialized state machines and move duplication that are not needed to demonstrate the core battle engine.
3. **Gen 1 Glitches & Bug Emulation**:
   - The 1/256 accuracy miss bug (in our engine, 100% accuracy moves always hit unless modified by evasion/accuracy stages).
   - Badge boost glitches (re-applying stat boosts upon receiving any stat debuff/buff).
   - Stat drop overflow / underflow glitches.
   - HP desync glitches (e.g. Psywave crash, substitute desync).
4. **Items & Abilities**:
   - Gen 1 has neither held items nor Pokémon abilities. These are reserved for Gen 2+ extensions.
5. **Multiplayer Networking & Web Server**:
   - Node.js WebSocket server and room management (Phase 2).
   - WebAssembly compilation / N-API bindings (Phase 2).
6. **Graphical UI**:
   - React + HTML5 Canvas / Pixi.js frontend (Phase 3).
7. **Advanced AI**:
   - Heuristic / Minimax / Gym Leader AI (Phase 4). Phase 1 provides an `IPlayer` interface with an interactive human CLI player and a deterministic `RandomPlayer` bot.

---

## Future Phases

- **Phase 2: Networking & WASM / N-API Bindings**
  - Compile engine to WebAssembly or N-API native module.
  - Express / Fastify server with WebSockets for room pairing and matchmaking.
- **Phase 3: React Client & Animations**
  - Pokémon Showdown-inspired UI with sprite animations, HP bars, battle log stream, and sound effects.
- **Phase 4: Pluggable AI Opponents**
  - Gym leaders with distinct heuristics, type advantages, and difficulty levels.
