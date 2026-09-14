import "dotenv/config";

import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";

import employees from "./routes/employee.route.js";
import attendances from "./routes/attendance.route.js";
import leaves from "./routes/leave.route.js";
import adminUser from "./routes/admin_user.route.js";
import sync from "./routes/sync.route.js";
import auth from "./routes/authenticate.route.js";
import tasks from "./routes/task.route.js";
import employee_photos from "./routes/employees_photos.route.js";
import employee_documents from "./routes/employees_documents.route.js";
import jobsRouter from "./routes/jobs.route.js";
import notifications from "./routes/notification.route.js";
import { initializeSocketService } from "./services/socket.service.js";

const app = express();

/*
|--------------------------------------------------------------------------
| ENVIRONMENT VALIDATION
|--------------------------------------------------------------------------
*/

const requiredEnvVars = [
  {
    key: "JWT_PRIVATE_KEY",
    name: "JWT Private Key",
  },
  {
    key: "EMAIL_USER",
    name: "Email user",
  },
  {
    key: "EMAIL_PASS",
    name: "Email password",
  },
  {
    key: "MANAGER_EMAIL",
    name: "Manager email",
  },
  {
    key: "MONGO_URI",
    name: "MongoDB URI",
  },
];

for (const item of requiredEnvVars) {
  if (!process.env[item.key]) {
    console.error(`FATAL ERROR: ${item.name} is not defined`);
    process.exit(1);
  }
}

const mongoUri = process.env.MONGO_URI as string;

/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(express.json());
app.use(cors());

/*
|--------------------------------------------------------------------------
| ROUTES
|--------------------------------------------------------------------------
*/

app.use("/employees", employees);
app.use("/documents", employee_documents);
app.use("/photos", employee_photos);
app.use("/attendances", attendances);
app.use("/leaves", leaves);
app.use("/adminUsers", adminUser);
app.use("/tasks", tasks);
app.use("/auth", auth);
app.use("/sync", sync);
app.use("/api/jobs", jobsRouter);
app.use("/notifications", notifications);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| SOCKET.IO
|--------------------------------------------------------------------------
*/

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

initializeSocketService(io);

io.on("connection", (socket) => {
  console.log("SOCKET CONNECTION... SERVER CONNECTED:", socket.id);

  socket.on("disconnect", () => {
    console.log("SOCKET DISCONNECTION... CLIENT DISCONNECTED:", socket.id);
  });
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  console.log("");
  console.log("========================================");
  console.log("STARTING AFRITAN SERVER");
  console.log("========================================");
  console.log("");

  try {
    /*
     * ----------------------------------------------------------
     * 1. CONNECT TO MONGODB
     * ----------------------------------------------------------
     */

    console.log("CONNECTING TO AFRITAN DATABASE...");

    await mongoose.connect(mongoUri);

    console.log("CONNECTED TO AFRITAN DATABASE");

    /*
     * ----------------------------------------------------------
     * 2. VERIFY MONGOOSE CONNECTION
     * ----------------------------------------------------------
    
     */

    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        `MongoDB connection is not ready. ReadyState: ${mongoose.connection.readyState}`
      );
    }

    console.log("MONGODB CONNECTION READY");

    /*
     * ----------------------------------------------------------
     * 3. START CRON JOBS
     * ----------------------------------------------------------
     
     */

    console.log("STARTING BACKGROUND JOBS...");

    await import("./jobs/markEmployeeAbsent.cron.js");

    console.log("BACKGROUND JOBS STARTED");
    console.log("");

    /*
     * ----------------------------------------------------------
     * 4. START HTTP SERVER
     * ----------------------------------------------------------
     */

    server.listen(PORT, () => {
      console.log("");
      console.log("========================================");
      console.log("AFRITAN SERVER READY");
      console.log("========================================");
      console.log(`LISTENING ON PORT ${PORT}...`);
      console.log(`MONGODB READY: YES`);
      console.log(`EMPLOYEE SYNC READY: YES`);
      console.log(`PAYROLL COMPONENTS READY: YES`);
      console.log(`BACKGROUND JOBS READY: YES`);
      console.log("========================================");
      console.log("");
    });
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("FATAL SERVER STARTUP ERROR");
    console.error("========================================");
    console.error("");

    console.error(error);

    /*
     * Close the MongoDB connection if startup failed.
     */
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error("FAILED TO DISCONNECT FROM MONGODB:", disconnectError);
    }

    process.exit(1);
  }
}

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION EVENTS
|--------------------------------------------------------------------------
*/

mongoose.connection.on("connected", () => {
  console.log("MONGOOSE EVENT: CONNECTED");
});

mongoose.connection.on("error", (error) => {
  console.error("MONGOOSE EVENT: ERROR:", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MONGOOSE EVENT: DISCONNECTED");
});

/*
|--------------------------------------------------------------------------
| PROCESS EVENTS
|--------------------------------------------------------------------------
*/

process.on("SIGINT", async () => {
  console.log("");
  console.log("SHUTTING DOWN SERVER...");

  await mongoose.disconnect();

  server.close(() => {
    console.log("HTTP SERVER CLOSED");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("");
  console.log("SHUTTING DOWN SERVER...");

  await mongoose.disconnect();

  server.close(() => {
    console.log("HTTP SERVER CLOSED");
    process.exit(0);
  });
});

/*
|--------------------------------------------------------------------------
| BOOT
|--------------------------------------------------------------------------
*/

startServer();
