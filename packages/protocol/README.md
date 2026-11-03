# @pokemon/protocol

Shared TypeScript types, Zod runtime validation schemas, and Socket.IO event contract for Generation 1 Pokémon multiplayer battles.

## Overview

`@pokemon/protocol` defines the single source of truth for all communication between clients and the authoritative multiplayer server. It guarantees runtime validation on every socket event, typed errors, and enforces strict Fog-of-War rules.

## Socket.IO Events

### Client $\to$ Server

| Event | Schema | Description |
| :--- | :--- | :--- |
| `room:create` | `RoomCreateSchema` | Create a new room with host player name, team size (1-6), and timer toggle. |
| `room:join` | `RoomJoinSchema` | Join an existing room via 6-character room code. |
| `room:reconnect` | `RoomReconnectSchema` | Reconnect to an in-progress battle using an opaque `sessionToken`. |
| `player:ready` | `PlayerReadySchema` | Signal readiness to start the battle. |
| `battle:action` | `BattleActionSchema` | Submit turn move (`type: "move"`, `index: 0..3`) or switch (`type: "switch"`, `index: 0..5`). |
| `battle:switch` | `BattleSwitchSchema` | Submit forced bench switch on active Pokémon faint (`index: 0..5`). |
| `battle:forfeit` | `BattleForfeitSchema` | Concede the match immediately. |

### Server $\to$ Client

| Event | Schema | Description |
| :--- | :--- | :--- |
| `room:joined` | `RoomJoinedPayloadSchema` | Confirms room entry; sends assigned side (`p1`/`p2`), `sessionToken`, and room config. |
| `room:state` | `RoomStatePayloadSchema` | Broadcasts room state (`WaitingForPlayers`, `Ready`, `InProgress`, `Finished`, `Abandoned`). |
| `battle:start` | `BattleStartPayloadSchema` | Battle initialization: RNG seed, player's own team, and opponent initial public state. |
| `turn:prompt` | `TurnPromptPayloadSchema` | Action prompt: turn number, phase, legal actions, `serverTime`, `deadline`, and `remainingMs`. |
| `turn:result` | `TurnResultPayloadSchema` | Turn resolution: ordered battle events, player's updated team, and opponent public state. |
| `battle:end` | `BattleEndPayloadSchema` | Final outcome: winner (`p1`, `p2`, `draw`), reason (`knockout`, `timeout`, `disconnect`, `forfeit`), and `replayLogId`. |
| `error` | `ProtocolErrorSchema` | Typed protocol errors with `code` and human-readable `message`. |

## Fog of War & Hidden Information

By architecture, the protocol guarantees that private opponent information is never transmitted to clients:
- **Active Pokémon**: Exposed with `hpPercent` (0-100%), level, status, stat stages, and **only** moves that have been revealed by being used in battle. Exact current HP / max HP numbers are stripped.
- **Opponent Bench**: Only `totalTeamSize`, `aliveCount`, and `faintedCount` are transmitted. Bench Pokémon species, stats, and moves remain completely hidden.
