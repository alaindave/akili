import express, { Request, Response } from "express";

import { markAbsentEmployees } from "../../services/markEmployeeAbsent.service.js";

import SystemJob from "../../models/shared/systemJob.model.js";

const router = express.Router();

router.post("/mark-absent", async (req: Request, res: Response) => {
  const secret = req.headers["x-cron-secret"];

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    await SystemJob.findOneAndUpdate(
      {
        job: "markAbsentEmployees",
      },
      {
        job: "markAbsentEmployees",
        lastRun: new Date(),
        status: "success",
        message: "Absence check completed",
        updatedAt: new Date(),
      },
      {
        upsert: true,
      }
    );

    await markAbsentEmployees();

    console.log(`ABSENCE JOB COMPLETED - ${new Date().toISOString()}`);

    return res.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error("AN ERROR OCCURRED WHILE MARKING EMPLOYEES ABSENT:", error);

    await SystemJob.findOneAndUpdate(
      {
        job: "markAbsentEmployees",
      },
      {
        lastRun: new Date(),
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      {
        upsert: true,
      }
    );

    return res.status(500).json({
      success: false,
    });
  }
});

export default router;
