#!/usr/bin/env node
/**
 * Gen 1 Pokémon Asset Downloader Tool.
 *
 * Downloads all 151 Gen 1 Pokémon visual assets into `apps/client/public/sprites/`
 * for optional self-hosting.
 *
 * Downloads:
 * - Gen 5 Black/White animated GIFs (front & back)
 * - Gen 1 Red/Blue transparent static fallbacks (front & back)
 * - Gen 5 32x32 Party Icons
 *
 * Implements polite rate limiting with small delays between batches.
 * Files in `apps/client/public/sprites/` are git-ignored and must NOT be committed.
 *
 * Usage:
 *   node tools/download-sprites.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_OUT = path.resolve(__dirname, "../apps/client/public/sprites");
const DIRS = {
  animFront: path.join(BASE_OUT, "animated"),
  animBack: path.join(BASE_OUT, "animated", "back"),
  staticFront: path.join(BASE_OUT, "transparent"),
  staticBack: path.join(BASE_OUT, "transparent", "back"),
  icons: path.join(BASE_OUT, "icons"),
};

for (const dir of Object.values(DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const BASE_POKEAPI = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const ASSET_TYPES = [
  {
    name: "Animated Front (Gen 5)",
    destDir: DIRS.animFront,
    ext: ".gif",
    urlFn: (id) => `${BASE_POKEAPI}/versions/generation-v/black-white/animated/${id}.gif`,
  },
  {
    name: "Animated Back (Gen 5)",
    destDir: DIRS.animBack,
    ext: ".gif",
    urlFn: (id) => `${BASE_POKEAPI}/versions/generation-v/black-white/animated/back/${id}.gif`,
  },
  {
    name: "Static Front (Gen 1)",
    destDir: DIRS.staticFront,
    ext: ".png",
    urlFn: (id) => `${BASE_POKEAPI}/versions/generation-i/red-blue/transparent/${id}.png`,
  },
  {
    name: "Static Back (Gen 1)",
    destDir: DIRS.staticBack,
    ext: ".png",
    urlFn: (id) => `${BASE_POKEAPI}/versions/generation-i/red-blue/transparent/back/${id}.png`,
  },
  {
    name: "Party Icon (Gen 5)",
    destDir: DIRS.icons,
    ext: ".png",
    urlFn: (id) => `${BASE_POKEAPI}/versions/generation-v/icons/${id}.png`,
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath)) {
    return true; // Already cached
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`\n  [Failed ${res.status}] ${url}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.error(`\n  [Error ${url}]: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("============================================================");
  console.log("       POKÉMON GEN 1 ASSET DOWNLOADER (SELF-HOSTING)        ");
  console.log("============================================================");
  console.log(`Target destination: ${BASE_OUT}\n`);

  for (const assetType of ASSET_TYPES) {
    console.log(`Downloading: ${assetType.name}...`);
    let downloaded = 0;
    const BATCH_SIZE = 10;

    for (let id = 1; id <= 151; id += BATCH_SIZE) {
      const promises = [];
      for (let curId = id; curId < Math.min(id + BATCH_SIZE, 152); curId++) {
        const dest = path.join(assetType.destDir, `${curId}${assetType.ext}`);
        const url = assetType.urlFn(curId);
        promises.push(downloadFile(url, dest));
      }
      const results = await Promise.all(promises);
      downloaded += results.filter(Boolean).length;
      process.stdout.write(`  Progress: ${Math.min(id + BATCH_SIZE - 1, 151)}/151\r`);
      await sleep(50); // Polite rate limit delay
    }
    console.log(`\n  Finished ${assetType.name}: ${downloaded}/151 files ready.\n`);
  }

  console.log("============================================================");
  console.log("All assets downloaded successfully!");
  console.log("Remember: DO NOT commit apps/client/public/sprites/ to Git!");
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("Download failed:", err);
  process.exit(1);
});
