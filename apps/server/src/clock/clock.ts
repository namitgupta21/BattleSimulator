export interface TimerHandle {
  cancel: () => void;
}

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): TimerHandle;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const handle = globalThis.setTimeout(callback, ms);
    if (typeof (handle as any).unref === "function") {
      (handle as any).unref();
    }
    return {
      cancel: () => globalThis.clearTimeout(handle),
    };
  }
}

interface QueuedTimer {
  id: number;
  dueTime: number;
  callback: () => void;
  cancelled: boolean;
}

export class FakeClock implements Clock {
  private currentTime: number;
  private nextTimerId: number = 1;
  private timers: QueuedTimer[] = [];

  constructor(initialTime: number = 1000000000000) {
    this.currentTime = initialTime;
  }

  now(): number {
    return this.currentTime;
  }

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const timer: QueuedTimer = {
      id: this.nextTimerId++,
      dueTime: this.currentTime + ms,
      callback,
      cancelled: false,
    };
    this.timers.push(timer);
    return {
      cancel: () => {
        timer.cancelled = true;
      },
    };
  }

  tick(ms: number): void {
    if (ms <= 0) return;
    this.currentTime += ms;

    while (true) {
      // Find all ready, uncancelled timers
      const readyIndices = this.timers
        .map((t, index) => ({ t, index }))
        .filter(({ t }) => !t.cancelled && t.dueTime <= this.currentTime)
        .sort((a, b) => a.t.dueTime - b.t.dueTime);

      if (readyIndices.length === 0) {
        break;
      }

      const next = readyIndices[0];
      // Mark as cancelled/processed so it doesn't fire again
      next.t.cancelled = true;
      // Remove from timers list
      this.timers.splice(next.index, 1);
      next.t.callback();
    }

    // Clean up cancelled timers
    this.timers = this.timers.filter((t) => !t.cancelled);
  }

  hasPendingTimers(): boolean {
    return this.timers.some((t) => !t.cancelled);
  }
}
