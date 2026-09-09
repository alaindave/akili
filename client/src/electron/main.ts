import "dotenv/config";

import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import { initializeDatabase } from "./database/initializeDatabase.js";
import { getPreloadPath } from "./pathResolver.js";
import { registerIPCHandlers } from "./registerIPCHandlers.js";

import { markEmployeesOnLeave } from "./services/attendance/markEmployeesOnLeave.service.js";

import {
  initializeEmployeePayrollProfiles,
  removeDeletedPayrollComponentsFromEmployeeProfiles,
} from "./services/payroll/payrollProfile.service.js";

import {
  startBackgroundSync,
  stopBackgroundSync,
} from "./services/sync/backgroundSync.service.js";

import { createSocket } from "./socket.js";
import { ensureStorageDirectories } from "./storage/directories.js";
import { isDev } from "./util/env.util.js";
import { getCompanyId } from "./database/repositories/companies.repository.js";
import { getInstallationId } from "./util/installationId.js";

/* =========================================================
   PATHS
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   ENVIRONMENT
========================================================= */

const DEV = isDev();

const environment = DEV ? "Development" : "Production";

/*
 * =========================================================
 * INSTALLATION ID
 * =========================================================
 */

const installationId = getInstallationId();

console.log("INSTALLATION ID:", installationId);

/*
 * Each installation gets its own Electron userData directory.
 */
app.setPath(
  "userData",
  path.join(app.getPath("appData"), "Akili", installationId)
);

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

console.log("========================================");
console.log("LEATHER WORKS STARTING");
console.log("========================================");
console.log("ENVIRONMENT:", environment);
console.log("API URL:", API_URL);

/* =========================================================
   ELECTRON CONFIGURATION
========================================================= */

/*
 * IMPORTANT:
 * Must be called BEFORE app.whenReady().
 */
app.disableHardwareAcceleration();

/* =========================================================
   WINDOWS
========================================================= */

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

/* =========================================================
   SPLASH CONFIGURATION
========================================================= */

const SPLASH_MINIMUM_TIME = 4000;
const SPLASH_FADE_TIME = 500;

let splashStartedAt = 0;

/* =========================================================
   UTILITIES
========================================================= */

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/* =========================================================
   SPLASH WINDOW
========================================================= */

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 780,
    height: 580,
    center: true,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    backgroundColor: "#020817",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashPath = DEV
    ? path.join(process.cwd(), "src/electron/splash.html")
    : path.join(__dirname, "../../dist/splash.html");

  console.log("SPLASH PATH:", splashPath);

  splash.once("ready-to-show", () => {
    if (!splash.isDestroyed()) {
      splash.show();
    }
  });

  splash.webContents.once(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error("SPLASH FAILED TO LOAD:", errorCode, errorDescription);

      /*
       * Show the splash anyway so the user isn't
       * left staring at a blank screen.
       */
      if (!splash.isDestroyed()) {
        splash.show();
      }
    }
  );

  splash.loadFile(splashPath).catch((error) => {
    console.error("FAILED TO LOAD SPLASH:", error);
  });

  splashStartedAt = Date.now();

  return splash;
}

/* =========================================================
   CLOSE SPLASH WINDOW
========================================================= */

async function closeSplashWindow(): Promise<void> {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  /*
   * Make sure the splash has been displayed
   * for at least the minimum amount of time.
   */
  const elapsed = Date.now() - splashStartedAt;

  if (elapsed < SPLASH_MINIMUM_TIME) {
    await delay(SPLASH_MINIMUM_TIME - elapsed);
  }

  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  /*
   * Fade out the splash.
   *
   * The splash.html must contain:
   *
   * body {
   *   opacity: 1;
   *   transition: opacity 0.5s ease;
   * }
   *
   * body.fade-out {
   *   opacity: 0;
   * }
   */
  try {
    await splashWindow.webContents.executeJavaScript(`
      document.body.classList.add("fade-out");
    `);

    await delay(SPLASH_FADE_TIME);
  } catch (error) {
    console.warn("FAILED TO ANIMATE SPLASH WINDOW:", error);
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }

  splashWindow = null;
}

/* =========================================================
   MAIN WINDOW
========================================================= */

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(),
    },
  });

  mainWindow = window;

  console.log("CREATING MAIN WINDOW...");

  /* -------------------------------------------------------
     SOCKET
  ------------------------------------------------------- */

  try {
    await createSocket(window);

    console.log("SOCKET INITIALIZED.");
  } catch (error) {
    /*
     * Socket failure should not prevent
     * the application from starting.
     */
    console.error("FAILED TO INITIALIZE SOCKET:", error);
  }

  /* -------------------------------------------------------
     LOAD RENDERER
  ------------------------------------------------------- */

  try {
    if (DEV) {
      console.log("LOADING DEVELOPMENT RENDERER...");

      await window.loadURL("http://localhost:5173");
    } else {
      console.log("LOADING PRODUCTION RENDERER...");

      await window.loadFile(path.join(__dirname, "../../dist/index.html"));
    }

    console.log("RENDERER FINISHED LOADING.");
  } catch (error) {
    console.error("FAILED TO LOAD RENDERER:", error);

    throw error;
  }

  /* -------------------------------------------------------
     CLOSE SPLASH
  ------------------------------------------------------- */

  await closeSplashWindow();

  /* -------------------------------------------------------
     SHOW MAIN WINDOW
  ------------------------------------------------------- */

  if (!window.isDestroyed()) {
    window.show();
    window.focus();

    console.log("MAIN WINDOW DISPLAYED.");
  }

  /* -------------------------------------------------------
     CLEANUP
  ------------------------------------------------------- */

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeAppDatabase(): Promise<void> {
  console.log("INITIALIZING DATABASE...");
  await initializeDatabase();
  console.log("DATABASE INITIALIZED.");

  /*
   * Payroll maintenance.
   */
  const companyId = await getCompanyId();

  if (companyId) {
    console.log("REMOVING DELETED PAYROLL COMPONENTS...");
    await removeDeletedPayrollComponentsFromEmployeeProfiles(companyId);
    console.log("INITIALIZING EMPLOYEE PAYROLL PROFILES...");
    await initializeEmployeePayrollProfiles(companyId);
    console.log("PAYROLL INITIALIZATION COMPLETE.");
  } else {
    console.log("PAYROLL INITIALIZATION CANCELLED.NO COMPANY ID PROVIDED.");
  }
}

/* =========================================================
   LOCAL STORAGE INITIALIZATION
========================================================= */

async function initializeLocalStorage(): Promise<void> {
  console.log("INITIALIZING STORAGE DIRECTORIES...");

  await ensureStorageDirectories();

  console.log("STORAGE DIRECTORIES READY.");
}

/* =========================================================
   IPC INITIALIZATION
========================================================= */

function initializeIPC(): void {
  console.log("REGISTERING IPC HANDLERS...");

  registerIPCHandlers();

  console.log("IPC HANDLERS REGISTERED.");
}

/* =========================================================
   ATTENDANCE INITIALIZATION
========================================================= */

async function initializeAttendance(): Promise<void> {
  console.log("PROCESSING TODAY'S APPROVED LEAVES...");
  const companyId = await getCompanyId();
  if (!companyId) return;
  try {
    const result = await markEmployeesOnLeave(companyId);
    console.log("MARK EMPLOYEES ON LEAVE RESULT:", result);
  } catch (error) {
    console.error("FAILED TO PROCESS EMPLOYEES ON LEAVE:", error);
  }
}

/* =========================================================
   BACKGROUND SERVICES
========================================================= */

/* =========================================================
   BACKGROUND SERVICES
========================================================= */

async function startBackgroundServices(): Promise<void> {
  console.log("STARTING BACKGROUND SERVICES...");

  try {
    const companyId = await getCompanyId();

    if (companyId) {
      console.log(`STARTING BACKGROUND SYNC FOR COMPANY: ${companyId}`);

      startBackgroundSync(companyId);

      console.log(`BACKGROUND SERVICES STARTED FOR COMPANY: ${companyId}`);
    } else {
      console.log("NO COMPANY ID FOUND. BACKGROUND SYNC WILL NOT START.");
    }
  } catch (error) {
    console.error("FAILED TO START BACKGROUND SERVICES:", error);
  }
}
/* =========================================================
   APPLICATION BOOTSTRAP
========================================================= */

async function bootstrap(): Promise<void> {
  try {
    /*
     * -----------------------------------------------------
     * 1. ELECTRON READY
     * -----------------------------------------------------
     */

    await app.whenReady();

    console.log("ELECTRON READY.");

    /*
     * -----------------------------------------------------
     * 2. CREATE SPLASH IMMEDIATELY
     * -----------------------------------------------------
     *
     * Everything else happens behind it.
     */

    splashWindow = createSplashWindow();

    /*
     * -----------------------------------------------------
     * 3. DATABASE
     * -----------------------------------------------------
     */

    await initializeAppDatabase();

    /*
     * -----------------------------------------------------
     * 4. STORAGE
     * -----------------------------------------------------
     */

    await initializeLocalStorage();

    /*
     * -----------------------------------------------------
     * 5. IPC
     * -----------------------------------------------------
     */

    initializeIPC();

    /*
     * -----------------------------------------------------
     * 6. MAIN WINDOW
     * -----------------------------------------------------
     *
     * createMainWindow() will:
     *
     * - Load React
     * - Wait for renderer
     * - Close splash
     * - Show main window
     */

    await createMainWindow();

    /*
     * -----------------------------------------------------
     * 7. ATTENDANCE
     * -----------------------------------------------------
     */

    await initializeAttendance();

    /*
     * -----------------------------------------------------
     * 8. BACKGROUND SERVICES
     * -----------------------------------------------------
     */

    await startBackgroundServices();
    /*
     * -----------------------------------------------------
     * STARTUP COMPLETE
     * -----------------------------------------------------
     */

    console.log("========================================");

    console.log("LEATHER WORKS STARTED SUCCESSFULLY");

    console.log("========================================");
  } catch (error) {
    console.error("========================================");

    console.error("APPLICATION STARTUP FAILED");

    console.error("========================================");

    console.error(error);

    /*
     * Close splash if startup fails.
     */
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    /*
     * Close main window if startup
     * failed after it was created.
     */
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
      mainWindow = null;
    }
  }
}

/* =========================================================
   APPLICATION EVENTS
========================================================= */

app.on("window-all-closed", () => {
  /*
   * macOS:
   * Keep application alive when all windows
   * are closed.
   */

  if (process.platform !== "darwin") {
    app.quit();
  }
});

/* =========================================================
   MACOS ACTIVATE
========================================================= */

app.on("activate", async () => {
  /*
   * macOS:
   * Clicking the Dock icon when no window
   * exists should recreate the main window.
   */

  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log("APPLICATION ACTIVATED WITHOUT MAIN WINDOW.");

    splashWindow = createSplashWindow();

    try {
      await createMainWindow();
    } catch (error) {
      console.error("FAILED TO RECREATE MAIN WINDOW:", error);
    }
  }
});

/* =========================================================
   APPLICATION QUIT
========================================================= */

app.on("will-quit", () => {
  console.log("APPLICATION QUITTING...");

  try {
    stopBackgroundSync();
  } catch (error) {
    console.error("FAILED TO STOP BACKGROUND SYNC:", error);
  }
});

/* =========================================================
   PROCESS ERROR HANDLERS
========================================================= */

process.on("uncaughtException", (error) => {
  console.error("========================================");

  console.error("UNCAUGHT EXCEPTION");

  console.error("========================================");

  console.error(error);
});

process.on("unhandledRejection", (reason) => {
  console.error("========================================");

  console.error("UNHANDLED PROMISE REJECTION");

  console.error("========================================");

  console.error(reason);
});

/* =========================================================
   START APPLICATION
========================================================= */

bootstrap();
