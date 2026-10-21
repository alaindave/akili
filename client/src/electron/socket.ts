import { app, BrowserWindow } from "electron";
import { io, Socket } from "socket.io-client";
import Task from "../common/types/task/Task.js";
import { getToken, getActiveCompanyId } from "./auth.js";
import { z } from "zod";
import { showAppNotification } from "./services/shared/notification/appNotification.service.js";

const lateAttendanceSchema = z.object({
  _id: z.string().min(1),
  companyId: z.string().min(1),
  attendanceId: z.string().min(1),
  employeeName: z.string().min(1),
  date: z.string(),
  clockIn: z.string().datetime().optional(),
  lateMinutes: z.number().finite().nonnegative(),
  createdAt: z.string().datetime(),
});

let socket: Socket | null = null;

const API_URL = app.isPackaged
  ? process.env.PRODUCTION_API_URL
  : process.env.VITE_API_URL;

export async function createSocket(
  mainWindow: BrowserWindow
): Promise<Socket | null> {
  try {
    socket?.disconnect();
    const token = await getToken();

    if (!token) {
      console.warn("No auth token found for socket connection");
      return null;
    }

    socket = io(`${API_URL}`, {
      auth: {
        token,
      },
    });
    const connection = socket;

    connection.on("attendance.late", async (payload: unknown) => {
      try {
        const parsed = lateAttendanceSchema.safeParse(payload);
        if (!parsed.success) return;
        const event = parsed.data;
        const companyId = await getActiveCompanyId();
        if (
          socket !== connection ||
          !connection.connected ||
          companyId !== event.companyId
        )
          return;
        const arrival = event.clockIn
          ? ` à ${new Date(event.clockIn).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "";
        const displayDate = event.date.replace(
          /^(\d{4})-(\d{2})-(\d{2})$/,
          "$3-$2-$1"
        );
        showAppNotification({
          _id: event._id,
          title: "Retard",
          type: "WARNING",
          createdAt: event.createdAt,
          message: `${event.employeeName} est arrivé${arrival}, avec ${event.lateMinutes} minutes de retard (${displayDate}).`,
        });
      } catch (error) {
        console.error("LATE ATTENDANCE NOTIFICATION FAILED:", error);
      }
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    // Tasks event
    socket.on("new-task", (data: Task) => {
      console.log("Live task received from server:", data);
      mainWindow.webContents.send("task:new", data);
    });

    return socket;
  } catch (error) {
    console.error("Socket initialization error:", error);
    return null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
