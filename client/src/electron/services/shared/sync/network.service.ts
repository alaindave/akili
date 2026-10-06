import axios from "axios";
import { app, BrowserWindow } from "electron";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

export class NetworkService {
  static async hasInternetAccess(): Promise<boolean> {
    try {
      const response = await axios.get(
        "https://clients3.google.com/generate_204",
        {
          timeout: 5_000,
          validateStatus: () => true,
        }
      );

      return response.status >= 200 && response.status < 400;
    } catch (error) {
      console.log("NO INTERNET CONNECTION.");

      return false;
    }
  }

  static async canReachBackend(): Promise<boolean> {
    /*
     * ---------------------------------------------------------
     * STEP 1: CHECK INTERNET CONNECTION
     * ---------------------------------------------------------
     */

    const hasInternet = await this.hasInternetAccess();

    if (!hasInternet) {
      console.log("NO INTERNET CONNECTION. BACKEND CHECK SKIPPED.");

      notifyRenderer({
        status: "OFFLINE",
        timestamp: new Date().toISOString(),
      });

      return false;
    }

    /*
     * ---------------------------------------------------------
     * STEP 2: CHECK BACKEND
     * ---------------------------------------------------------
     */

    const maxWaitTime = 60_000; // 60 seconds
    const requestTimeout = 8_000; // 8 seconds per request
    const retryDelay = 3_000; // 3 seconds between attempts

    const startTime = Date.now();

    console.log(`CHECKING BACKEND AVAILABILITY: ${API_URL}/health`);

    while (Date.now() - startTime < maxWaitTime) {
      const elapsed = Date.now() - startTime;

      try {
        console.log(`WAKING BACKEND... (${Math.round(elapsed / 1000)}s)`);

        const response = await axios.get(`${API_URL}/health`, {
          timeout: requestTimeout,
        });

        if (response.status >= 200 && response.status < 300) {
          const wakeTime = Date.now() - startTime;

          console.log(
            `BACKEND AVAILABLE AFTER ${Math.round(wakeTime / 1000)}s`
          );

          notifyRenderer({
            status: "IDLE",
            timestamp: new Date().toISOString(),
          });

          return true;
        }
      } catch (error) {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

        console.log(`BACKEND NOT READY YET (${elapsedSeconds}s)`);
      }

      /*
       * Don't wait after the 60-second window.
       */
      if (Date.now() - startTime >= maxWaitTime) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    /*
     * ---------------------------------------------------------
     * BACKEND COULD NOT BE REACHED
     * ---------------------------------------------------------
     */

    console.error("BACKEND COULD NOT BE REACHED AFTER 60 SECONDS");

    notifyRenderer({
      status: "OFFLINE",
      timestamp: new Date().toISOString(),
    });

    return false;
  }
}

/**
 * Notify all renderer windows about backend/network status.
 */
function notifyRenderer(event: {
  status: "IDLE" | "OFFLINE";
  timestamp: string;
}) {
  console.log("NETWORK STATUS EVENT:", event);

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("sync:status", event);
    }
  });
}
