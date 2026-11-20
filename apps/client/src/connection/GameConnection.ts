import type { ClientEventMap, ServerEventMap } from "@pokemon/protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface GameConnection {
  connect(): Promise<void>;
  disconnect(): void;
  getStatus(): ConnectionStatus;
  getSocketId(): string | null;
  on<E extends keyof ServerEventMap>(
    event: E,
    handler: (data: ServerEventMap[E]) => void
  ): () => void;
  emit<E extends keyof ClientEventMap>(event: E, data: ClientEventMap[E]): void;
  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void;
}
