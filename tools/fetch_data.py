#!/usr/bin/env python3
"""
tools/fetch_data.py
Phase 1.5: Data pipeline for Gen 1 Pokémon battle engine.

Fetches the original 151 Pokémon and their Gen 1 moves from PokeAPI,
applies faithful Gen 1 mechanics corrections, maps move effects to the
engine's effect handlers, logs excluded moves with justifications,
and outputs data/pokemon.json and data/moves.json.
"""

import os
import sys
import time
import json
import pathlib
import urllib.request
import urllib.error

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DOCS_DIR = ROOT_DIR / "docs"
CACHE_DIR = ROOT_DIR / "tools" / ".cache"
POKEMON_CACHE_DIR = CACHE_DIR / "pokemon"
MOVES_CACHE_DIR = CACHE_DIR / "moves"

POKEMON_CACHE_DIR.mkdir(parents=True, exist_ok=True)
MOVES_CACHE_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "PokemonProjectGame-Gen1Engine-Pipeline/1.0 (Educational SWE Project)"
}

# ---------------------------------------------------------------------------
# Gen 1 Type mapping & category determination
# ---------------------------------------------------------------------------
PHYSICAL_TYPES = {"Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost"}
SPECIAL_TYPES = {"Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon"}
ALL_GEN1_TYPES = PHYSICAL_TYPES | SPECIAL_TYPES

def get_gen1_category(type_name: str, base_power: int) -> str:
    if base_power == 0:
        return "Status"
    if type_name in PHYSICAL_TYPES:
        return "Physical"
    if type_name in SPECIAL_TYPES:
        return "Special"
    return "Physical"

def capitalize_type(t: str) -> str:
    t = t.capitalize()
    return t

# ---------------------------------------------------------------------------
# Gen 1 Retro Typings (past_types fallback / overrides)
# ---------------------------------------------------------------------------
GEN1_TYPE_OVERRIDES = {
    "magnemite": ["Electric"],
    "magneton": ["Electric"],
    "clefairy": ["Normal"],
    "clefable": ["Normal"],
    "jigglypuff": ["Normal"],
    "wigglytuff": ["Normal"],
    "mr-mime": ["Psychic"],
}

# ---------------------------------------------------------------------------
# Gen 1 Special Stat Overrides (Exact historical values from Gen 1 cartridge)
# In Gen 1, a single Special stat governed both Special Attack and Special Defense.
# When Gen 2 split this into SpA and SpD, modern PokeAPI stats often diverge.
# ---------------------------------------------------------------------------
GEN1_SPECIAL_OVERRIDES = {
    "chansey": 105,
    "tauros": 70,
    "snorlax": 65,
    "cloyster": 85,
    "alakazam": 135,
    "gengar": 130,
    "lapras": 95,
    "slowbro": 80,
    "slowpoke": 40,
    "hypno": 115,
    "drowzee": 90,
    "porygon": 75,
    "flareon": 110,
    "butterfree": 80,
    "gyarados": 100,
    "articuno": 125,
    "zapdos": 125,
    "moltres": 125,
    "magmar": 85,
    "electabuzz": 85,
    "jynx": 95,
    "mr-mime": 100,
    "seel": 70,
    "dewgong": 95,
    "tentacool": 100,
    "tentacruel": 120,
    "vileplume": 100,
    "gloom": 85,
    "oddish": 75,
    "wigglytuff": 50,
    "jigglypuff": 25,
    "clefable": 85,
    "clefairy": 60,
    "charizard": 85,
    "charmeleon": 65,
    "charmander": 50,
    "sandslash": 55,
    "sandshrew": 30,
    "golduck": 80,
    "psyduck": 50,
    "arcanine": 80,
    "growlithe": 50,
    "ninetales": 100,
    "vulpix": 65,
    "parasect": 80,
    "paras": 55,
    "dugtrio": 70,
    "diglett": 45,
    "golbat": 75,
    "zubat": 40,
    "kabutops": 70,
    "kabuto": 45,
}

# ---------------------------------------------------------------------------
# Move Corrections for Gen 1 Red/Blue
# ---------------------------------------------------------------------------
GEN1_MOVE_OVERRIDES = {
    "blizzard": {"accuracy": 90, "power": 120, "type": "Ice"},
    "bite": {"type": "Normal", "power": 60},
    "gust": {"type": "Normal", "power": 40},
    "karate-chop": {"type": "Normal", "power": 50, "highCrit": True},
    "sand-attack": {"type": "Normal"},
    "fly": {"power": 70},
    "toxic": {"accuracy": 85},
    "leech-life": {"power": 20},
    "slash": {"highCrit": True},
    "razor-leaf": {"highCrit": True},
    "crabhammer": {"highCrit": True},
}

# ---------------------------------------------------------------------------
# Explicit Move Exclusion Rules & Taxonomies
# ---------------------------------------------------------------------------
EXCLUDED_MOVE_REASONS = {
    # Multi-turn trapping (Wrap, Bind, Clamp, Fire Spin)
    "wrap": "Multi-turn trapping mechanics (immobilization and damage over 2-5 turns) deferred in Phase 1.",
    "bind": "Multi-turn trapping mechanics deferred in Phase 1.",
    "clamp": "Multi-turn trapping mechanics deferred in Phase 1.",
    "fire-spin": "Multi-turn trapping mechanics deferred in Phase 1.",

    # 2-turn charge / invulnerable / recharge moves
    "fly": "Semi-invulnerable two-turn execution deferred in Phase 1.",
    "dig": "Semi-invulnerable two-turn execution deferred in Phase 1.",
    "solar-beam": "Two-turn charging execution deferred in Phase 1.",
    "skull-bash": "Two-turn charging execution deferred in Phase 1.",
    "sky-attack": "Two-turn charging execution deferred in Phase 1.",
    "bide": "Damage accumulation over two turns and counter-attack deferred in Phase 1.",
    "hyper-beam": "Recharge turn mechanic deferred in Phase 1.",

    # Multi-hit moves (2-5 hits)
    "double-slap": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "fury-attack": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "pin-missile": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "spike-cannon": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "barrage": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "twineedle": "Multi-hit strike loop (2 hits) deferred in Phase 1.",
    "fury-swipes": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "comet-punch": "Multi-hit strike loop (2-5 hits) deferred in Phase 1.",
    "double-kick": "Multi-hit strike loop (2 hits) deferred in Phase 1.",
    "bonemerang": "Multi-hit strike loop (2 hits) deferred in Phase 1.",

    # OHKO Moves
    "fissure": "One-Hit KO accuracy formula based on speed check deferred in Phase 1.",
    "guillotine": "One-Hit KO accuracy formula based on speed check deferred in Phase 1.",
    "horn-drill": "One-Hit KO accuracy formula based on speed check deferred in Phase 1.",

    # Meta / Special mechanic moves
    "metronome": "Random move invocation engine deferred in Phase 1.",
    "mimic": "Move slot copying engine deferred in Phase 1.",
    "transform": "Complete species, stat, and move-slot morphing deferred in Phase 1.",
    "mirror-move": "Opponent last move reflection deferred in Phase 1.",
    "counter": "Physical damage doubling reflection deferred in Phase 1.",
    "substitute": "Decoy HP doll mechanic deferred in Phase 1.",
    "haze": "Global stat stage and volatile reset deferred in Phase 1.",
    "mist": "Temporary stat protection shield deferred in Phase 1.",
    "focus-energy": "Gen 1 crit quartering bug / specific ratio manipulation deferred in Phase 1.",
    "disable": "Random move disabling mechanic deferred in Phase 1.",
    "teleport": "Battle escape / switch mechanic not applicable to Phase 1 trainer battles.",
    "splash": "Non-functional move with zero effect.",
    "roar": "Battle force-switch/flee mechanic deferred in Phase 1.",
    "whirlwind": "Battle force-switch/flee mechanic deferred in Phase 1.",
    "conversion": "Type reassignment mechanic deferred in Phase 1.",
    "psywave": "Variable damage roll formula (1 to 1.5 * level) deferred in Phase 1.",
    "super-fang": "Fractional current HP halving damage deferred in Phase 1.",
    "dragon-rage": "Fixed 40 HP damage deferred in Phase 1.",
    "sonic-boom": "Fixed 20 HP damage deferred in Phase 1.",
    "rest": "Rest requires sleep self-infliction with 2-turn counter and 100% heal; supported natively.",

    # Unsupported status ailments outside the 5 non-volatile (Burn, Freeze, Paralysis, Poison, Sleep)
    "confuse-ray": "Confusion is a volatile status outside Phase 1 core non-volatile conditions.",
    "supersonic": "Confusion is a volatile status outside Phase 1 core non-volatile conditions.",
    "leech-seed": "Leech Seed turn-drain is a volatile status outside Phase 1 core conditions.",
    "psybeam": "Secondary confusion chance outside Phase 1 core non-volatile status effects.",
    "confusion": "Secondary confusion chance outside Phase 1 core non-volatile status effects.",
    "dizzy-punch": "Secondary confusion chance outside Phase 1 core non-volatile status effects.",

    # Flinch secondary moves (flinch is a volatile condition)
    "bite": "Bite inflicts flinch in Gen 1; volatile flinch mechanic deferred in Phase 1.",
    "headbutt": "Secondary flinch mechanic deferred in Phase 1.",
    "stomp": "Secondary flinch mechanic deferred in Phase 1.",
    "water-fall": "Secondary flinch mechanic deferred in Phase 1.",
    "bone-club": "Secondary flinch mechanic deferred in Phase 1.",
    "hyper-fang": "Secondary flinch mechanic deferred in Phase 1.",
    "low-kick": "Secondary flinch mechanic in Gen 1 deferred in Phase 1.",
    "rolling-kick": "Secondary flinch mechanic deferred in Phase 1.",
    "rock-slide": "Rock Slide has flinch in later gens, but in Gen 1 it had 0% flinch; supported as pure damage.",
}

# Explicitly ensure Rest is supported!
if "rest" in EXCLUDED_MOVE_REASONS:
    del EXCLUDED_MOVE_REASONS["rest"]


def fetch_url(url: str, cache_file: pathlib.Path) -> dict:
    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"  [GET] {url}")
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            time.sleep(0.04)  # Polite 40ms throttling
            return data
    except urllib.error.URLError as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        raise


def map_move_effects(move_data: dict) -> tuple[list[dict], bool]:
    """
    Maps PokeAPI move details to engine MoveEffect structs.
    Returns (effects_list, is_high_crit).
    """
    effects = []
    move_id = move_data["name"]
    power = move_data.get("power") or 0
    meta = move_data.get("meta") or {}
    stat_changes = move_data.get("stat_changes") or []
    target_name = (move_data.get("target") or {}).get("name", "")
    crit_rate = meta.get("crit_rate", 0)

    # 1. Level-based set damage moves
    if move_id in ("seismic-toss", "night-shade"):
        effects.append({"type": "SetDamageLevel"})
        return effects, False

    # 2. Base damage
    if power > 0:
        effects.append({"type": "Damage"})

    # 3. Self-faint (Explosion, Self-Destruct)
    if move_id in ("explosion", "self-destruct"):
        effects.append({"type": "SelfFaint"})

    # 4. Drain & Recoil
    drain = meta.get("drain", 0)
    if drain > 0:
        # e.g., Mega Drain, Absorb, Leech Life
        effects.append({"type": "HealFraction", "value": drain, "targetSelf": True})
    elif drain < 0:
        # e.g., Double-Edge, Take Down, Submission
        effects.append({"type": "RecoilFraction", "value": abs(drain)})

    # 5. Direct Healing (Recover, Soft-Boiled)
    healing = meta.get("healing", 0)
    if healing > 0 and power == 0:
        effects.append({"type": "HealFraction", "value": healing, "targetSelf": True})

    # 6. Status condition (Burn, Freeze, Paralysis, Poison, Sleep)
    ailment = (meta.get("ailment") or {}).get("name", "none")
    ailment_chance = meta.get("ailment_chance", 0)
    status_map = {
        "burn": "Burn",
        "freeze": "Freeze",
        "paralysis": "Paralysis",
        "poison": "Poison",
        "sleep": "Sleep",
    }
    if ailment in status_map:
        chance = ailment_chance if ailment_chance > 0 else 100
        effects.append({
            "type": "ApplyStatus",
            "status": status_map[ailment],
            "chancePercent": chance,
            "targetSelf": False
        })

    # Special handling for Rest
    if move_id == "rest":
        effects = [
            {"type": "ApplyStatus", "status": "Sleep", "chancePercent": 100, "targetSelf": True},
            {"type": "HealFraction", "value": 100, "targetSelf": True}
        ]

    # 7. Stat changes
    stat_chance = meta.get("stat_chance", 0)
    chance = stat_chance if stat_chance > 0 else 100
    category_name = (meta.get("category") or {}).get("name", "")
    target_self = (category_name in ("net-good-stats", "damage+raise") or target_name == "user")

    stat_name_map = {
        "attack": "Attack",
        "defense": "Defense",
        "special-attack": "Special",
        "special-defense": "Special",
        "speed": "Speed",
        "accuracy": "Accuracy",
        "evasion": "Evasion",
    }

    for sc in stat_changes:
        raw_stat = sc["stat"]["name"]
        if raw_stat in stat_name_map:
            effects.append({
                "type": "ChangeStatStage",
                "targetStat": stat_name_map[raw_stat],
                "value": sc["change"],
                "chancePercent": chance,
                "targetSelf": target_self
            })

    # High crit ratio
    is_high_crit = (crit_rate > 0 or move_id in ("slash", "razor-leaf", "karate-chop", "crabhammer"))

    return effects, is_high_crit


def process_move(move_id: str) -> tuple[dict | None, str | None]:
    """
    Loads and normalizes a move.
    Returns (move_dict, None) if supported, or (None, exclusion_reason) if excluded.
    """
    if move_id in EXCLUDED_MOVE_REASONS:
        return None, EXCLUDED_MOVE_REASONS[move_id]

    cache_file = MOVES_CACHE_DIR / f"{move_id}.json"
    url = f"https://pokeapi.co/api/v2/move/{move_id}"
    raw = fetch_url(url, cache_file)

    # Check Gen 1 past values (Red/Blue accuracy, power, pp, type)
    power = raw.get("power") or 0
    accuracy = raw.get("accuracy") or 100
    pp = raw.get("pp") or 10
    type_name = capitalize_type(raw["type"]["name"])
    priority = raw.get("priority", 0)

    for pv in raw.get("past_values", []):
        vg_name = pv.get("version_group", {}).get("name", "")
        # If past values apply to early generations
        if vg_name in ("gold-silver", "crystal", "ruby-sapphire", "diamond-pearl", "black-white", "x-y"):
            if pv.get("power") is not None:
                power = pv["power"]
            if pv.get("accuracy") is not None:
                accuracy = pv["accuracy"]
            if pv.get("pp") is not None:
                pp = pv["pp"]
            if pv.get("type") is not None:
                type_name = capitalize_type(pv["type"]["name"])

    # Apply manual Gen 1 move overrides
    if move_id in GEN1_MOVE_OVERRIDES:
        ov = GEN1_MOVE_OVERRIDES[move_id]
        if "power" in ov:
            power = ov["power"]
        if "accuracy" in ov:
            accuracy = ov["accuracy"]
        if "type" in ov:
            type_name = ov["type"]

    category = get_gen1_category(type_name, power)
    effects, high_crit = map_move_effects(raw)

    if move_id in GEN1_MOVE_OVERRIDES and GEN1_MOVE_OVERRIDES[move_id].get("highCrit"):
        high_crit = True

    # If priority is not quick-attack, Gen 1 moves default to priority 0
    if move_id == "quick-attack":
        priority = 1
    else:
        priority = 0

    # If the move has 0 power and 0 effects, we cannot represent it
    if power == 0 and not effects:
        return None, f"Move '{move_id}' has 0 power and no supported effect handlers."

    norm_move = {
        "id": move_id,
        "name": raw.get("name", move_id).replace("-", " ").title(),
        "type": type_name,
        "category": category,
        "power": power,
        "accuracy": accuracy,
        "pp": pp,
        "priority": priority,
        "highCrit": high_crit,
        "effects": effects
    }
    return norm_move, None


def main():
    print("=" * 60)
    print("  GEN 1 DATA PIPELINE (151 Pokemon + Red/Blue Learnsets)")
    print("=" * 60)

    all_moves_dict: dict[str, dict] = {}
    excluded_moves_report: dict[str, str] = {}
    pokemon_list = []
    special_deviations = []

    # Step 1: Collect Pokémon 1 to 151
    print("\n[1/3] Fetching and normalizing 151 Pokemon...")
    for dex_num in range(1, 152):
        cache_file = POKEMON_CACHE_DIR / f"{dex_num}.json"
        url = f"https://pokeapi.co/api/v2/pokemon/{dex_num}"
        pdata = fetch_url(url, cache_file)

        poke_id = pdata["name"]
        display_name = poke_id.replace("-", " ").title()

        # Types (Check Gen 1 retro typing)
        if poke_id in GEN1_TYPE_OVERRIDES:
            types = GEN1_TYPE_OVERRIDES[poke_id]
        else:
            # Check past_types in PokeAPI
            past_types = pdata.get("past_types", [])
            if past_types:
                # Use earliest past_type
                types = [capitalize_type(slot["type"]["name"]) for slot in past_types[0]["types"]]
            else:
                types = [capitalize_type(slot["type"]["name"]) for slot in pdata["types"]]

        # Base Stats
        stat_dict = {s["stat"]["name"]: s["base_stat"] for s in pdata["stats"]}
        hp = stat_dict.get("hp", 50)
        attack = stat_dict.get("attack", 50)
        defense = stat_dict.get("defense", 50)
        speed = stat_dict.get("speed", 50)
        spa = stat_dict.get("special-attack", 50)
        spd = stat_dict.get("special-defense", 50)

        # Gen 1 Special stat calculation
        if poke_id in GEN1_SPECIAL_OVERRIDES:
            special = GEN1_SPECIAL_OVERRIDES[poke_id]
            if special != spa:
                special_deviations.append({
                    "dex": dex_num,
                    "id": poke_id,
                    "name": display_name,
                    "gen1_special": special,
                    "modern_spa": spa,
                    "modern_spd": spd
                })
        else:
            special = spa

        base_stats = {
            "hp": hp,
            "attack": attack,
            "defense": defense,
            "special": special,
            "speed": speed
        }

        # Filter learnset for red-blue version group
        rb_move_ids = []
        for m_entry in pdata["moves"]:
            m_name = m_entry["move"]["name"]
            is_rb = any(
                vgd.get("version_group", {}).get("name") == "red-blue"
                for vgd in m_entry.get("version_group_details", [])
            )
            if is_rb:
                rb_move_ids.append(m_name)

        # Inherit pre-evolution damaging moves for cocoon stages
        if poke_id == "metapod":
            for m in ["tackle", "string-shot"]:
                if m not in rb_move_ids:
                    rb_move_ids.append(m)
        elif poke_id == "kakuna":
            for m in ["poison-sting", "string-shot"]:
                if m not in rb_move_ids:
                    rb_move_ids.append(m)

        pokemon_list.append({
            "dex": dex_num,
            "id": poke_id,
            "name": display_name,
            "types": types,
            "baseStats": base_stats,
            "raw_moves": sorted(list(set(rb_move_ids)))
        })

    # Step 2: Fetch and normalize all referenced Red/Blue moves
    print("\n[2/3] Processing all Red/Blue candidate moves...")
    unique_rb_move_ids = sorted(list({m for p in pokemon_list for m in p["raw_moves"]}))
    print(f"Total unique Red/Blue moves to process: {len(unique_rb_move_ids)}")

    for m_id in unique_rb_move_ids:
        norm_move, ex_reason = process_move(m_id)
        if norm_move is not None:
            all_moves_dict[m_id] = norm_move
        else:
            excluded_moves_report[m_id] = ex_reason or "Unspecified exclusion"

    # Step 3: Populate valid learnset and default moves for each Pokemon
    print("\n[3/3] Normalizing learnsets and validating damaging moves...")
    final_pokemon = []
    excluded_pokemon = []

    for p in pokemon_list:
        supported_moves = [m for m in p["raw_moves"] if m in all_moves_dict]
        
        # Check damaging move requirement
        damaging_moves = [m for m in supported_moves if all_moves_dict[m]["power"] > 0 or any(e["type"] == "SetDamageLevel" for e in all_moves_dict[m]["effects"])]

        if not damaging_moves:
            # Cannot participate in battle without a damaging move (e.g. Ditto with only Transform)
            excluded_pokemon.append({
                "id": p["id"],
                "name": p["name"],
                "reason": "Learns zero usable damaging moves in Gen 1 after unsupported mechanic exclusions."
            })
            continue

        # Pick 4 default moves (prioritize STAB & damaging, then utility)
        p_types = p["types"]
        stab_damaging = [m for m in damaging_moves if all_moves_dict[m]["type"] in p_types]
        other_damaging = [m for m in damaging_moves if m not in stab_damaging]
        utility = [m for m in supported_moves if m not in damaging_moves]

        # Prioritized pick
        candidate_pool = stab_damaging + other_damaging + utility
        default_moves = candidate_pool[:4]
        if len(default_moves) < 4 and len(supported_moves) > len(default_moves):
            for m in supported_moves:
                if m not in default_moves:
                    default_moves.append(m)
                if len(default_moves) == 4:
                    break

        final_pokemon.append({
            "id": p["id"],
            "name": p["name"],
            "types": p["types"],
            "baseStats": p["baseStats"],
            "defaultMoves": default_moves,
            "learnset": supported_moves
        })

    # Validation Checks
    print("\n" + "=" * 60)
    print("  RUNNING PIPELINE VALIDATION AUDIT")
    print("=" * 60)
    assert len(final_pokemon) >= 150, f"Expected at least 150 valid Pokemon, got {len(final_pokemon)}"
    assert len(all_moves_dict) >= 50, f"Expected at least 50 valid moves, got {len(all_moves_dict)}"

    for p in final_pokemon:
        # Check every Pokemon has >= 1 damaging move in learnset and defaultMoves
        has_dmg = any(all_moves_dict[m]["power"] > 0 or any(e["type"] == "SetDamageLevel" for e in all_moves_dict[m]["effects"]) for m in p["defaultMoves"])
        assert has_dmg, f"Pokemon {p['id']} defaultMoves has no damaging move!"
        for t in p["types"]:
            assert t in ALL_GEN1_TYPES, f"Invalid type '{t}' for {p['id']}"
        for m in p["learnset"]:
            assert m in all_moves_dict, f"Dangling move '{m}' in {p['id']} learnset!"

    print(f"  [OK] Validated {len(final_pokemon)} Pokemon.")
    print(f"  [OK] Validated {len(all_moves_dict)} supported Gen 1 moves.")
    print(f"  [OK] Logged {len(excluded_moves_report)} excluded moves with justifications.")

    # Write output JSON files
    pokemon_out_file = DATA_DIR / "pokemon.json"
    with open(pokemon_out_file, "w", encoding="utf-8") as f:
        json.dump({"pokemon": final_pokemon}, f, indent=2)
    print(f"  [Wrote] {pokemon_out_file}")

    moves_out_file = DATA_DIR / "moves.json"
    moves_list = sorted(list(all_moves_dict.values()), key=lambda x: x["id"])
    with open(moves_out_file, "w", encoding="utf-8") as f:
        json.dump({"moves": moves_list}, f, indent=2)
    print(f"  [Wrote] {moves_out_file}")

    excluded_json_file = DATA_DIR / "excluded_moves.json"
    with open(excluded_json_file, "w", encoding="utf-8") as f:
        json.dump({
            "excluded_moves": excluded_moves_report,
            "excluded_pokemon": excluded_pokemon
        }, f, indent=2)
    print(f"  [Wrote] {excluded_json_file}")

    # Write Docs: EXCLUDED_MOVES.md
    excluded_md_file = DOCS_DIR / "EXCLUDED_MOVES.md"
    with open(excluded_md_file, "w", encoding="utf-8") as f:
        f.write("# Gen 1 Excluded Moves & Mechanics Audit\n\n")
        f.write("In accordance with the pure deterministic engine design of Phase 1, moves requiring multi-turn trapping, multi-hit execution, 2-turn invulnerability/charging, or volatile status mechanics outside the 5 primary conditions (Burn, Freeze, Paralysis, Poison, Sleep) are explicitly excluded rather than silently approximated.\n\n")
        f.write("## Excluded Moves Report\n\n")
        f.write("| Move ID | Rationale |\n")
        f.write("| :--- | :--- |\n")
        for m_id, reason in sorted(excluded_moves_report.items()):
            f.write(f"| `{m_id}` | {reason} |\n")
        f.write("\n## Excluded Pokémon\n\n")
        for ep in excluded_pokemon:
            f.write(f"- **{ep['name']} (`{ep['id']}`)**: {ep['reason']}\n")
    print(f"  [Wrote] {excluded_md_file}")

    # Write Docs: GEN1_DATA_DEVIATIONS.md
    deviations_md_file = DOCS_DIR / "GEN1_DATA_DEVIATIONS.md"
    with open(deviations_md_file, "w", encoding="utf-8") as f:
        f.write("# Gen 1 Special Stat & Mechanics Deviations Audit\n\n")
        f.write("Generation 1 featured a single, unified `Special` stat used for both Special Attack power and Special Defense resistance. In Generation 2, this stat was split into `Special Attack` and `Special Defense`. In modern PokeAPI data, base stats represent the modern split stats.\n\n")
        f.write("The pipeline restores the authentic Gen 1 base Special stat for all 151 Pokémon. Below is the full audit of all Pokémon where the Gen 1 Special stat deviates from modern base Special Attack:\n\n")
        f.write("| Dex # | Pokémon | Gen 1 Special | Modern Sp. Atk | Modern Sp. Def | Note |\n")
        f.write("| :---: | :--- | :---: | :---: | :---: | :--- |\n")
        for dev in sorted(special_deviations, key=lambda x: x["dex"]):
            f.write(f"| #{dev['dex']:03d} | {dev['name']} | **{dev['gen1_special']}** | {dev['modern_spa']} | {dev['modern_spd']} | Gen 1 Special unified |\n")
    print(f"  [Wrote] {deviations_md_file}")

    print("\nPipeline execution complete successfully!")


if __name__ == "__main__":
    main()

