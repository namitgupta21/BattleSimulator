# Gen 1 Excluded Moves & Mechanics Audit

In accordance with the pure deterministic engine design of Phase 1, moves requiring multi-turn trapping, multi-hit execution, 2-turn invulnerability/charging, or volatile status mechanics outside the 5 primary conditions (Burn, Freeze, Paralysis, Poison, Sleep) are explicitly excluded rather than silently approximated.

## Excluded Moves Report

| Move ID | Rationale |
| :--- | :--- |
| `barrage` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `bide` | Damage accumulation over two turns and counter-attack deferred in Phase 1. |
| `bind` | Multi-turn trapping mechanics deferred in Phase 1. |
| `bite` | Bite inflicts flinch in Gen 1; volatile flinch mechanic deferred in Phase 1. |
| `bone-club` | Secondary flinch mechanic deferred in Phase 1. |
| `bonemerang` | Multi-hit strike loop (2 hits) deferred in Phase 1. |
| `clamp` | Multi-turn trapping mechanics deferred in Phase 1. |
| `comet-punch` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `confuse-ray` | Confusion is a volatile status outside Phase 1 core non-volatile conditions. |
| `confusion` | Secondary confusion chance outside Phase 1 core non-volatile status effects. |
| `conversion` | Type reassignment mechanic deferred in Phase 1. |
| `counter` | Physical damage doubling reflection deferred in Phase 1. |
| `dig` | Semi-invulnerable two-turn execution deferred in Phase 1. |
| `disable` | Random move disabling mechanic deferred in Phase 1. |
| `dizzy-punch` | Secondary confusion chance outside Phase 1 core non-volatile status effects. |
| `double-kick` | Multi-hit strike loop (2 hits) deferred in Phase 1. |
| `double-slap` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `dragon-rage` | Fixed 40 HP damage deferred in Phase 1. |
| `fire-spin` | Multi-turn trapping mechanics deferred in Phase 1. |
| `fissure` | One-Hit KO accuracy formula based on speed check deferred in Phase 1. |
| `fly` | Semi-invulnerable two-turn execution deferred in Phase 1. |
| `focus-energy` | Gen 1 crit quartering bug / specific ratio manipulation deferred in Phase 1. |
| `fury-attack` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `fury-swipes` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `guillotine` | One-Hit KO accuracy formula based on speed check deferred in Phase 1. |
| `haze` | Global stat stage and volatile reset deferred in Phase 1. |
| `headbutt` | Secondary flinch mechanic deferred in Phase 1. |
| `horn-drill` | One-Hit KO accuracy formula based on speed check deferred in Phase 1. |
| `hyper-beam` | Recharge turn mechanic deferred in Phase 1. |
| `hyper-fang` | Secondary flinch mechanic deferred in Phase 1. |
| `leech-seed` | Leech Seed turn-drain is a volatile status outside Phase 1 core conditions. |
| `light-screen` | Move 'light-screen' has 0 power and no supported effect handlers. |
| `low-kick` | Secondary flinch mechanic in Gen 1 deferred in Phase 1. |
| `metronome` | Random move invocation engine deferred in Phase 1. |
| `mimic` | Move slot copying engine deferred in Phase 1. |
| `mirror-move` | Opponent last move reflection deferred in Phase 1. |
| `mist` | Temporary stat protection shield deferred in Phase 1. |
| `pin-missile` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `psybeam` | Secondary confusion chance outside Phase 1 core non-volatile status effects. |
| `psywave` | Variable damage roll formula (1 to 1.5 * level) deferred in Phase 1. |
| `reflect` | Move 'reflect' has 0 power and no supported effect handlers. |
| `roar` | Battle force-switch/flee mechanic deferred in Phase 1. |
| `rock-slide` | Rock Slide has flinch in later gens, but in Gen 1 it had 0% flinch; supported as pure damage. |
| `rolling-kick` | Secondary flinch mechanic deferred in Phase 1. |
| `skull-bash` | Two-turn charging execution deferred in Phase 1. |
| `sky-attack` | Two-turn charging execution deferred in Phase 1. |
| `solar-beam` | Two-turn charging execution deferred in Phase 1. |
| `sonic-boom` | Fixed 20 HP damage deferred in Phase 1. |
| `spike-cannon` | Multi-hit strike loop (2-5 hits) deferred in Phase 1. |
| `splash` | Non-functional move with zero effect. |
| `stomp` | Secondary flinch mechanic deferred in Phase 1. |
| `substitute` | Decoy HP doll mechanic deferred in Phase 1. |
| `super-fang` | Fractional current HP halving damage deferred in Phase 1. |
| `supersonic` | Confusion is a volatile status outside Phase 1 core non-volatile conditions. |
| `teleport` | Battle escape / switch mechanic not applicable to Phase 1 trainer battles. |
| `transform` | Complete species, stat, and move-slot morphing deferred in Phase 1. |
| `twineedle` | Multi-hit strike loop (2 hits) deferred in Phase 1. |
| `whirlwind` | Battle force-switch/flee mechanic deferred in Phase 1. |
| `wrap` | Multi-turn trapping mechanics (immobilization and damage over 2-5 turns) deferred in Phase 1. |

## Excluded Pokémon

- **Ditto (`ditto`)**: Learns zero usable damaging moves in Gen 1 after unsupported mechanic exclusions.
