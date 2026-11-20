#!/usr/bin/env node
/**
 * Interactive Replay Viewer for Pokemon Gen 1 Multiplayer Battles.
 * Usage:
 *   node tools/replay.mjs <BATTLE_ID> [--autoplay]
 */

import readline from "node:readline";

const args = process.argv.slice(2);
const autoplay = args.includes("--autoplay") || args.includes("-a");
const battleId = args.find((a) => !a.startsWith("--") && !a.startsWith("-"));
const urlFlag = args.find((a) => a.startsWith("--url="));
const SERVER_URL = urlFlag ? urlFlag.split("=")[1] : (process.env.SERVER_URL || "http://127.0.0.1:3000");

if (!battleId) {
  console.log("\nUsage:");
  console.log("  node tools/replay.mjs <BATTLE_ID> [--autoplay] [--url=http://...]\n");
  console.log("Example:");
  console.log("  node tools/replay.mjs af1b1b1b-7049-4aa7-a7ed-a85bfd343ce4\n");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const replayUrl = `${SERVER_URL}/replay/${battleId}`;
  console.log(`\nFetching replay from: ${replayUrl}...`);

  let record;
  try {
    const res = await fetch(replayUrl);
    if (!res.ok) {
      if (res.status === 404) {
        console.error(`\n[Error 404] Replay ID "${battleId}" not found on server.`);
        console.error("Note: In-memory battle records reset when the server restarts.\n");
      } else {
        console.error(`\n[Error ${res.status}] Failed to fetch replay: ${res.statusText}\n`);
      }
      process.exit(1);
    }
    record = await res.json();
  } catch (err) {
    console.error(`\n[Connection Error] Could not connect to server at ${SERVER_URL}: ${err.message}\n`);
    process.exit(1);
  }

  console.log("\n============================================================");
  console.log("                    BATTLE REPLAY VIEWER                    ");
  console.log("============================================================");
  console.log(`Battle ID   : ${record.id}`);
  console.log(`Room Code   : ${record.roomId}`);
  console.log(`RNG Seed    : ${record.seed}`);
  console.log(`Winner      : ${record.winner ? record.winner.toUpperCase() : "DRAW"}`);
  console.log(`End Reason  : ${record.endReason.toUpperCase()}`);
  console.log(`Total Turns : ${record.turns.length}`);
  console.log("============================================================\n");

  console.log("--- PLAYER 1 STARTING ROSTER ---");
  record.p1Team.pokemon.forEach((p, idx) => {
    console.log(`  [Slot ${idx}] ${p.name} (Lv.${p.level}) - HP: ${p.currentHp}/${p.maxHp} - Moves: [${p.moves.map(m => m.id).join(", ")}]`);
  });

  console.log("\n--- PLAYER 2 STARTING ROSTER ---");
  record.p2Team.pokemon.forEach((p, idx) => {
    console.log(`  [Slot ${idx}] ${p.name} (Lv.${p.level}) - HP: ${p.currentHp}/${p.maxHp} - Moves: [${p.moves.map(m => m.id).join(", ")}]`);
  });

  console.log("\n============================================================");
  console.log("                    MATCH PLAYBACK START                    ");
  console.log("============================================================\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const waitKey = () =>
    new Promise((resolve) => {
      rl.question(">> Press [ENTER] for next turn (or type 'q' to quit)... ", (answer) => {
        if (answer.trim().toLowerCase() === "q") {
          console.log("\nReplay playback exited.\n");
          rl.close();
          process.exit(0);
        }
        resolve();
      });
    });

  for (let i = 0; i < record.turns.length; i++) {
    const turn = record.turns[i];
    console.log(`\n---------------------- TURN ${turn.turnNumber} ----------------------`);

    // Display chosen actions
    if (turn.actions) {
      if (turn.actions.p1) {
        console.log(`* P1 Action : ${turn.actions.p1.type.toUpperCase()} (Index: ${turn.actions.p1.index})`);
      }
      if (turn.actions.p2) {
        console.log(`* P2 Action : ${turn.actions.p2.type.toUpperCase()} (Index: ${turn.actions.p2.index})`);
      }
    }

    console.log("\nTurn Events:");
    if (!turn.events || turn.events.length === 0) {
      console.log("  (No discrete events logged)");
    } else {
      turn.events.forEach((evt) => {
        const sideLabel = evt.side === "p1" ? "[P1]" : "[P2]";
        if (evt.type === "MoveUsed") {
          console.log(`  * ${sideLabel} ${evt.pokemon} used ${evt.move}!`);
        } else if (evt.type === "DamageDealt") {
          console.log(`    -> ${sideLabel} took ${evt.intValue1} damage!`);
        } else if (evt.type === "CriticalHit") {
          console.log(`    -> Critical hit!`);
        } else if (evt.type === "Fainted") {
          console.log(`  ☠ ${sideLabel} ${evt.pokemon} fainted!`);
        } else if (evt.type === "SwitchedIn") {
          console.log(`  * ${sideLabel} sent out ${evt.pokemon}!`);
        } else if (evt.type === "StatusApplied") {
          console.log(`    -> ${sideLabel} was afflicted with ${evt.status}!`);
        } else if (evt.message) {
          console.log(`    -> ${evt.message}`);
        }
      });
    }

    if (i < record.turns.length - 1) {
      if (autoplay) {
        await sleep(1500);
      } else {
        await waitKey();
      }
    }
  }

  console.log("\n============================================================");
  console.log("                     REPLAY FINISHED                        ");
  console.log(`🏆 WINNER: ${record.winner ? record.winner.toUpperCase() : "DRAW"} (${record.endReason.toUpperCase()})`);
  console.log("============================================================\n");

  rl.close();
}

main();
