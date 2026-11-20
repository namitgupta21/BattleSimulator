import type { ClientEventMap, ServerEventMap } from "@pokemon/protocol";
import type { ConnectionStatus, GameConnection } from "./GameConnection.js";

type Handler<T> = (data: T) => void;

export class MockGameConnection implements GameConnection {
  private status: ConnectionStatus = "disconnected";
  private handlers = new Map<string, Set<Handler<any>>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  public emittedEvents: Array<{ event: string; data: any }> = [];

  async connect(): Promise<void> {
    this.setStatus("connecting");
    await new Promise((r) => setTimeout(r, 10));
    this.setStatus("connected");
  }

  disconnect(): void {
    this.setStatus("disconnected");
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSocketId(): string | null {
    return this.status === "connected" ? "mock-socket-id" : null;
  }

  on<E extends keyof ServerEventMap>(
    event: E,
    handler: (data: ServerEventMap[E]) => void
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  emit<E extends keyof ClientEventMap>(event: E, data: ClientEventMap[E]): void {
    this.emittedEvents.push({ event, data });
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  clearEmittedEvents(): void {
    this.emittedEvents = [];
  }

  // Test helpers: simulate server events
  simulateServerEvent<E extends keyof ServerEventMap>(
    event: E,
    data: ServerEventMap[E]
  ): void {
    const list = this.handlers.get(event);
    if (list) {
      list.forEach((fn) => fn(data));
    }
  }

  simulateStatusChange(status: ConnectionStatus): void {
    this.setStatus(status);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }
}
