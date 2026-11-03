import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room/room.js";
import { ErrorCode } from "@pokemon/protocol";

describe("Room Entity & Lifecycle", () => {
  it("creates room and assigns p1 and p2", () => {
    const room = new Room("CODE12", { teamSize: 3, timerEnabled: true });
    assert.strictEqual(room.id, "CODE12");
    assert.strictEqual(room.state, "WaitingForPlayers");
    assert.strictEqual(room.isFull(), false);

    const p1 = room.addPlayer("Alice", "sock1");
    assert.strictEqual(p1.side, "p1");
    assert.strictEqual(p1.name, "Alice");
    assert.ok(p1.sessionToken.length > 0);
    assert.strictEqual(room.isFull(), false);

    const p2 = room.addPlayer("Bob", "sock2");
    assert.strictEqual(p2.side, "p2");
    assert.strictEqual(p2.name, "Bob");
    assert.ok(p2.sessionToken.length > 0);
    assert.strictEqual(room.isFull(), true);

    // Enforces 2-player limit
    assert.throws(() => {
      room.addPlayer("Charlie", "sock3");
    }, /ROOM_FULL/);
  });

  it("handles ready state transition", () => {
    const room = new Room("TEST01");
    room.addPlayer("Alice", "sock1");
    room.addPlayer("Bob", "sock2");

    assert.strictEqual(room.state, "WaitingForPlayers");

    room.setPlayerReady("p1", true);
    assert.strictEqual(room.state, "WaitingForPlayers");

    room.setPlayerReady("p2", true);
    assert.strictEqual(room.state, "Ready");

    // Unready resets to WaitingForPlayers
    room.setPlayerReady("p1", false);
    assert.strictEqual(room.state, "WaitingForPlayers");
  });

  it("transitions to InProgress and Finished", () => {
    const room = new Room("TEST02");
    room.addPlayer("Alice", "sock1");
    room.addPlayer("Bob", "sock2");
    room.setPlayerReady("p1", true);
    room.setPlayerReady("p2", true);

    room.startBattle();
    assert.strictEqual(room.state, "InProgress");

    room.finishBattle();
    assert.strictEqual(room.state, "Finished");
  });
});
