import axios from "axios";
import { app } from "electron";
import FormData from "form-data";
import fs from "fs";
import path from "path";

import { getToken } from "../../auth.js";

import {
  getUnsyncedItems,
  markManySynced,
} from "../../database/repositories/sync.repository.js";

import { markCompanySynced } from "../../database/repositories/companies.repository.js";
import { markEmployeeSynced } from "../../database/repositories/employees.repository.js";
import { markAttendanceSynced } from "../../database/repositories/attendances.repository.js";
import { markLeaveSynced } from "../../database/repositories/leaves.repository.js";
import { markTaskSynced } from "../../database/repositories/tasks.repository.js";
import { markTaskCommentsSynced } from "../../database/repositories/tasks_comments.repository.js";
import { markEmployeePhotoSynced } from "../../database/repositories/employees_photos.repository.js";
import { markEmployeeDocumentSynced } from "../../database/repositories/employees_documents.repository.js";

import { markPayrollComponentSynced } from "../../database/repositories/payroll_components.repository.js";
import { markPayrollEmployeeProfileSynced } from "../../database/repositories/payroll_employee_profile.repository.js";

import {
  markPayrollItemSynced,
  markPayrollResultSynced,
  markPayrollRunSynced,
} from "../../database/repositories/payroll_run.repository.js";

import { markPayrollSettingsSynced } from "../../database/repositories/payroll_settings.repository.js";
import { markAttendanceDailyCheckSynced } from "../../database/repositories/attendanceDailyCheck.repository.js";

import {
  getEmployeeDocumentsDir,
  getEmployeePhotoDir,
} from "../../storage/directories.js";

// IMPORTANT:
// Use the employee document repository to check whether the
// document still exists locally.
import { getEmployeeDocument } from "../../database/repositories/employees_documents.repository.js";
import { enqueueNotification } from "../../database/repositories/notificationQueue.repository.js";
import { processNotificationQueue } from "../email/notificationQueue.service.js";
import { notifyManagerOfAttendanceDailyCheck } from "../attendance/attendanceNotification.service.js";
import { getMonthName } from "../../util/monthFormatter.util.js";

// Notification queue

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

interface PushPendingChangesResult {
  pendingChanges: number;
  syncedCount: number;
}

export async function pushPendingChanges(
  companyId: string
): Promise<PushPendingChangesResult> {
  if (!companyId) {
    throw new Error("PUSH SYNC: companyId is required");
  }

  console.log("PUSH SERVICE API URL:", API_URL);
  console.log("PUSH SERVICE COMPANY ID:", companyId);

  /*
   * ---------------------------------------------------------
   * GET AUTH TOKEN
   * ---------------------------------------------------------
   */

  const token = await getToken();

  if (!token) {
    throw new Error("PUSH SYNC: authentication token is missing");
  }

  /*
   * ---------------------------------------------------------
   * GET PENDING ITEMS FOR THIS COMPANY ONLY
   * ---------------------------------------------------------
   */

  const pending = await getUnsyncedItems(companyId);

  if (!pending.length) {
    console.log("NO PENDING CHANGES TO PUSH.", {
      companyId,
    });

    return {
      pendingChanges: 0,
      syncedCount: 0,
    };
  }

  console.log("ITEMS TO PUSH SYNC:", {
    companyId,
    count: pending.length,
    items: pending,
  });

  /*
   * ---------------------------------------------------------
   * VALIDATE COMPANY IDS
   * ---------------------------------------------------------
   */

  for (const item of pending) {
    if (item.companyId !== companyId) {
      throw new Error(
        `SYNC QUEUE COMPANY MISMATCH: ` +
          `item ${item._id} belongs to ${item.companyId}, ` +
          `but current company is ${companyId}`
      );
    }

    let data: any;

    try {
      data = JSON.parse(item.payload);
    } catch {
      throw new Error(`INVALID SYNC PAYLOAD FOR ITEM ${item._id}`);
    }

    if (!data.companyId) {
      throw new Error(`Cannot push sync item ${item._id}: missing companyId`);
    }

    if (data.companyId !== companyId) {
      throw new Error(
        `SYNC PAYLOAD COMPANY MISMATCH: ` +
          `item ${item._id} belongs to ${data.companyId}, ` +
          `but current company is ${companyId}`
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * REMOVE OBSOLETE EMPLOYEE DOCUMENT UPDATES
   * ---------------------------------------------------------
   */

  const obsoleteQueueIds: string[] = [];

  const validPending = [];

  for (const item of pending) {
    if (item.entity === "employee_document" && item.operation === "update") {
      const data = JSON.parse(item.payload);

      const existingDocument = await getEmployeeDocument(
        companyId,
        data.employeeId,
        data.documentType
      );

      if (!existingDocument) {
        console.warn("SKIPPING OBSOLETE EMPLOYEE DOCUMENT UPDATE:", {
          queueId: item._id,
          companyId,
          employeeId: data.employeeId,
          documentId: data._id,
          documentType: data.documentType,
        });

        obsoleteQueueIds.push(item._id);

        continue;
      }
    }

    validPending.push(item);
  }

  /*
   * ---------------------------------------------------------
   * MARK OBSOLETE QUEUE ITEMS AS SYNCED
   * ---------------------------------------------------------
   */

  if (obsoleteQueueIds.length > 0) {
    await markManySynced(companyId, obsoleteQueueIds);

    console.log("MARKED OBSOLETE EMPLOYEE DOCUMENT UPDATES AS SYNCED:", {
      companyId,
      count: obsoleteQueueIds.length,
      queueIds: obsoleteQueueIds,
    });
  }

  /*
   * ---------------------------------------------------------
   * NOTHING LEFT TO PUSH
   * ---------------------------------------------------------
   */

  if (!validPending.length) {
    const remainingPending = await getUnsyncedItems(companyId);

    console.log("PUSH COMPLETE - ONLY OBSOLETE ITEMS WERE FOUND:", {
      companyId,
      skipped: obsoleteQueueIds.length,
      stillPending: remainingPending.length,
    });

    return {
      pendingChanges: remainingPending.length,
      syncedCount: obsoleteQueueIds.length,
    };
  }

  /*
   * ---------------------------------------------------------
   * CREATE FORM DATA
   * ---------------------------------------------------------
   */

  const form = new FormData();

  const items = validPending.map((item) => {
    const data = JSON.parse(item.payload);

    return {
      queueId: item._id,
      companyId: item.companyId,
      entity: item.entity,
      operation: item.operation,
      data,
    };
  });

  /*
   * ---------------------------------------------------------
   * SYNC METADATA
   * ---------------------------------------------------------
   */

  form.append("items", JSON.stringify(items));

  /*
   * ---------------------------------------------------------
   * ATTACH FILES
   * ---------------------------------------------------------
   */

  for (const item of validPending) {
    const data = JSON.parse(item.payload);

    switch (item.entity) {
      case "employee_photo": {
        const photoPath = path.join(getEmployeePhotoDir(), data.photo_path);

        if (fs.existsSync(photoPath)) {
          form.append("employees_photos", fs.createReadStream(photoPath), {
            filename: data.photo_filename,
            contentType: data.photo_mime_type,
          });
        } else {
          console.error("PHOTO FILE MISSING:", {
            companyId,
            employeeId: data.employeeId,
            photoPath,
          });
        }

        break;
      }

      case "employee_document": {
        const documentPath = path.join(
          getEmployeeDocumentsDir(),
          data.localPath
        );

        console.log("STARTING SYNC FOR EMPLOYEE DOCUMENT:", {
          companyId,
          employeeId: data.employeeId,
          documentId: data._id,
          localPath: data.localPath,
          resolvedPath: documentPath,
          exists: fs.existsSync(documentPath),
          fileName: data.fileName,
          mimeType: data.mimeType,
        });

        if (fs.existsSync(documentPath)) {
          form.append(
            "employees_documents",
            fs.createReadStream(documentPath),
            {
              filename: data.fileName,
              contentType: data.mimeType,
            }
          );
        } else {
          console.error("DOCUMENT FILE MISSING:", {
            companyId,
            employeeId: data.employeeId,
            documentId: data._id,
            localPath: data.localPath,
          });
        }

        break;
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * SEND TO BACKEND
   * ---------------------------------------------------------
   */

  console.log("FORM TO SEND TO BACKEND:", {
    companyId,
    itemCount: validPending.length,
    skippedObsolete: obsoleteQueueIds.length,
  });

  const response = await axios.post(`${API_URL}/sync/push`, form, {
    headers: {
      ...form.getHeaders(),
      "x-auth-token": token,
      "x-company-id": companyId,
    },
  });

  console.log("SYNC PUSH RESULT:", {
    companyId,
    status: response.status,
  });

  /*
   * ---------------------------------------------------------
   * GET ITEMS SUCCESSFULLY SYNCED BY SERVER
   * ---------------------------------------------------------
   */

  const syncedIds: string[] = response.data.synced ?? [];

  console.log("SERVER CONFIRMED SYNCED ITEMS:", {
    companyId,
    count: syncedIds.length,
    queueIds: syncedIds,
  });

  /*
   * ---------------------------------------------------------
   * PROCESS SERVER-SYNCED ITEMS
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * We DO NOT immediately mark the sync queue items as synced.
   *
   * For a leave creation:
   *
   *   1. Server confirms the leave was pushed.
   *   2. We queue the email notification.
   *   3. We mark the local leave as synced.
   *   4. We mark the sync queue item as synced.
   *
   * This prevents losing the leave sync item if notification
   * queue insertion fails.
   */

  const successfullyProcessedQueueIds: string[] = [];

  for (const item of validPending) {
    /*
     * The server did not confirm this particular item.
     */
    if (!syncedIds.includes(item._id)) {
      continue;
    }

    const data = JSON.parse(item.payload);

    switch (item.entity) {
      /*
       * -----------------------------------------------------
       * COMPANY
       * -----------------------------------------------------
       */

      case "company":
        await markCompanySynced(companyId, data.serverVersion);
        break;

      /*
       * -----------------------------------------------------
       * EMPLOYEE
       * -----------------------------------------------------
       */

      case "employee":
        await markEmployeeSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * EMPLOYEE PHOTO
       * -----------------------------------------------------
       */

      case "employee_photo":
        await markEmployeePhotoSynced(companyId, data.employeeId);
        break;

      /*
       * -----------------------------------------------------
       * EMPLOYEE DOCUMENT
       * -----------------------------------------------------
       */

      case "employee_document":
        await markEmployeeDocumentSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * ATTENDANCE
       * -----------------------------------------------------
       */

      case "attendance":
        await markAttendanceSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * ATTENDANCE DAILY CHECK
       * -----------------------------------------------------
       */

      case "attendance_daily_check": {
        await markAttendanceDailyCheckSynced(companyId, data._id);

        if (data.status === "LOCKED") {
          await notifyManagerOfAttendanceDailyCheck(data);
          await processNotificationQueue();
        }

        break;
      }

      /*
       * -----------------------------------------------------
       * LEAVE
       * -----------------------------------------------------
       */

      case "leave": {
        if (
          item.operation === "create" &&
          data.status === "ATTENTE_APPROBATION"
        ) {
          if (!data.managerEmail) {
            throw new Error(
              `Cannot queue leave creation email: ` +
                `managerEmail is missing for leave ${data._id}`
            );
          }

          await enqueueNotification({
            companyId,
            type: "leave",
            recipientEmail: data.managerEmail,
            title: `Demande de congé - ${data.employeeFirstName} ${data.employeeLastName}`,
            message: `
            Employé: ${data.employeeFirstName} ${data.employeeLastName}

            Période: Du ${new Date(data.startDate).toLocaleDateString(
              "fr-FR"
            )} au ${new Date(data.endDate).toLocaleDateString("fr-FR")}
         
            Motif: ${data.notes || "Aucune note fournie."}

            Veuillez vous connecter sur Akili pour approuver 
            ou refuser la demande.
            
            `.trim(),
            entityId: data._id,
          });

          await processNotificationQueue();

          console.log("LEAVE CREATION EMAIL QUEUED:", {
            companyId,
            leaveId: data._id,
            managerEmail: data.managerEmail,
          });
        }

        /*
         * Only after the notification has been successfully
         * inserted into notification_queue do we mark the
         * local leave as synced.
         */

        await markLeaveSynced(companyId, data._id);

        break;
      }

      /*
       * -----------------------------------------------------
       * TASK
       * -----------------------------------------------------
       */

      case "task":
        await markTaskSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * TASK COMMENT
       * -----------------------------------------------------
       */

      case "task_comment":
        await markTaskCommentsSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * PAYROLL SETTINGS
       * -----------------------------------------------------
       */

      case "payroll_settings":
        await markPayrollSettingsSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * PAYROLL COMPONENT
       * -----------------------------------------------------
       */

      case "payroll_component":
        await markPayrollComponentSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * PAYROLL PROFILE
       * -----------------------------------------------------
       */

      case "payroll_profile":
        await markPayrollEmployeeProfileSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * PAYROLL RUN
       * -----------------------------------------------------
       */

      /*
       * -----------------------------------------------------
       * PAYROLL RUN
       * -----------------------------------------------------
       */

      case "payroll_run": {
        await markPayrollRunSynced(companyId, data._id);

        /*
         * ---------------------------------------------------
         * MANAGER NOTIFIED
         * ---------------------------------------------------
         *
         * Ask the manager to confirm the payroll.
         */

        if (data.status === "VERIFICATION") {
          if (!data.managerEmail) {
            throw new Error(
              `Cannot queue payroll confirmation notification: ` +
                `managerEmail is missing for payroll run ${data._id}`
            );
          }

          await enqueueNotification({
            companyId,
            type: "payroll",
            recipientEmail: data.managerEmail,
            title: `Verification de fiches de paie - ${getMonthName(
              data.month
            )} ${data.year}`,
            message:
              `Les fiches de paie pour le mois de ${getMonthName(data.month)} ${
                data.year
              } ` +
              "sont prêtes pour votre vérification sur Akili.\n" +
              "Veuillez vérifier les informations et confirmer.\n\n" +
              "L'équipe Akili",
            entityId: data._id,
          });
          await processNotificationQueue();

          console.log("PAYROLL MANAGER CONFIRMATION NOTIFICATION QUEUED:", {
            companyId,
            payrollRunId: data._id,
            managerEmail: data.managerEmail,
          });
        }

        /*
         * ---------------------------------------------------
         * PAYE
         * ---------------------------------------------------
         *
         * Inform the manager that payroll has been paid.
         */

        if (data.status === "PAYÉ") {
          if (!data.managerEmail) {
            throw new Error(
              `Cannot queue payroll paid notification: ` +
                `managerEmail is missing for payroll run ${data._id}`
            );
          }

          await enqueueNotification({
            companyId,
            type: "payroll",
            recipientEmail: data.managerEmail,
            title: `Paiements effectués - ${getMonthName(data.month)} ${
              data.year
            }`,
            message:
              `Paiements effectués avec succès pour la période de ${getMonthName(
                data.month
              )} ${data.year}. \n\n` + `L'équipe Akili`,
            entityId: data._id,
          });

          await processNotificationQueue();

          console.log("PAYROLL PAID NOTIFICATION QUEUED:", {
            companyId,
            payrollRunId: data._id,
            managerEmail: data.managerEmail,
          });
        }

        break;
      }

      /*
       * -----------------------------------------------------
       * PAYROLL RESULT
       * -----------------------------------------------------
       */

      case "payroll_result":
        await markPayrollResultSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * PAYROLL ITEM
       * -----------------------------------------------------
       */

      case "payroll_item":
        await markPayrollItemSynced(companyId, data._id);
        break;

      /*
       * -----------------------------------------------------
       * UNKNOWN ENTITY
       * -----------------------------------------------------
       */

      default:
        console.warn(`UNKNOWN SYNC ENTITY: ${item.entity}`);
        break;
    }

    successfullyProcessedQueueIds.push(item._id);
  }

  /*
   * ---------------------------------------------------------
   * MARK SYNC QUEUE ITEMS AS SYNCED
   * ---------------------------------------------------------
   *
   * This is deliberately AFTER the entity processing above.
   *
   * Therefore a leave creation notification is guaranteed to
   * have been inserted into notification_queue before the
   * corresponding sync queue item is marked as synced.
   */

  if (successfullyProcessedQueueIds.length > 0) {
    await markManySynced(companyId, successfullyProcessedQueueIds);

    console.log("MARKED SYNC QUEUE ITEMS AS SYNCED:", {
      companyId,
      count: successfullyProcessedQueueIds.length,
      queueIds: successfullyProcessedQueueIds,
    });
  }

  /*
   * ---------------------------------------------------------
   * CHECK WHAT IS STILL PENDING
   * ---------------------------------------------------------
   */

  const remainingPending = await getUnsyncedItems(companyId);

  const pendingChanges = remainingPending.length;

  const totalSynced =
    successfullyProcessedQueueIds.length + obsoleteQueueIds.length;

  console.log("PUSH COMPLETE:", {
    companyId,
    synced: totalSynced,
    pushedSuccessfully: syncedIds.length,
    processedSuccessfully: successfullyProcessedQueueIds.length,
    skippedObsolete: obsoleteQueueIds.length,
    stillPending: pendingChanges,
  });

  return {
    pendingChanges,
    syncedCount: totalSynced,
  };
}
