#!/usr/bin/env node
/**
 * Smoke Test for Production Server Container
 * Verifies that:
 * 1. /healthz returns 200 OK with expected version and uptime
 * 2. Two Socket.IO clients can connect, create/join a room, battle 1 turn, forfeit,
 *    and fetch the finished replay via /replay/:battleId.
 */

import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:3000";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

async function runSmokeTest() {
  console.log(`[Smoke Test] Checking ${SERVER_URL}...`);

  // 1. HTTP /healthz check
  const healthRes = await fetch(`${SERVER_URL}/healthz`);
  if (!healthRes.ok) {
    throw new Error(`/healthz returned HTTP ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  console.log("[Smoke Test] /healthz response:", healthData);
  if (healthData.status !== "ok") {
    throw new Error(`/healthz status is not 'ok': ${JSON.stringify(healthData)}`);
  }
  if (EXPECTED_SHA && healthData.version !== EXPECTED_SHA) {
    throw new Error(`Expected version ${EXPECTED_SHA}, received ${healthData.version}`);
  }

  // 2. Multi-client Socket.IO battle check
  console.log("[Smoke Test] Connecting Socket.IO test clients...");

  const p1 = io(SERVER_URL, { transports: ["websocket"], timeout: 5000 });
  const p2 = io(SERVER_URL, { transports: ["websocket"], timeout: 5000 });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for battle")), 15000);

    let roomCode = "";
    let battleId = "";
    let p1Ready = false;
    let p2Ready = false;

    p1.on("connect", () => {
      p1.emit("room:create", { playerName: "SmokeP1", teamSize: 3, timerEnabled: false });
    });

    p1.on("room:created", (data) => {
      roomCode = data.roomCode;
      p1Ready = true;
      p1.emit("player:ready", { isReady: true });
      p2.emit("room:join", { roomCode, playerName: "SmokeP2" });
    });

    p2.on("room:joined", () => {
      p2Ready = true;
      p2.emit("player:ready", { isReady: true });
    });

    p1.on("battle:start", () => {
      // Battle commenced
    });

    p1.on("turn:prompt", (prompt) => {
      if (prompt.legalActions && prompt.legalActions.length > 0) {
        p1.emit("battle:action", prompt.legalActions[0]);
      }
    });

    p2.on("turn:prompt", (prompt) => {
      if (prompt.legalActions && prompt.legalActions.length > 0) {
        p2.emit("battle:action", prompt.legalActions[0]);
      }
    });

    p1.on("turn:result", () => {
      // Submit forfeit to cleanly conclude the match
      p1.emit("battle:forfeit");
    });

    p1.on("battle:end", async (endData) => {
      battleId = endData.replayLogId;
      console.log(`[Smoke Test] Battle concluded. Replay log ID: ${battleId}`);

      try {
        // 3. Verify Replay endpoint
        const replayRes = await fetch(`${SERVER_URL}/replay/${battleId}`);
        if (!replayRes.ok) {
          throw new Error(`/replay/${battleId} failed with status ${replayRes.status}`);
        }
        const replayData = await replayRes.json();
        if (replayData.id !== battleId || !replayData.endedAt) {
          throw new Error("Invalid or incomplete replay data");
        }
        console.log("[Smoke Test] Replay endpoint verified successfully!");

        clearTimeout(timer);
        p1.disconnect();
        p2.disconnect();
        resolve(true);
      } catch (err) {
        clearTimeout(timer);
        p1.disconnect();
        p2.disconnect();
        reject(err);
      }
    });

    p1.on("error", (err) => {
      clearTimeout(timer);
      p1.disconnect();
      p2.disconnect();
      reject(new Error(`P1 error: ${JSON.stringify(err)}`));
    });

    p2.on("error", (err) => {
      clearTimeout(timer);
      p1.disconnect();
      p2.disconnect();
      reject(new Error(`P2 error: ${JSON.stringify(err)}`));
    });
  });

  console.log("\n============================================================");
  console.log("       SMOKE TEST SUCCEEDED: CONTAINER READY FOR REGISTRY   ");
  console.log("============================================================\n");
}

runSmokeTest().catch((err) => {
  console.error("\n[Smoke Test FAILED]:", err.message);
  process.exit(1);
});
