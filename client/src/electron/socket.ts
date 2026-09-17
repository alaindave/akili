import { BrowserWindow } from "electron";
import { io, Socket } from "socket.io-client";
import Task from "../common/types/task/Task.js";
import { getToken } from "./auth.js";

let socket: Socket | null = null;

const API_URL = process.env.VITE_API_URL || "http://localhost:5000";

export async function createSocket(
  mainWindow: BrowserWindow
): Promise<Socket | null> {
  try {
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
