#!/usr/bin/env node
/**
 * Sprite Coverage Verification Script.
 * Verifies that all 151 Gen 1 Pokémon have:
 * 1. Gen 5 Animated Front GIFs
 * 2. Gen 5 Animated Back GIFs
 * 3. Gen 1 Static Transparent Front PNGs
 * 4. Gen 1 Static Transparent Back PNGs
 * 5. Gen 5 Party Icons
 *
 * Exits with code 1 if any missing sprites are detected.
 * Designed to be run weekly in CI to detect upstream changes or gaps.
 */

const BASE_POKEAPI = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const CATEGORIES = [
  {
    name: "Gen 5 Animated Front (GIF)",
    urlPattern: (id) => `${BASE_POKEAPI}/versions/generation-v/black-white/animated/${id}.gif`,
  },
  {
    name: "Gen 5 Animated Back (GIF)",
    urlPattern: (id) => `${BASE_POKEAPI}/versions/generation-v/black-white/animated/back/${id}.gif`,
  },
  {
    name: "Gen 1 Static Front (PNG)",
    urlPattern: (id) => `${BASE_POKEAPI}/versions/generation-i/red-blue/transparent/${id}.png`,
  },
  {
    name: "Gen 1 Static Back (PNG)",
    urlPattern: (id) => `${BASE_POKEAPI}/versions/generation-i/red-blue/transparent/back/${id}.png`,
  },
  {
    name: "Gen 5 Party Icon (PNG)",
    urlPattern: (id) => `${BASE_POKEAPI}/versions/generation-v/icons/${id}.png`,
  },
];

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return true;
    if (res.status === 405) {
      // If HEAD is not allowed, try GET
      const getRes = await fetch(url, { method: "GET" });
      return getRes.ok;
    }
    return false;
  } catch (err) {
    return false;
  }
}

async function verifyCategory(category) {
  console.log(`Checking ${category.name}...`);
  const missing = [];
  const BATCH_SIZE = 15;

  for (let i = 1; i <= 151; i += BATCH_SIZE) {
    const batch = [];
    for (let id = i; id < Math.min(i + BATCH_SIZE, 152); id++) {
      batch.push(
        (async () => {
          const url = category.urlPattern(id);
          const ok = await checkUrl(url);
          if (!ok) missing.push(id);
        })()
      );
    }
    await Promise.all(batch);
  }

  const coverage = 151 - missing.length;
  console.log(`  Result: ${coverage}/151 verified (${((coverage / 151) * 100).toFixed(1)}%)`);
  if (missing.length > 0) {
    console.warn(`  Missing IDs: [${missing.join(", ")}]`);
  }
  return missing;
}

async function main() {
  console.log("============================================================");
  console.log("       POKÉAPI GEN 1 (1-151) SPRITE COVERAGE VERIFICATION   ");
  console.log("============================================================\n");

  let totalFailures = 0;

  for (const cat of CATEGORIES) {
    const missing = await verifyCategory(cat);
    if (missing.length > 0) {
      totalFailures += missing.length;
    }
  }

  console.log("\n============================================================");
  if (totalFailures === 0) {
    console.log("SUCCESS: All 151 Pokémon have 100% coverage across all 5 asset sets!");
    process.exit(0);
  } else {
    console.error(`FAILURE: Detected ${totalFailures} missing sprite asset(s)!`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
