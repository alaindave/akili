import { employeeDocumentUploadBytes } from "../employeeDocumentStorage.service.js";
import { employeePhotoUploadBytes } from "../employeePhoto.service.js";
import { getCompanyFilesRoot } from "../../../storage/companyStorage.js";
import axios from "axios";
import {
  recoverStockOperations,
  acknowledgeStockOperation,
} from "../../../database/repositories/modules/inventory/inventoryPostingSync.repository.js";
import { isInventorySyncEntity } from "../../../../common/types/inventory/InventorySync.js";
import {
  acknowledgeInventorySnapshot,
  recoverInventoryAcknowledgement,
} from "../../../database/repositories/modules/inventory/inventorySync.repository.js";
import { app } from "electron";
import FormData from "form-data";
import fs from "fs";
import path from "path";

import { getToken } from "../../../auth.js";

import {
  getUnsyncedItems,
  markManySynced,
} from "../../../database/repositories/shared/sync.repository.js";

import { markCompanySynced } from "../../../database/repositories/shared/companies.repository.js";
import {
  acknowledgeEmployee,
  recoverEmployeeRevision,
} from "../../../database/repositories/modules/hr/employees.repository.js";
import {
  acknowledgeLeave,
  recoverLeaveRevision,
} from "../../../database/repositories/modules/hr/leaves.repository.js";
import { markTaskSynced } from "../../../database/repositories/shared/tasks.repository.js";
import { markIncidentSynced } from "../../../database/repositories/shared/incidents.repository.js";
import { markTaskCommentsSynced } from "../../../database/repositories/shared/tasks_comments.repository.js";
import { markEmployeePhotoSynced } from "../../../database/repositories/modules/hr/employeesPhotos.repository.js";
import { markEmployeeDocumentSynced } from "../../../database/repositories/modules/hr/employeesDocuments.repository.js";

import { markPayrollComponentSynced } from "../../../database/repositories/modules/hr/payrollComponents.repository.js";
import {
  acknowledgePayrollProfile,
  recoverPayrollProfileRevision,
} from "../../../database/repositories/modules/hr/payrollProfile.repository.js";

import {
  markPayrollItemSynced,
  markPayrollResultSynced,
  markPayrollRunSynced,
} from "../../../database/repositories/modules/hr/payrollRun.repository.js";

import { markPayrollSettingsSynced } from "../../../database/repositories/modules/hr/payrollSettings.repository.js";

// IMPORTANT:
// Use the employee document repository to check whether the
// document still exists locally.
import { getEmployeeDocument } from "../../../database/repositories/modules/hr/employeesDocuments.repository.js";

import { enqueueNotification } from "../../../database/repositories/shared/notificationQueue.repository.js";
import { processNotificationQueue } from "../email/notificationQueue.service.js";
import { notifyManagerOfAttendanceDailyCheck } from "../../modules/hr/attendance/attendanceNotification.service.js";
import { getMonthName } from "../../../util/monthFormatter.util.js";
import { markAttendanceSynced } from "../../../database/repositories/modules/hr/attendances.repository.js";
import { markAttendanceDailyCheckSynced } from "../../../database/repositories/modules/hr/attendanceDailyCheck.repository.js";
import { pushTimeOffQueue } from "./timeOffSync.service.js";

// Notification queue

const API_URL = app.isPackaged
  ? process.env.PRODUCTION_API_URL
  : process.env.VITE_API_URL;

interface PushPendingChangesResult {
  pendingChanges: number;
  syncedCount: number;
  failures?: string[];
}

export async function pushPendingChanges(
  companyId: string,
  attendanceIds?: ReadonlySet<string>
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

  const token = await getToken(companyId);

  if (!token) {
    throw new Error("PUSH SYNC: authentication token is missing");
  }

  /*
   * ---------------------------------------------------------
   * GET PENDING ITEMS FOR THIS COMPANY ONLY
   * ---------------------------------------------------------
   */

  let pending = await getUnsyncedItems(companyId);
  let timeOffFailures: string[] = [];
  let timeOffSyncedCount = 0;
  if (attendanceIds) {
    pending = pending.filter(item => item.entity === "attendance" && attendanceIds.has(item.entityId));
  }
  if (!attendanceIds && pending.some(item => ["time_off_motif", "time_off", "leave"].includes(item.entity))) {
    const result = await pushTimeOffQueue(companyId, API_URL ?? "", token, pending);
    timeOffFailures = result.failures;
    timeOffSyncedCount = result.synced.length;
    const handledEntities = new Set(["time_off_motif", "time_off", "leave"]);
    pending = (await getUnsyncedItems(companyId)).filter(item => !handledEntities.has(item.entity));
  }
  if (
    pending.some((item) =>
      [
        "inventory_transaction",
        "inventory_document",
        "inventory_document_line",
        "inventory_movement",
        "inventory_balance",
      ].includes(item.entity)
    )
  ) {
    await recoverStockOperations(companyId);
    pending = await getUnsyncedItems(companyId);
  }

  if (!pending.length) {
    const remaining = await getUnsyncedItems(companyId);
    console.log("NO PENDING CHANGES TO PUSH.", {
      companyId,
    });

    return {
      pendingChanges: remaining.length,
      syncedCount: timeOffSyncedCount,
      failures: timeOffFailures,
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

  // Old verification entries have entityId but no payload._id. Repair only that
  // unambiguous omission; a disagreement between two supplied IDs is a conflict.
  for (const item of pending) {
    const data = JSON.parse(item.payload);
    if (item.companyId !== companyId || data.companyId !== companyId) {
      throw new Error("Sync company does not match the queued record.");
    }
    if (item.entity.startsWith("payroll_")) {
      if (data._id && data._id !== item.entityId)
        throw new Error("Queued payroll ID does not match its payload ID.");
      if (!data._id) data._id = item.entityId;
      item.payload = JSON.stringify(data);
    }
  }

  /*
   * ---------------------------------------------------------
   * REMOVE OBSOLETE EMPLOYEE DOCUMENT UPDATES
   * ---------------------------------------------------------
   */

  const obsoleteQueueIds: string[] = [];

  const validPending = [];
  let legacyStockSnapshots = 0;
  const inventoryRecords = new Set<string>();
  const payrollProfiles = new Set<string>();
  const employeeRecords = new Set<string>();
  const leaveRecords = new Set<string>();
  const latestPhotos = new Map<string, string>();
  const supersededPhotos = new Map<string, string[]>();
  for (const item of pending) {
    if (item.entity === "employee_photo")
      latestPhotos.set(item.entityId, item._id);
  }

  for (const item of pending) {
    const snapshot = JSON.parse(item.payload);
    if (item.entity === "employee") {
      if (employeeRecords.has(item.entityId)) continue;
      employeeRecords.add(item.entityId);
    }
    if (item.entity === "leave") {
      if (leaveRecords.has(item.entityId)) continue;
      leaveRecords.add(item.entityId);
    }
    // Later edits need the server revision acknowledged by this snapshot.
    if (item.entity === "payroll_profile") {
      if (payrollProfiles.has(item.entityId)) continue;
      payrollProfiles.add(item.entityId);
    }
    if (
      [
        "inventory_balance",
        "inventory_movement",
        "inventory_document_line",
      ].includes(item.entity) ||
      (item.entity === "inventory_document" && snapshot.status === "POSTED")
    ) {
      // Complete operations have been recovered above. Keep incomplete legacy
      // snapshots locally for reconciliation; the server cannot accept them.
      legacyStockSnapshots++;
      continue;
    }
    if (isInventorySyncEntity(item.entity)) {
      const recordKey = `${item.entity}:${item.entityId}`;
      if (inventoryRecords.has(recordKey)) continue;
      inventoryRecords.add(recordKey);
    }
    if (
      item.entity === "employee_photo" &&
      latestPhotos.get(item.entityId) !== item._id
    ) {
      const latestId = latestPhotos.get(item.entityId)!;
      supersededPhotos.set(latestId, [
        ...(supersededPhotos.get(latestId) ?? []),
        item._id,
      ]);
      continue;
    }
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
    if (legacyStockSnapshots > 0) {
      throw new Error(
        `${legacyStockSnapshots} enregistrement(s) de stock incomplet(s) nécessitent une réconciliation. Les données locales sont conservées.`
      );
    }
    const remainingPending = await getUnsyncedItems(companyId);

    console.log("PUSH COMPLETE - ONLY OBSOLETE ITEMS WERE FOUND:", {
      companyId,
      skipped: obsoleteQueueIds.length,
      stillPending: remainingPending.length,
    });

    return {
      pendingChanges: remainingPending.length,
      syncedCount: obsoleteQueueIds.length,
      failures: timeOffFailures,
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
    if (item.entity === "employee_document" && item.operation !== "delete") {
      // Different employees can now both have NATIONAL_ID.pdf. The server
      // already supports attachmentKey to identify each multipart snapshot.
      data.attachmentKey = `document-${item._id}${path.extname(data.fileName)}`;
    }

    return {
      queueId: item._id,
      companyId: item.companyId,
      entity: item.entity,
      // Older clients queued first-time document uploads as updates. Repair
      // those snapshots on send without dropping the durable queue entry.
      operation:
        item.entity === "employee_document" &&
        item.operation === "update" &&
        (data.serverVersion ?? 0) === 0
          ? "create"
          : item.operation,
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
      /*
       * -----------------------------------------------------
       * COMPANY LOGO
       * -----------------------------------------------------
       */

      case "company_logo": {
        if (!data.logoPath) {
          console.error("COMPANY LOGO PATH MISSING:", {
            queueId: item._id,
            companyId,
          });

          break;
        }

        const logoPath = path.join(getCompanyFilesRoot(), data.logoPath);

        console.log("STARTING SYNC FOR COMPANY LOGO:", {
          queueId: item._id,
          companyId,
          logoPath: data.logoPath,
          resolvedPath: logoPath,
          exists: fs.existsSync(logoPath),
          mimeType: data.mimeType,
        });

        if (fs.existsSync(logoPath)) {
          form.append("company_logo", fs.createReadStream(logoPath), {
            filename: path.basename(logoPath),
            contentType: data.mimeType || "application/octet-stream",
          });
        } else {
          console.error("COMPANY LOGO FILE MISSING:", {
            queueId: item._id,
            companyId,
            logoPath: data.logoPath,
            resolvedPath: logoPath,
          });
        }

        break;
      }

      /*
       * -----------------------------------------------------
       * EMPLOYEE PHOTO
       * -----------------------------------------------------
       */

      case "employee_photo": {
        const bytes = await employeePhotoUploadBytes(
          companyId,
          data.photo_path,
          data.photo_hash
        );
        form.append("employees_photos", bytes, {
          filename: data.photo_filename,
          contentType: data.photo_mime_type,
        });

        break;
      }

      /*
       * -----------------------------------------------------
       * EMPLOYEE DOCUMENT
       * -----------------------------------------------------
       */

      case "employee_document": {
        if (item.operation !== "delete") {
          const bytes = await employeeDocumentUploadBytes(
            companyId,
            data.localPath,
            data.hash
          );
          form.append("employees_documents", bytes, {
            filename: `document-${item._id}${path.extname(data.fileName)}`,
            contentType: data.mimeType,
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
    timeout: 90000,
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
  for (const item of validPending) {
    if (item.entity !== "employee") continue;
    const failure = (response.data.failed ?? []).find(
      (entry: { queueId: string; code: string }) =>
        String(entry.queueId) === String(item._id) &&
        entry.code === "REVISION_CONFLICT"
    );
    if (failure?.details?.remote) {
      await recoverEmployeeRevision(
        companyId,
        JSON.parse(item.payload),
        failure.details.remote
      );
    }
  }

  for (const item of validPending) {
    if (item.entity !== "leave") continue;
    const failure = (response.data.failed ?? []).find(
      (entry: { queueId: string; code: string }) =>
        entry.queueId === item._id && entry.code === "REVISION_CONFLICT"
    );
    if (failure?.details?.remote) {
      await recoverLeaveRevision(
        companyId,
        JSON.parse(item.payload),
        failure.details.remote
      );
    }
  }
  for (const item of validPending) {
    if (item.entity !== "payroll_profile") continue;
    const failure = (response.data.failed ?? []).find(
      (entry: { queueId: string; code: string }) =>
        entry.queueId === item._id && entry.code === "REVISION_CONFLICT"
    );
    if (failure?.details?.remote) {
      await recoverPayrollProfileRevision(
        companyId,
        JSON.parse(item.payload),
        failure.details.remote
      );
    }
  }
  for (const failure of response.data.failed ?? []) {
    if (failure.entity === "payroll_profile") {
      console.error("PAYROLL PROFILE PUSH REJECTED:", {
        queueId: failure.queueId,
        entityId: failure.entityId,
        code: failure.code,
        message: failure.message,
      });
    }
  }
  for (const item of validPending) {
    if (!isInventorySyncEntity(item.entity)) continue;
    const failure = (response.data.failed ?? []).find(
      (entry: { queueId: string; code: string }) =>
        entry.queueId === item._id && entry.code === "REVISION_CONFLICT"
    );
    if (failure?.details?.remote) {
      await recoverInventoryAcknowledgement(
        companyId,
        item.entity,
        JSON.parse(item.payload),
        failure.details.remote
      );
    }
  }
  // Retire older photo snapshots only when the replacement was accepted.
  const supersededIds = syncedIds.flatMap(
    (id) => supersededPhotos.get(id) ?? []
  );
  syncedIds.push(...supersededIds);
  console.log("SERVER CONFIRMED SYNCED ITEMS:", {
    companyId,
    count: syncedIds.length,
    queueIds: syncedIds,
  });

  const successfullyProcessedQueueIds: string[] = [...supersededIds];
  const stillPending = (await getUnsyncedItems(companyId)).filter(
    (item) => !syncedIds.includes(item._id)
  );

  for (const item of validPending) {
    if (!syncedIds.includes(item._id)) {
      continue;
    }

    const data = JSON.parse(item.payload);

    // An acknowledgement applies to the sent queue entry, not edits made
    // while the network request was in flight.
    if (item.entity === "employee") {
      await acknowledgeEmployee(
        companyId,
        data,
        item._id,
        response.data.versions?.[item._id]
      );
      successfullyProcessedQueueIds.push(item._id);
      continue;
    }
    if (item.entity === "payroll_profile") {
      await acknowledgePayrollProfile(
        companyId,
        data,
        item._id,
        response.data.versions?.[item._id]
      );
      successfullyProcessedQueueIds.push(item._id);
      continue;
    }
    if (item.entity === "inventory_transaction") {
      await acknowledgeStockOperation(companyId, data, item._id);
      successfullyProcessedQueueIds.push(item._id);
      continue;
    }
    if (isInventorySyncEntity(item.entity)) {
      await acknowledgeInventorySnapshot(
        companyId,
        item.entity,
        data,
        item._id,
        response.data.versions?.[item._id]
      );
      successfullyProcessedQueueIds.push(item._id);
      continue;
    }

    if (
      item.entity !== "leave" &&
      stillPending.some(
        (entry) =>
          entry.entity === item.entity && entry.entityId === item.entityId
      )
    ) {
      successfullyProcessedQueueIds.push(item._id);
      continue;
    }

    switch (item.entity) {
      case "company":
        await markCompanySynced(companyId);
        break;

      case "company_logo":
        await markCompanySynced(companyId);
        break;

      case "employee_photo":
        await markEmployeePhotoSynced(
          companyId,
          data.employeeId,
          data.photo_hash
        );
        break;

      case "employee_document":
        await markEmployeeDocumentSynced(
          companyId,
          data._id,
          data.hash,
          data.updatedAt
        );
        break;

      case "attendance":
        await markAttendanceSynced(companyId, data._id);
        break;

      case "attendance_daily_check": {
        await markAttendanceDailyCheckSynced(companyId, data._id);

        if (data.status === "LOCKED" || data.status === "MANAGER_NOTIFIED") {
          console.log("DC STATUS", data.status);
          await notifyManagerOfAttendanceDailyCheck(data);
          await processNotificationQueue();
        }

        break;
      }

      case "leave": {
        if (
          item.operation === "create" &&
          data.status === "ATTENTE_APPROBATION" &&
          !stillPending.some(
            (entry) =>
              entry.entity === "leave" && entry.entityId === item.entityId
          )
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
            title:
              `Demande de congé - ${data.employeeFirstName} ` +
              `${data.employeeLastName}`,
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

        await acknowledgeLeave(
          companyId,
          data,
          item._id,
          response.data.versions?.[item._id]
        );

        break;
      }

      case "incident":
        await markIncidentSynced(companyId, data._id, data.updatedAt);
        break;

      case "task":
        await markTaskSynced(companyId, data._id, data.module ?? "HR");
        break;

      case "task_comment":
        await markTaskCommentsSynced(companyId, data._id);
        break;

      case "payroll_settings":
        await markPayrollSettingsSynced(companyId, data._id);
        break;

      case "payroll_component":
        await markPayrollComponentSynced(companyId, data._id);
        break;

      case "payroll_run": {
        if (data.status === "VERIFICATION" && data.managerEmail) {
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

        if (data.status === "PAYÉ" && data.managerEmail) {
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

      case "payroll_result":
        break;

      case "payroll_item":
        break;

      default:
        console.warn(`UNKNOWN SYNC ENTITY: ${item.entity}`);
        break;
    }

    successfullyProcessedQueueIds.push(item._id);
  }

  if (successfullyProcessedQueueIds.length > 0) {
    await markManySynced(companyId, successfullyProcessedQueueIds);
    for (const item of validPending.filter((entry) =>
      successfullyProcessedQueueIds.includes(entry._id)
    )) {
      const data = JSON.parse(item.payload);
      if (item.entity === "payroll_run")
        await markPayrollRunSynced(companyId, data._id, data.updatedAt);
      if (item.entity === "payroll_result")
        await markPayrollResultSynced(companyId, data._id, data.updatedAt);
      if (item.entity === "payroll_item")
        await markPayrollItemSynced(companyId, data._id);
    }

    console.log("MARKED SYNC QUEUE ITEMS AS SYNCED:", {
      companyId,
      count: successfullyProcessedQueueIds.length,
      queueIds: successfullyProcessedQueueIds,
    });
  }

  const remainingPending = await getUnsyncedItems(companyId);

  const pendingChanges = remainingPending.length;
  const failures: string[] = [...timeOffFailures];
  const rejected: unknown = response.data.failed;
  if (Array.isArray(rejected)) {
    for (const failure of rejected) {
      if (typeof failure !== "object" || failure === null) continue;
      const item = remainingPending.find(
        (entry) => String(entry._id) === String(failure.queueId)
      );
      if (!item) continue;
      const message =
        `${item.entity} ${item.entityId}, queue ${item._id}: ` +
        `${typeof failure.code === "string" ? failure.code + ": " : ""}` +
        `${
          typeof failure.message === "string"
            ? failure.message
            : "Server rejected the change"
        }`;
      console.error("SYNC PUSH REJECTED:", message);
      if (failures.length < 10) failures.push(message);
    }
  }

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
    failures,
  };
}
