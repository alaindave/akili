import express, { Request, Response } from "express";

import { saveTask, getTasks } from "../db.js";

const router = express.Router();

interface CreateTaskBody {
  companyId: string;
  author: string;
  recipients: string[];
  message: string;
}

interface IoRequest extends Request {
  app: Request["app"] & {
    get(name: "io"): {
      emit: (event: string, data: unknown) => void;
    };
  };
}

// Tasks by the manager
router.post(
  "/",
  async (req: Request<{}, {}, CreateTaskBody>, res: Response) => {
    try {
      const io = req.app.get("io");

      const task = {
        companyId: req.body.companyId,
        author: req.body.author,
        recipients: req.body.recipients,
        message: req.body.message,
        createdAt: new Date(),
      };

      const savedTask = await saveTask(task);

      console.log("SAVED TASK:", savedTask);

      io.emit("new-task", savedTask);

      return res.status(201).send(savedTask);
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE CREATING TASK:", error);

      return res.status(500).send(error);
    }
  }
);

// Get all tasks
router.get("/", async (req: Request, res: Response) => {
  try {
    const tasks = await getTasks();

    console.log("Fetched tasks:", tasks);

    return res.status(200).send(tasks);
  } catch (error) {
    console.error("An error occurred while fetching tasks:", error);

    return res.status(500).send(error);
  }
});

export default router;
