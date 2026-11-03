import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FakeClock } from "../src/clock/clock.js";

describe("FakeClock", () => {
  it("maintains virtual time and triggers timer on tick", () => {
    const clock = new FakeClock(1000);
    let called = false;

    clock.setTimeout(() => {
      called = true;
    }, 5000);

    assert.strictEqual(called, false);
    clock.tick(4999);
    assert.strictEqual(called, false);
    assert.strictEqual(clock.now(), 5999);

    clock.tick(1);
    assert.strictEqual(called, true);
    assert.strictEqual(clock.now(), 6000);
  });

  it("fires timers in chronological order", () => {
    const clock = new FakeClock(0);
    const order: number[] = [];

    clock.setTimeout(() => order.push(2), 200);
    clock.setTimeout(() => order.push(1), 100);
    clock.setTimeout(() => order.push(3), 300);

    clock.tick(500);
    assert.deepStrictEqual(order, [1, 2, 3]);
  });

  it("does not fire cancelled timers", () => {
    const clock = new FakeClock(0);
    let called = false;

    const timer = clock.setTimeout(() => {
      called = true;
    }, 1000);

    timer.cancel();
    clock.tick(2000);
    assert.strictEqual(called, false);
  });
});
