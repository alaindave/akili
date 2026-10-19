import { Server } from "socket.io";
import jwt from "jsonwebtoken";

export type SocketEntity =
  | "EMPLOYEE"
  | "ATTENDANCE"
  | "LEAVE"
  | "INCIDENT"
  | "TASK"
  | "TASK_COMMENT"
  | "PAYROLL"
  | "PAYROLL_RESULT"
  | "ATTENDANCE_DAILY_CHECK";

export type SocketEvent = "CREATED" | "UPDATED" | "DELETED" | "CHANGED";

export interface EntityChangedEvent {
  entity: SocketEntity | string;
  event: SocketEvent;
  entityId: string;
  serverVersion?: number;
  data?: unknown;
  timestamp: string;
}

let io: Server | null = null;

/**
 * ============================================================
 * INITIALIZE SOCKET SERVICE
 * ============================================================
 */
export function initializeSocketService(socketServer: Server) {
  io = socketServer;
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== "string") throw new Error("Authentication required");
      const identity = jwt.verify(token, process.env.JWT_PRIVATE_KEY!);
      if (typeof identity === "string" || typeof identity._id !== "string" ||
          typeof identity.companyId !== "string" || !identity.companyId) {
        throw new Error("Invalid identity");
      }
      socket.data.companyId = identity.companyId;
      socket.data.expiresAt = identity.exp;
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });
  io.on("connection", (socket) => {
    void socket.join(`company:${socket.data.companyId}`);
  });

  console.log("SOCKET SERVICE INITIALIZED");
}

export interface LateAttendanceEvent {
  _id: string;
  companyId: string;
  attendanceId: string;
  employeeName: string;
  date: string;
  clockIn?: string;
  lateMinutes: number;
  createdAt: string;
}

export function broadcastLateAttendance(event: LateAttendanceEvent) {
  if (!io) return;
  // Expired logins cannot receive alerts through a long-lived socket.
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.expiresAt && socket.data.expiresAt * 1000 <= Date.now()) {
      socket.disconnect(true);
    }
  }
  io.to(`company:${event.companyId}`).emit("attendance.late", event);
}

/**
 * ============================================================
 * BROADCAST ENTITY CHANGE
 * ============================================================
 *
 * Generic method used by all server services.
 *
 * Example:
 *
 * broadcastEntityChange({
 *   entity: "attendance",
 *   event: "created",
 *   entityId: attendance._id.toString(),
 *   serverVersion: attendance.serverVersion,
 * });
 */
export function broadcastEntityChange(options: {
  entity: SocketEntity | string;
  event: SocketEvent;
  entityId: string;
  serverVersion?: number;
  data?: unknown;
}) {
  if (!io) {
    console.warn(
      "SOCKET BROADCAST SKIPPED: SOCKET SERVICE NOT INITIALIZED",
      options
    );

    return;
  }

  const message: EntityChangedEvent = {
    entity: options.entity,
    event: options.event,
    entityId: options.entityId,
    serverVersion: options.serverVersion,
    data: options.data,
    timestamp: new Date().toISOString(),
  };

  console.log("SOCKET BROADCAST:", message);

  io.emit("entity.changed", message);
}

/**
 * ============================================================
 * BROADCAST ATTENDANCE
 * ============================================================
 */
export function broadcastAttendanceChange(options: {
  event: SocketEvent;
  attendanceId: string;
  serverVersion?: number;
}) {
  broadcastEntityChange({
    entity: "attendance",
    event: options.event,
    entityId: options.attendanceId,
    serverVersion: options.serverVersion,
  });
}

/**
 * ============================================================
 * BROADCAST TASK
 * ============================================================
 */
export function broadcastTaskChange(options: {
  event: SocketEvent;
  taskId: string;
  serverVersion?: number;
}) {
  broadcastEntityChange({
    entity: "task",
    event: options.event,
    entityId: options.taskId,
    serverVersion: options.serverVersion,
  });
}

/**
 * ============================================================
 * BROADCAST TASK COMMENT
 * ============================================================
 */
export function broadcastTaskCommentChange(options: {
  event: SocketEvent;
  commentId: string;
  taskId?: string;
  serverVersion?: number;
}) {
  broadcastEntityChange({
    entity: "task_comment",
    event: options.event,
    entityId: options.commentId,
    serverVersion: options.serverVersion,

    data: options.taskId
      ? {
          taskId: options.taskId,
        }
      : undefined,
  });
}

/**
 * ============================================================
 * BROADCAST LEAVE
 * ============================================================
 */
export function broadcastLeaveChange(options: {
  event: SocketEvent;
  leaveId: string;
  serverVersion?: number;
}) {
  broadcastEntityChange({
    entity: "leave",
    event: options.event,
    entityId: options.leaveId,
    serverVersion: options.serverVersion,
  });
}

/**
 * ============================================================
 * BROADCAST EMPLOYEE
 * ============================================================
 */
export function broadcastEmployeeChange(options: {
  event: SocketEvent;
  employeeId: string;
  serverVersion?: number;
}) {
  broadcastEntityChange({
    entity: "employee",
    event: options.event,
    entityId: options.employeeId,
    serverVersion: options.serverVersion,
  });
}

/**
 * ============================================================
 * GET SOCKET.IO INSTANCE
 * ============================================================
 */
export function getSocketIO() {
  if (!io) {
    throw new Error("SOCKET SERVICE HAS NOT BEEN INITIALIZED");
  }

  return io;
}
