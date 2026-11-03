import { Room } from "../room/room.js";

export interface RoomStore {
  save(room: Room): void;
  get(roomId: string): Room | null;
  delete(roomId: string): void;
  findByPlayerToken(token: string): Room | null;
  findBySocketId(socketId: string): Room | null;
  all(): Room[];
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  save(room: Room): void {
    this.rooms.set(room.id.toUpperCase(), room);
  }

  get(roomId: string): Room | null {
    return this.rooms.get(roomId.toUpperCase()) ?? null;
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId.toUpperCase());
  }

  findByPlayerToken(token: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.getPlayerByToken(token)) {
        return room;
      }
    }
    return null;
  }

  findBySocketId(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.getPlayerBySocketId(socketId)) {
        return room;
      }
    }
    return null;
  }

  all(): Room[] {
    return Array.from(this.rooms.values());
  }
}
