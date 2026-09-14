import express, { Request, Response } from "express";
import {
  type EmailNotificationRequest,
  sendEmailNotification,
} from "../services/email.service.js";
import authorize from "../middlewares/authorize.js";

const router = express.Router();

router.post(
  "/email",
  authorize,
  async (req: Request<Record<string, never>, unknown, EmailNotificationRequest>, res: Response) => {
    try {
      if (req.user?.companyId !== req.body.companyId) {
        return res.status(403).json({ success: false, error: "Company access denied." });
      }

      const result = await sendEmailNotification(req.body);
      return res.status(202).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send email notification.";
      console.error("EMAIL NOTIFICATION ERROR:", error);
      return res.status(400).json({ success: false, error: message });
    }
  }
);

export default router;
