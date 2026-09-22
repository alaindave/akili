import {
  getPendingNotifications,
  markNotificationFailed,
  markNotificationProcessing,
  markNotificationSent,
} from "../../database/repositories/shared/notificationQueue.repository.js";
import { NetworkService } from "../sync/network.service.js";
import { sendNotificationEmail } from "./email.service.js";
import { calculateNotificationRetryTime } from "./notificationRetry.service.js";

/*
 * Prevent multiple notification queue processors from
 * running at the same time inside the Electron main process.
 */
let isProcessingNotificationQueue = false;

export async function processNotificationQueue(): Promise<void> {
  /*
   * -------------------------------------------------------
   * PREVENT CONCURRENT PROCESSORS
   * -------------------------------------------------------
   */

  if (isProcessingNotificationQueue) {
    console.log(
      "NOTIFICATION QUEUE: processing already in progress. Skipping."
    );

    return;
  }

  isProcessingNotificationQueue = true;

  try {
    /*
     * -----------------------------------------------------
     * CHECK BACKEND AVAILABILITY
     * -----------------------------------------------------
     */

    const backendAvailable = await NetworkService.canReachBackend();

    if (!backendAvailable) {
      console.log(
        "NOTIFICATION QUEUE: backend unavailable. Notifications remain queued."
      );

      return;
    }

    /*
     * -----------------------------------------------------
     * GET PENDING NOTIFICATIONS
     * -----------------------------------------------------
     */

    const notifications = await getPendingNotifications(20);

    if (notifications.length === 0) {
      return;
    }

    console.log(
      `NOTIFICATION QUEUE: processing ${notifications.length} notification(s).`
    );

    /*
     * -----------------------------------------------------
     * PROCESS NOTIFICATIONS
     * -----------------------------------------------------
     */

    for (const notification of notifications) {
      try {
        /*
         * Mark as PROCESSING before sending.
         */
        await markNotificationProcessing(notification.queueId);

        /*
         * Send notification.
         */
        const result = await sendNotificationEmail({
          type: notification.type,
          companyId: notification.companyId,
          recipientEmail: notification.recipientEmail,
          title: notification.title,
          message: notification.message,
          attachments: notification.attachments,
        });

        if (!result.success) {
          throw new Error(result.error || "Notification email failed.");
        }

        await markNotificationSent(notification.queueId);

        console.log(`NOTIFICATION SENT: ${notification.queueId}`);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown notification error.";

        const nextAttemptAt = calculateNotificationRetryTime(
          notification.attempts
        );

        await markNotificationFailed(
          notification.queueId,
          message,
          nextAttemptAt
        );

        console.error(`NOTIFICATION FAILED: ${notification.queueId}`, message);
      }
    }
  } catch (error) {
    console.error("NOTIFICATION QUEUE: unexpected processing error:", error);
  } finally {
    isProcessingNotificationQueue = false;
  }
}
