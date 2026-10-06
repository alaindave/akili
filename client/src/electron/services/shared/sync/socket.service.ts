import { io, Socket } from "socket.io-client";

export type SocketEntity =
  | "employee"
  | "attendance"
  | "leave"
  | "incident"
  | "task"
  | "task_comment"
  | "payroll"
  | "payroll_result"
  | "attendance_daily_check";

export type SocketEvent = "CREATED" | "UPDATED" | "DELETED" | "CHANGED";

export interface EntityChangedEvent {
  entity: SocketEntity | string;
  event: SocketEvent;
  entityId: string;
  serverVersion?: number;
  data?: unknown;
  timestamp: string;
}

type EntityHandler = (event: EntityChangedEvent) => void | Promise<void>;

class SocketService {
  private socket: Socket | null = null;

  private handlers = new Map<string, Set<EntityHandler>>();

  /**
   * ============================================================
   * CONNECT
   * ============================================================
   */
  connect(url: string) {
    if (this.socket?.connected) {
      return;
    }

    console.log("CONNECTING TO SOCKET.IO:", url);

    this.socket = io(url, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    this.socket.on("connect", () => {
      console.log("SOCKET.IO CONNECTED:", this.socket?.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("SOCKET.IO DISCONNECTED:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("SOCKET.IO CONNECTION ERROR:", error.message);
    });

    this.socket.on("entity.changed", (event: EntityChangedEvent) => {
      this.handleEntityChange(event);
    });
  }

  /**
   * ============================================================
   * HANDLE ENTITY CHANGE
   * ============================================================
   */
  private async handleEntityChange(event: EntityChangedEvent) {
    console.log("SOCKET ENTITY CHANGE:", event);

    const handlers = this.handlers.get(event.entity);

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`SOCKET HANDLER FAILED FOR ${event.entity}:`, error);
      }
    }
  }

  /**
   * ============================================================
   * SUBSCRIBE TO ENTITY
   * ============================================================
   */
  subscribe(entity: SocketEntity | string, handler: EntityHandler) {
    let handlers = this.handlers.get(entity);

    if (!handlers) {
      handlers = new Set<EntityHandler>();

      this.handlers.set(entity, handlers);
    }

    handlers.add(handler);

    console.log(`SOCKET SUBSCRIBED TO ${entity.toUpperCase()}`);

    return () => {
      handlers?.delete(handler);

      if (handlers?.size === 0) {
        this.handlers.delete(entity);
      }
    };
  }

  /**
   * ============================================================
   * SUBSCRIBE TO ALL ENTITIES
   * ============================================================
   */
  subscribeAll(handler: EntityHandler) {
    const entities: string[] = [
      "employee",
      "attendance",
      "leave",
      "incident",
      "task",
      "task_comment",
      "payroll",
      "payroll_result",
      "attendance_daily_check",
    ];

    const unsubscribeFunctions = entities.map((entity) =>
      this.subscribe(entity, handler)
    );

    return () => {
      for (const unsubscribe of unsubscribeFunctions) {
        unsubscribe();
      }
    };
  }

  /**
   * ============================================================
   * DISCONNECT
   * ============================================================
   */
  disconnect() {
    if (!this.socket) {
      return;
    }

    console.log("DISCONNECTING SOCKET.IO");

    this.socket.disconnect();

    this.socket = null;
  }

  /**
   * ============================================================
   * IS CONNECTED
   * ============================================================
   */
  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

export default socketService;
