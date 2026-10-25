#!/usr/bin/env python3
"""
fetch_data.py
Fetches and generates curated Gen 1 Pokemon and Move JSON data.
Data source: PokeAPI (https://pokeapi.co/) with offline fallback.
"""

import json
import os
import sys
import urllib.request
import urllib.error

CURATED_POKEMON = [
    "snorlax", "alakazam", "tauros", "chansey", "gengar",
    "starmie", "exeggutor", "zapdos", "jolteon", "cloyster",
    "rhydon", "jynx", "slowbro", "dragonite", "lapras",
    "venusaur", "charizard", "blastoise", "golem", "raichu"
]

# Accurate Gen 1 Special stats where they differ from Gen 2+ SpAtk/SpDef
GEN1_SPECIAL_OVERRIDE = {
    "snorlax": 65,
    "alakazam": 135,
    "tauros": 70,
    "chansey": 105,
    "gengar": 130,
    "starmie": 100,
    "exeggutor": 125,
    "zapdos": 125,
    "jolteon": 110,
    "cloyster": 85,
    "rhydon": 45,
    "jynx": 95,
    "slowbro": 80,
    "dragonite": 100,
    "lapras": 95,
    "venusaur": 100,
    "charizard": 85,
    "blastoise": 85,
    "golem": 55,
    "raichu": 90
}

# Curated moves exercising all mechanics
CURATED_MOVES = {
    # Normal physical & high crit
    "body-slam": {
        "id": "body-slam", "name": "Body Slam", "type": "Normal", "category": "Physical",
        "power": 85, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Paralysis", "chancePercent": 30}]
    },
    "hyper-beam": {
        "id": "hyper-beam", "name": "Hyper Beam", "type": "Normal", "category": "Physical",
        "power": 150, "accuracy": 90, "pp": 5, "priority": 0,
        "effects": [{"type": "Damage"}]
    },
    "double-edge": {
        "id": "double-edge", "name": "Double-Edge", "type": "Normal", "category": "Physical",
        "power": 100, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "RecoilFraction", "value": 25}]
    },
    "slash": {
        "id": "slash", "name": "Slash", "type": "Normal", "category": "Physical",
        "power": 70, "accuracy": 100, "pp": 20, "priority": 0, "highCrit": True,
        "effects": [{"type": "Damage"}]
    },
    "quick-attack": {
        "id": "quick-attack", "name": "Quick Attack", "type": "Normal", "category": "Physical",
        "power": 40, "accuracy": 100, "pp": 30, "priority": 1,
        "effects": [{"type": "Damage"}]
    },
    # Special attacks
    "psychic": {
        "id": "psychic", "name": "Psychic", "type": "Psychic", "category": "Special",
        "power": 90, "accuracy": 100, "pp": 10, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ChangeStatStage", "targetStat": "Special", "value": -1, "chancePercent": 33, "targetSelf": False}]
    },
    "thunderbolt": {
        "id": "thunderbolt", "name": "Thunderbolt", "type": "Electric", "category": "Special",
        "power": 95, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Paralysis", "chancePercent": 10}]
    },
    "thunder": {
        "id": "thunder", "name": "Thunder", "type": "Electric", "category": "Special",
        "power": 120, "accuracy": 70, "pp": 10, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Paralysis", "chancePercent": 10}]
    },
    "ice-beam": {
        "id": "ice-beam", "name": "Ice Beam", "type": "Ice", "category": "Special",
        "power": 95, "accuracy": 100, "pp": 10, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Freeze", "chancePercent": 10}]
    },
    "blizzard": {
        "id": "blizzard", "name": "Blizzard", "type": "Ice", "category": "Special",
        "power": 120, "accuracy": 90, "pp": 5, "priority": 0, # In Gen 1, Blizzard had 90% accuracy!
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Freeze", "chancePercent": 10}]
    },
    "surf": {
        "id": "surf", "name": "Surf", "type": "Water", "category": "Special",
        "power": 95, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "Damage"}]
    },
    "hydro-pump": {
        "id": "hydro-pump", "name": "Hydro Pump", "type": "Water", "category": "Special",
        "power": 120, "accuracy": 80, "pp": 5, "priority": 0,
        "effects": [{"type": "Damage"}]
    },
    "flamethrower": {
        "id": "flamethrower", "name": "Flamethrower", "type": "Fire", "category": "Special",
        "power": 95, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Burn", "chancePercent": 10}]
    },
    "fire-blast": {
        "id": "fire-blast", "name": "Fire Blast", "type": "Fire", "category": "Special",
        "power": 120, "accuracy": 85, "pp": 5, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "ApplyStatus", "status": "Burn", "chancePercent": 30}]
    },
    "earthquake": {
        "id": "earthquake", "name": "Earthquake", "type": "Ground", "category": "Physical",
        "power": 100, "accuracy": 100, "pp": 10, "priority": 0,
        "effects": [{"type": "Damage"}]
    },
    "rock-slide": {
        "id": "rock-slide", "name": "Rock Slide", "type": "Rock", "category": "Physical",
        "power": 75, "accuracy": 90, "pp": 10, "priority": 0,
        "effects": [{"type": "Damage"}]
    },
    "drill-peck": {
        "id": "drill-peck", "name": "Drill Peck", "type": "Flying", "category": "Physical",
        "power": 80, "accuracy": 100, "pp": 20, "priority": 0,
        "effects": [{"type": "Damage"}]
    },
    "razor-leaf": {
        "id": "razor-leaf", "name": "Razor Leaf", "type": "Grass", "category": "Special",
        "power": 55, "accuracy": 95, "pp": 25, "priority": 0, "highCrit": True,
        "effects": [{"type": "Damage"}]
    },
    "mega-drain": {
        "id": "mega-drain", "name": "Mega Drain", "type": "Grass", "category": "Special",
        "power": 40, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "HealFraction", "value": 50, "targetSelf": True}] # drains 50%
    },
    # Status inflicting
    "thunder-wave": {
        "id": "thunder-wave", "name": "Thunder Wave", "type": "Electric", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 20, "priority": 0,
        "effects": [{"type": "ApplyStatus", "status": "Paralysis", "chancePercent": 100}]
    },
    "sleep-powder": {
        "id": "sleep-powder", "name": "Sleep Powder", "type": "Grass", "category": "Status",
        "power": 0, "accuracy": 75, "pp": 15, "priority": 0,
        "effects": [{"type": "ApplyStatus", "status": "Sleep", "chancePercent": 100}]
    },
    "hypnosis": {
        "id": "hypnosis", "name": "Hypnosis", "type": "Psychic", "category": "Status",
        "power": 0, "accuracy": 60, "pp": 20, "priority": 0,
        "effects": [{"type": "ApplyStatus", "status": "Sleep", "chancePercent": 100}]
    },
    "toxic": {
        "id": "toxic", "name": "Toxic", "type": "Poison", "category": "Status",
        "power": 0, "accuracy": 85, "pp": 10, "priority": 0,
        "effects": [{"type": "ApplyStatus", "status": "Poison", "chancePercent": 100}]
    },
    "poison-powder": {
        "id": "poison-powder", "name": "Poison Powder", "type": "Poison", "category": "Status",
        "power": 0, "accuracy": 75, "pp": 35, "priority": 0,
        "effects": [{"type": "ApplyStatus", "status": "Poison", "chancePercent": 100}]
    },
    # Healing & Defense
    "recover": {
        "id": "recover", "name": "Recover", "type": "Normal", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 20, "priority": 0,
        "effects": [{"type": "HealFraction", "value": 50, "targetSelf": True}]
    },
    "soft-boiled": {
        "id": "soft-boiled", "name": "Soft-Boiled", "type": "Normal", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 10, "priority": 0,
        "effects": [{"type": "HealFraction", "value": 50, "targetSelf": True}]
    },
    "rest": {
        "id": "rest", "name": "Rest", "type": "Psychic", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 10, "priority": 0,
        "effects": [{"type": "HealFraction", "value": 100, "targetSelf": True}, {"type": "ApplyStatus", "status": "Sleep", "chancePercent": 100, "targetSelf": True}]
    },
    # Stat buffing moves
    "swords-dance": {
        "id": "swords-dance", "name": "Swords Dance", "type": "Normal", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 30, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Attack", "value": 2, "chancePercent": 100, "targetSelf": True}]
    },
    "amnesia": {
        "id": "amnesia", "name": "Amnesia", "type": "Psychic", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 20, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Special", "value": 2, "chancePercent": 100, "targetSelf": True}]
    },
    "agility": {
        "id": "agility", "name": "Agility", "type": "Psychic", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 30, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Speed", "value": 2, "chancePercent": 100, "targetSelf": True}]
    },
    "barrier": {
        "id": "barrier", "name": "Barrier", "type": "Psychic", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 30, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Defense", "value": 2, "chancePercent": 100, "targetSelf": True}]
    },
    # Stat debuffing moves
    "screech": {
        "id": "screech", "name": "Screech", "type": "Normal", "category": "Status",
        "power": 0, "accuracy": 85, "pp": 40, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Defense", "value": -2, "chancePercent": 100, "targetSelf": False}]
    },
    "leer": {
        "id": "leer", "name": "Leer", "type": "Normal", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 30, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Defense", "value": -1, "chancePercent": 100, "targetSelf": False}]
    },
    "growl": {
        "id": "growl", "name": "Growl", "type": "Normal", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 40, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Attack", "value": -1, "chancePercent": 100, "targetSelf": False}]
    },
    "string-shot": {
        "id": "string-shot", "name": "String Shot", "type": "Bug", "category": "Status",
        "power": 0, "accuracy": 95, "pp": 40, "priority": 0,
        "effects": [{"type": "ChangeStatStage", "targetStat": "Speed", "value": -1, "chancePercent": 100, "targetSelf": False}]
    },
    # Additional iconic moves
    "seismic-toss": {
        "id": "seismic-toss", "name": "Seismic Toss", "type": "Fighting", "category": "Physical",
        "power": 1, "accuracy": 100, "pp": 20, "priority": 0,
        "effects": [{"type": "SetDamageLevel"}] # Deals damage = user level
    },
    "night-shade": {
        "id": "night-shade", "name": "Night Shade", "type": "Ghost", "category": "Special",
        "power": 1, "accuracy": 100, "pp": 15, "priority": 0,
        "effects": [{"type": "SetDamageLevel"}] # Deals damage = user level
    },
    "confuse-ray": {
        "id": "confuse-ray", "name": "Confuse Ray", "type": "Ghost", "category": "Status",
        "power": 0, "accuracy": 100, "pp": 10, "priority": 0,
        "effects": [{"type": "ApplyStatus", "status": "Confusion", "chancePercent": 100}]
    },
    "explosion": {
        "id": "explosion", "name": "Explosion", "type": "Normal", "category": "Physical",
        "power": 170, "accuracy": 100, "pp": 5, "priority": 0, # Halves defense in Gen 1
        "effects": [{"type": "Damage"}, {"type": "SelfFaint"}]
    },
    "self-destruct": {
        "id": "self-destruct", "name": "Self-Destruct", "type": "Normal", "category": "Physical",
        "power": 130, "accuracy": 100, "pp": 5, "priority": 0,
        "effects": [{"type": "Damage"}, {"type": "SelfFaint"}]
    }
}

# Default competitive movesets for the 20 Pokemon
DEFAULT_MOVESETS = {
    "snorlax": ["body-slam", "hyper-beam", "earthquake", "rest"],
    "alakazam": ["psychic", "recover", "thunder-wave", "seismic-toss"],
    "tauros": ["body-slam", "hyper-beam", "earthquake", "blizzard"],
    "chansey": ["ice-beam", "soft-boiled", "thunder-wave", "thunderbolt"],
    "gengar": ["hypnosis", "thunderbolt", "night-shade", "explosion"],
    "starmie": ["blizzard", "thunderbolt", "recover", "surf"],
    "exeggutor": ["sleep-powder", "psychic", "mega-drain", "explosion"],
    "zapdos": ["thunderbolt", "drill-peck", "thunder-wave", "agility"],
    "jolteon": ["thunderbolt", "thunder-wave", "double-edge", "agility"],
    "cloyster": ["blizzard", "surf", "explosion", "screech"],
    "rhydon": ["earthquake", "rock-slide", "body-slam", "substitute"], # substitute can be leer/screech for now
    "jynx": ["blizzard", "psychic", "hypnosis", "body-slam"],
    "slowbro": ["amnesia", "surf", "thunder-wave", "rest"],
    "dragonite": ["agility", "blizzard", "thunderbolt", "hyper-beam"],
    "lapras": ["blizzard", "thunderbolt", "surf", "body-slam"],
    "venusaur": ["sleep-powder", "razor-leaf", "swords-dance", "body-slam"],
    "charizard": ["fire-blast", "swords-dance", "earthquake", "slash"],
    "blastoise": ["surf", "blizzard", "earthquake", "body-slam"],
    "golem": ["earthquake", "rock-slide", "body-slam", "explosion"],
    "raichu": ["thunderbolt", "thunder-wave", "surf", "agility"]
}

# Fix rhydon moveset if substitute was placeholder
DEFAULT_MOVESETS["rhydon"] = ["earthquake", "rock-slide", "body-slam", "leer"]

def fetch_json(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PokemonProjectGame-Gen1Engine/1.0"}
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))

def build_pokemon_entry(name):
    # Try PokeAPI, fallback to built-in verified base stats
    try:
        url = f"https://pokeapi.co/api/v2/pokemon/{name}"
        data = fetch_json(url)
        types = [t["type"]["name"].capitalize() for t in data["types"]]
        stats_raw = {s["stat"]["name"]: s["base_stat"] for s in data["stats"]}
        
        hp = stats_raw.get("hp", 80)
        attack = stats_raw.get("attack", 80)
        defense = stats_raw.get("defense", 80)
        speed = stats_raw.get("speed", 80)
        special = GEN1_SPECIAL_OVERRIDE.get(name, stats_raw.get("special-attack", 80))
    except Exception as e:
        print(f"Notice: Fetching {name} online failed ({e}). Using verified Gen 1 standard stats.")
        # Fallback to standard Gen 1 base stats
        verified = {
            "snorlax": (160, 110, 65, 30, ["Normal"]),
            "alakazam": (55, 50, 45, 120, ["Psychic"]),
            "tauros": (75, 100, 95, 110, ["Normal"]),
            "chansey": (250, 5, 5, 50, ["Normal"]),
            "gengar": (60, 65, 60, 110, ["Ghost", "Poison"]),
            "starmie": (60, 75, 85, 115, ["Water", "Psychic"]),
            "exeggutor": (95, 95, 85, 55, ["Grass", "Psychic"]),
            "zapdos": (90, 90, 85, 100, ["Electric", "Flying"]),
            "jolteon": (65, 65, 60, 130, ["Electric"]),
            "cloyster": (50, 95, 180, 70, ["Water", "Ice"]),
            "rhydon": (105, 130, 120, 40, ["Ground", "Rock"]),
            "jynx": (65, 50, 35, 95, ["Ice", "Psychic"]),
            "slowbro": (95, 75, 110, 30, ["Water", "Psychic"]),
            "dragonite": (91, 134, 95, 80, ["Dragon", "Flying"]),
            "lapras": (130, 85, 80, 60, ["Water", "Ice"]),
            "venusaur": (80, 82, 83, 80, ["Grass", "Poison"]),
            "charizard": (78, 84, 78, 100, ["Fire", "Flying"]),
            "blastoise": (79, 83, 100, 78, ["Water"]),
            "golem": (80, 120, 130, 45, ["Rock", "Ground"]),
            "raichu": (60, 90, 55, 100, ["Electric"])
        }
        hp, attack, defense, speed, types = verified[name]
        special = GEN1_SPECIAL_OVERRIDE[name]

    return {
        "id": name,
        "name": name.capitalize(),
        "types": types,
        "baseStats": {
            "hp": hp,
            "attack": attack,
            "defense": defense,
            "special": special,
            "speed": speed
        },
        "defaultMoves": DEFAULT_MOVESETS.get(name, ["body-slam", "hyper-beam", "earthquake", "surf"])
    }

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.abspath(os.path.join(script_dir, ".."))

    print("Building Pokemon JSON...")
    pokemon_list = []
    for p in CURATED_POKEMON:
        print(f"  Processing {p}...")
        pokemon_list.append(build_pokemon_entry(p))

    pokemon_out = os.path.join(data_dir, "pokemon.json")
    with open(pokemon_out, "w", encoding="utf-8") as f:
        json.dump({"pokemon": pokemon_list}, f, indent=2)
    print(f"Saved {len(pokemon_list)} Pokémon to {pokemon_out}")

    print("Building Moves JSON...")
    moves_list = list(CURATED_MOVES.values())
    moves_out = os.path.join(data_dir, "moves.json")
    with open(moves_out, "w", encoding="utf-8") as f:
        json.dump({"moves": moves_list}, f, indent=2)
    print(f"Saved {len(moves_list)} moves to {moves_out}")

if __name__ == "__main__":
    main()
