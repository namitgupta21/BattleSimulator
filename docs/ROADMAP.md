# Project Roadmap & Future Phases

This document records architectural ideas, features, and enhancements deferred to Phase 3 and beyond.

## Phase 3: Client & Presentation
- **React Frontend**: Single Page Application (SPA) client connecting via Socket.IO with responsive UI and animations.
- **Client Countdown Derivation**: Smooth client-side timer bars and audio-visual warning threshold triggers (e.g., at 60s, 30s, 10s) derived from the server's `deadline` and `serverTime` in `turn:prompt`.
- **Sprite and Audio Pipeline**: Retro Gen 1 sprites, animations, and sound effects synchronized with `BattleEventData` streams.

## Phase 4: Persistence, Infrastructure & Scalability
- **Redis State Store**: Replace the in-memory `RoomStore` with Redis streams and key-value state for horizontal scaling across multiple Node server pods.
- **Persistent Battle Database**: PostgreSQL or MongoDB storage for complete battle replay logs, matchmaking records, and player stats.
- **Authentication & Profiles**: User accounts, JWT auth, player rankings, ELO calculation, and match history.
- **Spectator Mode**: Allow third-party observers to watch live battles with fog-of-war applied (or unmasked for tournaments).

## Phase 5: WebAssembly & Edge Computing
- **Emscripten WASM Build**: Compile `engine/` to WebAssembly (`pokemon_engine.wasm`) for client-side single-player battles and instant local AI simulations without network round-trips.
- **WebWorker AI Matchups**: Headless Monte Carlo Tree Search (MCTS) or minimax battle bots running entirely on client threads.
