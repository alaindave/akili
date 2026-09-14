import axios from "axios";
import { app } from "electron";
import { getToken } from "../../auth.js";
import type {
  EmailDeliveryResult,
  EmailNotification,
} from "../../../common/types/EmailNotification.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

/**
 * Gateway for the cloud email API. Keeping this in the main process prevents
 * the renderer from talking to the notification provider or handling secrets.
 */
export async function sendEmailNotification(
  notification: EmailNotification
): Promise<EmailDeliveryResult> {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  const token = await getToken();

  if (!token) {
    throw new Error("You must be signed in to send email notifications.");
  }

  const response = await axios.post<EmailDeliveryResult>(
    `${API_URL}/notifications/email`,
    notification,
    {
      timeout: 15_000,
      headers: { "x-auth-token": token },
    }
  );

  return response.data;
}
