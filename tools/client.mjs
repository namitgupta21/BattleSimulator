#!/usr/bin/env node
/**
 * Interactive CLI Test Client for Pokemon Gen 1 Multiplayer Server.
 * Usage:
 *   Host:  node tools/client.mjs Red
 *   Guest: node tools/client.mjs Blue <ROOM_CODE>
 */

import { io } from "socket.io-client";
import readline from "node:readline";

const SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:3000";
const playerName = process.argv[2] || `Player_${Math.floor(Math.random() * 1000)}`;
const targetRoomCode = process.argv[3]?.toUpperCase();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n============================================================");
console.log("       POKEMON GEN 1 MULTIPLAYER TEST CLIENT               ");
console.log("============================================================");
console.log(`Connecting to server: ${SERVER_URL} as "${playerName}"...\n`);

const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
});

let currentSide = null;
let currentSessionToken = null;
let currentRoomCode = null;
let lastPrompt = null;
let myTeam = [];

socket.on("connect", () => {
  console.log(`[Connected to Server] Socket ID: ${socket.id}`);

  if (targetRoomCode) {
    console.log(`Joining room [${targetRoomCode}]...`);
    socket.emit("room:join", {
      roomCode: targetRoomCode,
      playerName,
    });
  } else {
    console.log("Creating a new room (3v3, timer ON)...");
    socket.emit("room:create", {
      playerName,
      teamSize: 3,
      timerEnabled: true,
    });
  }
});

socket.on("room:joined", (data) => {
  currentSide = data.playerSide;
  currentRoomCode = data.roomCode;
  currentSessionToken = data.sessionToken;

  console.log("\n------------------------------------------------------------");
  console.log(`ROOM CODE     : ${data.roomCode}`);
  console.log(`ASSIGNED SIDE : ${data.playerSide.toUpperCase()}`);
  console.log(`SESSION TOKEN : ${data.sessionToken}`);
  console.log(`TEAM SIZE     : ${data.config.teamSize}`);
  console.log(`TIMER         : ${data.config.timerEnabled ? "ON (90s limit)" : "OFF"}`);
  console.log("------------------------------------------------------------\n");

  if (!targetRoomCode) {
    console.log(`>> Share this Room Code with your opponent: ${data.roomCode}`);
    console.log(">> Waiting for Player 2 to join...\n");
  }

  // Automatically signal ready
  socket.emit("player:ready", { ready: true });
});

socket.on("room:state", (data) => {
  const playerList = data.players.map((p) => `${p.name} (${p.side.toUpperCase()}) [${p.isReady ? "READY" : "WAITING"}]`).join(", ");
  console.log(`[Room State: ${data.state}] Players: ${playerList}`);
});

socket.on("battle:start", (data) => {
  myTeam = data.team;
  console.log("\n============================================================");
  console.log("                  BATTLE HAS COMMENCED!                     ");
  console.log("============================================================");
  console.log(`Seed: ${data.seed}\n`);

  console.log("[YOUR ROSTER]:");
  data.team.forEach((p, idx) => {
    const moveNames = p.moves.map((m) => m.name).join(", ");
    console.log(`  ${idx === 0 ? "★ [Active]" : "  [Bench ]"} ${p.name} (Lv.${p.level}) - HP: ${p.currentHp}/${p.maxHp} [${p.status}] - Moves: [${moveNames}]`);
  });

  if (data.opponentPublic.active) {
    const opp = data.opponentPublic.active;
    console.log(`\n[OPPONENT ACTIVE]: ${opp.name} (Lv.${opp.level}) - HP: ~${opp.hpPercent}% [${opp.status}]`);
  }
  console.log("------------------------------------------------------------\n");
});

socket.on("turn:prompt", (prompt) => {
  lastPrompt = prompt;

  console.log(`\n================== TURN ${prompt.turnNumber} [${prompt.phase}] ==================`);
  if (prompt.deadline) {
    const remainingSec = Math.max(0, Math.round((prompt.deadline - Date.now()) / 1000));
    console.log(`Turn Countdown : ${remainingSec}s remaining`);
  }

  console.log("\nLegal Options:");
  prompt.legalActions.forEach((act, idx) => {
    if (act.type === "move") {
      const activePokemon = myTeam[0];
      const move = activePokemon?.moves?.[act.index];
      const moveName = move ? `${move.name} (${move.currentPp}/${move.maxPp} PP)` : `Move slot ${act.index}`;
      console.log(`  [${idx + 1}] Attack: ${moveName}`);
    } else {
      const benchPokemon = myTeam[act.index];
      const pkmnName = benchPokemon ? `${benchPokemon.name} (${benchPokemon.currentHp}/${benchPokemon.maxHp} HP)` : `Slot ${act.index}`;
      console.log(`  [${idx + 1}] Switch: Switch to ${pkmnName}`);
    }
  });

  askForAction(prompt);
});

function askForAction(prompt) {
  rl.question("\nEnter your choice number (or 'forfeit'): ", (answer) => {
    const trimmed = answer.trim().toLowerCase();
    if (trimmed === "forfeit" || trimmed === "f") {
      console.log("Submitting match forfeit...");
      socket.emit("battle:forfeit", {});
      return;
    }

    const choiceIdx = parseInt(trimmed, 10) - 1;
    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= prompt.legalActions.length) {
      console.log("Invalid choice number. Please choose from the list.");
      askForAction(prompt);
      return;
    }

    const chosenAction = prompt.legalActions[choiceIdx];
    console.log(`>> Selected: ${chosenAction.type.toUpperCase()} (Index: ${chosenAction.index}). Waiting for opponent...`);

    if (prompt.phase.startsWith("ForcedSwitch")) {
      socket.emit("battle:switch", { index: chosenAction.index });
    } else {
      socket.emit("battle:action", { action: chosenAction });
    }
  });
}

socket.on("turn:result", (result) => {
  myTeam = result.yourTeam;
  console.log("\n---------------------- Turn Events -------------------------");
  result.events.forEach((evt) => {
    const sideLabel = evt.side === currentSide ? "[YOU]" : "[FOE]";
    if (evt.type === "MoveUsed") {
      console.log(`* ${sideLabel} ${evt.pokemon} used ${evt.move}!`);
    } else if (evt.type === "DamageDealt") {
      console.log(`  -> ${sideLabel} took ${evt.intValue1} damage!`);
    } else if (evt.type === "CriticalHit") {
      console.log(`  -> Critical hit!`);
    } else if (evt.type === "Fainted") {
      console.log(`☠ ${sideLabel} ${evt.pokemon} fainted!`);
    } else if (evt.type === "SwitchedIn") {
      console.log(`* ${sideLabel} sent out ${evt.pokemon}!`);
    } else if (evt.type === "StatusApplied") {
      console.log(`  -> ${sideLabel} was afflicted with ${evt.status}!`);
    } else if (evt.message) {
      console.log(`  -> ${evt.message}`);
    }
  });

  if (result.opponentPublic.active) {
    const opp = result.opponentPublic.active;
    const revealed = opp.revealedMoves.length > 0 ? opp.revealedMoves.join(", ") : "None";
    console.log(`\nOpponent Active : ${opp.name} (~${opp.hpPercent}% HP) [${opp.status}] - Revealed: [${revealed}]`);
    console.log(`Opponent Bench  : ${result.opponentPublic.aliveCount} alive / ${result.opponentPublic.faintedCount} fainted`);
  }
  console.log("------------------------------------------------------------");
});

socket.on("battle:end", (data) => {
  console.log("\n============================================================");
  console.log("                       MATCH FINISHED                       ");
  console.log("============================================================");
  if (data.winner === currentSide) {
    console.log("🏆 VICTORY! You won the battle!");
  } else if (data.winner === "draw") {
    console.log("🤝 DRAW! Both teams were knocked out simultaneously.");
  } else {
    console.log("💀 DEFEAT! Opponent won the battle.");
  }
  console.log(`End Reason   : ${data.reason.toUpperCase()}`);
  console.log(`Replay Log ID: ${data.replayLogId}`);
  console.log(`To view replay JSON: curl ${SERVER_URL}/replay/${data.replayLogId}`);
  console.log("============================================================\n");
  rl.close();
  socket.disconnect();
  process.exit(0);
});

socket.on("error", (err) => {
  console.error(`\n[Server Error ${err.code}]: ${err.message}`);
});

socket.on("disconnect", () => {
  console.log("\n[Disconnected from server]");
});

