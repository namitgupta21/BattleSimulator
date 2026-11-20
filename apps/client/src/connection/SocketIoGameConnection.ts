import { io, type Socket } from "socket.io-client";
import type { ClientEventMap, ServerEventMap } from "@pokemon/protocol";
import type { ConnectionStatus, GameConnection } from "./GameConnection.js";

export class SocketIoGameConnection implements GameConnection {
  private socket: Socket | null = null;
  private status: ConnectionStatus = "disconnected";
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private handlers = new Map<string, Set<(data: any) => void>>();
  private socketListeners = new Map<string, (data: any) => void>();
  private connectPromise: Promise<void> | null = null;
  private serverUrl: string;

  constructor(serverUrl?: string) {
    this.serverUrl =
      serverUrl ||
      import.meta.env?.VITE_SERVER_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");
  }

  connect(): Promise<void> {
    if (this.socket && this.socket.connected) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.setStatus("connecting");

    this.connectPromise = new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        this.socket = io(this.serverUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        // Attach all currently registered handlers
        this.bindAllHandlersToSocket();

        this.socket.on("connect", () => {
          this.setStatus("connected");
          this.connectPromise = null;
          resolve();
        });

        this.socket.on("connect_error", (err) => {
          if (this.status === "connecting") {
            this.setStatus("disconnected");
            this.connectPromise = null;
            reject(err);
          }
        });

        this.socket.on("disconnect", (reason) => {
          if (reason === "io client disconnect") {
            this.setStatus("disconnected");
          } else {
            this.setStatus("reconnecting");
          }
        });

        this.socket.io.on("reconnect", () => {
          this.setStatus("connected");
        });

        this.socket.io.on("reconnect_failed", () => {
          this.setStatus("disconnected");
        });
      } else {
        this.socket.connect();
      }
    });

    return this.connectPromise;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.connectPromise = null;
    this.setStatus("disconnected");
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSocketId(): string | null {
    return this.socket?.id ?? null;
  }

  on<E extends keyof ServerEventMap>(
    event: E,
    handler: (data: ServerEventMap[E]) => void
  ): () => void {
    if (!this.handlers.has(event as string)) {
      this.handlers.set(event as string, new Set());
    }
    this.handlers.get(event as string)!.add(handler);

    // If socket exists, ensure we have an event listener hooked
    this.ensureSocketListener(event as string);

    return () => {
      const set = this.handlers.get(event as string);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.handlers.delete(event as string);
          this.removeSocketListener(event as string);
        }
      }
    };
  }

  emit<E extends keyof ClientEventMap>(event: E, data: ClientEventMap[E]): void {
    if (!this.socket) {
      throw new Error("Cannot emit before socket is initialized");
    }
    this.socket.emit(event, data);
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private ensureSocketListener(event: string): void {
    if (!this.socket || this.socketListeners.has(event)) return;

    const listener = (payload: any) => {
      const set = this.handlers.get(event);
      if (set) {
        set.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error(`Error in handler for event "${event}":`, err);
          }
        });
      }
    };

    this.socketListeners.set(event, listener);
    this.socket.on(event, listener);
  }

  private removeSocketListener(event: string): void {
    if (!this.socket) return;
    const listener = this.socketListeners.get(event);
    if (listener) {
      this.socket.off(event, listener);
      this.socketListeners.delete(event);
    }
  }

  private bindAllHandlersToSocket(): void {
    if (!this.socket) return;
    for (const event of this.handlers.keys()) {
      this.ensureSocketListener(event);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (err) {
        console.error("Error in status listener:", err);
      }
    });
  }
}
