import type Task from "../../../../common/types/task/Task.js";
import { all, get, run } from "../../db.js";
import { addToSyncQueue } from "./sync.repository.js";
import { randomUUID } from "crypto";
import { getTaskCommentsWithAuthor } from "./tasks_comments.repository.js";

type Priority = "HAUTE" | "MOYENNE" | "BASSE";

type TaskRow = {
  companyId: string;

  taskId: string;
  taskNumber: string;
  subject: string;
  message: string;
  author: string;
  priority: Priority;
  deadline: string | null;

  isResolved?: number;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;

  authorId: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
  authorRole: string | null;

  recipientId: string | null;
  recipientFirstName: string | null;
  recipientLastName: string | null;
  recipientEmail: string | null;
  recipientRole: "MANAGER" | "ADMIN" | null;

  isDeleted: number;
  submittedAt: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  serverVersion: number;
};

/**
 * Create task locally.
 *
 * serverVersion starts at 0 because the task has not yet been
 * assigned a server revision.
 */
export async function createTask(companyId: string, task: Task) {
  console.log("TASK TO CREATE:", {
    companyId,
    task,
  });

  const _id = randomUUID();
  const taskNumber = generateTaskNumber(task.priority);
  const now = new Date().toISOString();

  const serverVersion = 0;

  /*
   * Create task
   */
  await run(
    `
    INSERT INTO tasks (
      companyId,
      _id,
      taskNumber,
      author,
      subject,
      message,
      deadline,
      priority,
      synced,
      serverVersion,
      submittedAt,
      createdAt,
      updatedAt,
      isDeleted
    )
    VALUES (?,?,?,?,?,?,?, ?,0,?,?,?,?,0)
    `,
    [
      companyId,
      _id,
      taskNumber,
      task.author._id,
      task.subject,
      task.message,
      task.deadline,
      task.priority,
      serverVersion,
      now,
      now,
      now,
    ]
  );

  /*
   * Insert recipients.
   */
  for (const recipient of task.recipients) {
    await run(
      `
      INSERT INTO task_recipients (
        companyId,
        taskId,
        recipient
      )
      VALUES (?, ?, ?)
      `,
      [companyId, _id, recipient._id]
    );
  }

  const savedTask = {
    ...task,
    companyId,
    _id,
    taskNumber,
    recipients: task.recipients.map((r) => r._id),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    serverVersion,
    isDeleted: 0,
  };

  console.log("TASK TO SAVE TO SYNC QUEUE", savedTask);

  await addToSyncQueue({
    companyId,
    entity: "task",
    entityId: _id,
    operation: "create",
    payload: JSON.stringify(savedTask),
  });

  return getTaskById(companyId, _id);
}

/**
 * Update task locally.
 */
export async function updateTask(companyId: string, task: Task) {
  const updatedAt = new Date().toISOString();

  await run("BEGIN TRANSACTION");

  try {
    /*
     * Update task.
     */
    await run(
      `
      UPDATE tasks
      SET
        subject = ?,
        message = ?,
        priority = ?,
        deadline = ?,
        isResolved = ?,
        resolutionNotes = ?,
        resolvedBy = ?,
        resolvedAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND _id = ?
        AND isDeleted = 0
      `,
      [
        task.subject,
        task.message,
        task.priority,
        task.deadline,
        task.isResolved ?? 0,
        task.resolutionNotes ?? null,
        task.resolvedBy ?? null,
        task.resolvedAt ?? null,
        updatedAt,
        companyId,
        task._id,
      ]
    );

    /*
     * Replace recipients.
     */
    await run(
      `
      DELETE FROM task_recipients
      WHERE companyId = ?
        AND taskId = ?
      `,
      [companyId, task._id]
    );

    for (const recipient of task.recipients) {
      await run(
        `
        INSERT INTO task_recipients (
          companyId,
          taskId,
          recipient
        )
        VALUES (?, ?, ?)
        `,
        [companyId, task._id, recipient._id]
      );
    }

    /*
     * Get current serverVersion.
     */
    const existing = await get<{
      serverVersion: number;
    }>(
      `
      SELECT serverVersion
      FROM tasks
      WHERE companyId = ?
        AND _id = ?
      `,
      [companyId, task._id]
    );

    const updatedTask = {
      ...task,
      companyId,
      recipients: task.recipients.map((r) => r._id),
      updatedAt,
      serverVersion: existing?.serverVersion ?? task.serverVersion ?? 0,
    };

    console.log("TASK TO SAVE TO SYNC QUEUE", updatedTask);

    await addToSyncQueue({
      companyId,
      entity: "task",
      entityId: task._id,
      operation: "update",
      payload: JSON.stringify(updatedTask),
    });

    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }

  return getTaskById(companyId, task._id);
}

/**
 * Get task by ID.
 */
export async function getTaskById(companyId: string, _id: string) {
  const row = await get<
    TaskRow & {
      serverVersion: number;
    }
  >(
    `
    SELECT 
      t.companyId,

      t._id AS taskId,
      t.taskNumber,
      t.subject,
      t.message,
      t.author,
      t.priority,
      t.deadline,
      t.isResolved,
      t.resolutionNotes,
      t.resolvedAt,
      t.resolvedBy,
      t.submittedAt,
      t.createdAt,
      t.updatedAt,
      t.isDeleted,
      t.serverVersion,

      -- author
      a._id AS authorId,
      a.firstName AS authorFirstName,
      a.lastName AS authorLastName,
      a.email AS authorEmail,
      a.role AS authorRole

    FROM tasks t

    LEFT JOIN admin_users a
      ON a._id = t.author
      AND a.companyId = t.companyId

    WHERE t.companyId = ?
      AND t._id = ?
    `,
    [companyId, _id]
  );

  if (!row) return null;

  /*
   * Fetch all recipients for this task.
   */
  const recipients = await all<{
    _id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: string | null;
  }>(
    `
    SELECT
      u._id,
      u.firstName,
      u.lastName,
      u.email,
      u.role

    FROM task_recipients tr

    LEFT JOIN admin_users u
      ON u._id = tr.recipient
      AND u.companyId = tr.companyId

    WHERE tr.companyId = ?
      AND tr.taskId = ?
    `,
    [companyId, _id]
  );

  const comments = await getTaskCommentsWithAuthor(companyId, _id);

  return {
    companyId: row.companyId,

    _id: row.taskId,
    taskNumber: row.taskNumber,
    subject: row.subject,
    message: row.message,
    priority: row.priority,
    deadline: row.deadline,

    isResolved: row.isResolved ?? null,
    resolutionNotes: row.resolutionNotes ?? null,
    resolvedAt: row.resolvedAt ?? null,
    resolvedBy: row.resolvedBy ?? null,

    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,

    isDeleted: row.isDeleted,
    serverVersion: row.serverVersion,

    author: {
      companyId: row.companyId,
      _id: row.authorId,
      firstName: row.authorFirstName,
      lastName: row.authorLastName,
      email: row.authorEmail,
      role: row.authorRole,
    },

    recipients: recipients.map((recipient) => ({
      companyId: row.companyId,
      _id: recipient._id,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      email: recipient.email,
      role: recipient.role,
    })),

    comments,
  };
}

/**
 * Get top tasks for dashboard display.
 */
export async function getTopTasks(companyId: string, userId: string) {
  const rows = await all<TaskRow>(
    `
    SELECT
      t.companyId,

      t._id AS taskId,
      t.taskNumber,
      t.subject,
      t.message,
      t.submittedAt,
      t.createdAt,
      t.updatedAt,
      t.isDeleted,
      t.author,
      t.priority,
      t.deadline,
      t.isResolved,
      t.resolutionNotes,
      t.resolvedAt,
      t.resolvedBy,
      t.serverVersion,

      -- author
      a._id AS authorId,
      a.firstName AS authorFirstName,
      a.lastName AS authorLastName,
      a.email AS authorEmail,
      a.role AS authorRole,

      -- recipient
      r._id AS recipientId,
      r.firstName AS recipientFirstName,
      r.lastName AS recipientLastName,
      r.email AS recipientEmail,
      r.role AS recipientRole

    FROM tasks t

    LEFT JOIN admin_users a
      ON a._id = t.author
      AND a.companyId = t.companyId

    LEFT JOIN task_recipients tr
      ON tr.companyId = t.companyId
      AND tr.taskId = t._id

    LEFT JOIN admin_users r
      ON r._id = tr.recipient
      AND r.companyId = tr.companyId

    WHERE t.companyId = ?
      AND t.isDeleted = 0
      AND t.isResolved = 0
      AND (
        t.author = ?
        OR EXISTS (
          SELECT 1
          FROM task_recipients tr2
          WHERE tr2.companyId = t.companyId
            AND tr2.taskId = t._id
            AND tr2.recipient = ?
        )
      )

    ORDER BY
      CASE
        WHEN t.deadline IS NULL THEN 1
        ELSE 0
      END ASC,

      datetime(t.deadline) ASC,

      CASE t.priority
        WHEN 'HAUTE' THEN 3
        WHEN 'MOYENNE' THEN 2
        WHEN 'BASSE' THEN 1
        ELSE 0
      END DESC,

      datetime(t.createdAt) ASC
    `,
    [companyId, userId, userId]
  );

  const map = new Map<string, Task>();

  for (const row of rows) {
    if (!map.has(row.taskId)) {
      map.set(row.taskId, {
        companyId: row.companyId,

        _id: row.taskId,
        taskNumber: row.taskNumber,
        subject: row.subject,
        message: row.message,

        priority: row.priority,
        deadline: row.deadline,

        isResolved: row.isResolved ?? null,
        resolutionNotes: row.resolutionNotes ?? null,
        resolvedAt: row.resolvedAt ?? null,
        resolvedBy: row.resolvedBy ?? null,

        submittedAt: row.submittedAt,
        isDeleted: row.isDeleted,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        serverVersion: row.serverVersion,

        author: {
          companyId: row.companyId,
          _id: row.authorId,
          firstName: row.authorFirstName,
          lastName: row.authorLastName,
          email: row.authorEmail,
          role: row.authorRole,
        },

        recipients: [],
      } as Task);
    }

    const task = map.get(row.taskId)!;

    if (row.recipientId) {
      const exists = task.recipients.find(
        (recipient) => recipient._id === row.recipientId
      );

      if (!exists) {
        task.recipients.push({
          companyId: row.companyId,
          _id: row.recipientId,
          firstName: row.recipientFirstName ?? "",
          lastName: row.recipientLastName ?? "",
          email: row.recipientEmail ?? "",
          role: row.recipientRole!,
        });
      }
    }
  }

  const tasks = Array.from(map.values());

  await Promise.all(
    tasks.map(async (task) => {
      task.comments = await getTaskCommentsWithAuthor(companyId, task._id);
    })
  );

  return tasks;
}

/**
 * Get all tasks for a user.
 */
export async function getAllTasksForUser(companyId: string, userId: string) {
  const rows = await all<TaskRow>(
    `
    SELECT
      t.companyId,

      t._id AS taskId,
      t.taskNumber,
      t.subject,
      t.message,
      t.submittedAt,
      t.createdAt,
      t.updatedAt,
      t.isDeleted,
      t.author,
      t.priority,
      t.deadline,
      t.isResolved,
      t.resolutionNotes,
      t.resolvedAt,
      t.resolvedBy,
      t.serverVersion,

      -- author
      a._id AS authorId,
      a.firstName AS authorFirstName,
      a.lastName AS authorLastName,
      a.email AS authorEmail,
      a.role AS authorRole,

      -- recipient
      r._id AS recipientId,
      r.firstName AS recipientFirstName,
      r.lastName AS recipientLastName,
      r.email AS recipientEmail,
      r.role AS recipientRole

    FROM tasks t

    LEFT JOIN admin_users a
      ON a._id = t.author
      AND a.companyId = t.companyId

    LEFT JOIN task_recipients tr
      ON tr.companyId = t.companyId
      AND tr.taskId = t._id

    LEFT JOIN admin_users r
      ON r._id = tr.recipient
      AND r.companyId = tr.companyId

    WHERE t.companyId = ?
      AND t.isDeleted = 0
      AND (
        t.author = ?
        OR EXISTS (
          SELECT 1
          FROM task_recipients tr2
          WHERE tr2.companyId = t.companyId
            AND tr2.taskId = t._id
            AND tr2.recipient = ?
        )
      )

    ORDER BY
      CASE t.priority
        WHEN 'HAUTE' THEN 3
        WHEN 'MOYENNE' THEN 2
        WHEN 'BASSE' THEN 1
        ELSE 0
      END DESC,

      datetime(t.createdAt) DESC
    `,
    [companyId, userId, userId]
  );

  const map = new Map<string, Task>();

  for (const row of rows) {
    if (!map.has(row.taskId)) {
      map.set(row.taskId, {
        companyId: row.companyId,

        _id: row.taskId,
        taskNumber: row.taskNumber,
        subject: row.subject,
        message: row.message,

        priority: row.priority,
        deadline: row.deadline,

        isResolved: row.isResolved ?? null,
        resolutionNotes: row.resolutionNotes ?? null,
        resolvedAt: row.resolvedAt ?? null,
        resolvedBy: row.resolvedBy ?? null,

        submittedAt: row.submittedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,

        isDeleted: row.isDeleted,
        serverVersion: row.serverVersion,

        author: {
          companyId: row.companyId,
          _id: row.authorId,
          firstName: row.authorFirstName,
          lastName: row.authorLastName,
          email: row.authorEmail,
          role: row.authorRole,
        },

        recipients: [],

        comments: [],
      } as Task);
    }

    const task = map.get(row.taskId)!;

    if (row.recipientId) {
      const exists = task.recipients.some(
        (recipient) => recipient._id === row.recipientId
      );

      if (!exists) {
        task.recipients.push({
          companyId: row.companyId,
          _id: row.recipientId,
          firstName: row.recipientFirstName ?? "",
          lastName: row.recipientLastName ?? "",
          email: row.recipientEmail ?? "",
          role: row.recipientRole!,
        });
      }
    }
  }

  const tasks = Array.from(map.values());

  await Promise.all(
    tasks.map(async (task) => {
      task.comments = await getTaskCommentsWithAuthor(companyId, task._id);
    })
  );

  return tasks;
}

/**
 * Get all tasks.
 */
export async function getAllTasks(companyId: string) {
  const rows = await all<TaskRow>(
    `
    SELECT 
      t.companyId,

      t._id AS taskId,
      t.taskNumber,
      t.subject,
      t.message,
      t.submittedAt,
      t.createdAt,
      t.updatedAt,
      t.isDeleted,
      t.author,
      t.priority,
      t.deadline,
      t.isResolved,
      t.resolutionNotes,
      t.resolvedAt,
      t.resolvedBy,
      t.serverVersion,

      -- author
      a._id AS authorId,
      a.firstName AS authorFirstName,
      a.lastName AS authorLastName,
      a.email AS authorEmail,
      a.role AS authorRole,

      -- recipient
      r._id AS recipientId,
      r.firstName AS recipientFirstName,
      r.lastName AS recipientLastName,
      r.email AS recipientEmail,
      r.role AS recipientRole

    FROM tasks t

    LEFT JOIN admin_users a 
      ON a._id = t.author
      AND a.companyId = t.companyId

    LEFT JOIN task_recipients tr 
      ON tr.companyId = t.companyId
      AND tr.taskId = t._id

    LEFT JOIN admin_users r 
      ON r._id = tr.recipient
      AND r.companyId = tr.companyId

    WHERE t.companyId = ?
      AND t.isDeleted = 0

    ORDER BY t.submittedAt DESC
    `,
    [companyId]
  );

  const map = new Map<string, Task>();

  for (const row of rows) {
    if (!map.has(row.taskId)) {
      map.set(row.taskId, {
        companyId: row.companyId,

        _id: row.taskId,
        taskNumber: row.taskNumber,
        subject: row.subject,
        message: row.message,

        priority: row.priority,
        deadline: row.deadline,

        isResolved: row.isResolved ?? null,
        resolutionNotes: row.resolutionNotes ?? null,
        resolvedAt: row.resolvedAt ?? null,
        resolvedBy: row.resolvedBy ?? null,

        submittedAt: row.submittedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,

        isDeleted: row.isDeleted,
        serverVersion: row.serverVersion,

        author: {
          companyId: row.companyId,
          _id: row.authorId,
          firstName: row.authorFirstName,
          lastName: row.authorLastName,
          email: row.authorEmail,
          role: row.authorRole,
        },

        recipients: [],
      } as Task);
    }

    const task = map.get(row.taskId)!;

    if (row.recipientId) {
      const exists = task.recipients.find(
        (recipient) => recipient._id === row.recipientId
      );

      if (!exists) {
        task.recipients.push({
          companyId: row.companyId,
          _id: row.recipientId,
          firstName: row.recipientFirstName ?? "",
          lastName: row.recipientLastName ?? "",
          email: row.recipientEmail ?? "",
          role: row.recipientRole!,
        });
      }
    }
  }

  const tasks = Array.from(map.values());

  await Promise.all(
    tasks.map(async (task) => {
      task.comments = await getTaskCommentsWithAuthor(companyId, task._id);
    })
  );

  return tasks;
}

/**
 * Soft delete task.
 *
 * serverVersion is intentionally left unchanged.
 * The server will assign the next version when this deletion
 * is synchronized.
 */
export async function deleteTask(companyId: string, _id: string) {
  const updatedAt = new Date().toISOString();

  await run(
    `
    UPDATE tasks
    SET
      isDeleted = 1,
      synced = 0,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
      AND isDeleted = 0
    `,
    [updatedAt, companyId, _id]
  );

  const deletePayload = {
    companyId,
    _id,
    isDeleted: 1,
    updatedAt,
  };

  console.log("TASK TO DELETE FROM SYNC QUEUE", deletePayload);

  await addToSyncQueue({
    companyId,
    entity: "task",
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify(deletePayload),
  });

  return getTaskById(companyId, _id);
}

/**
 * Mark task as synchronized.
 */
export async function markTaskSynced(companyId: string, _id: string) {
  await run(
    `
    UPDATE tasks
    SET
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );

  return true;
}

/**
 * Upsert task received from the server.
 *
 * IMPORTANT:
 * companyId comes from the server task itself.
 */
export async function upsertTask(task: Task) {
  console.log("TASK TO UPSERT:", task);

  const companyId = task.companyId;

  if (!companyId) {
    throw new Error("Cannot upsert task without companyId");
  }

  const incomingServerVersion = task.serverVersion ?? 0;

  /*
   * Check existing local task.
   *
   * The companyId is part of the lookup so a task belonging
   * to another company can never be treated as this company's
   * local task.
   */
  const existing = await get<{
    serverVersion: number;
    synced: number;
    updatedAt: string | null;
  }>(
    `
    SELECT
      serverVersion,
      synced,
      updatedAt
    FROM tasks
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, task._id]
  );

  /**
   * If the local record has a newer serverVersion,
   * the incoming server record is stale.
   *
   * Do not overwrite it.
   */
  if (existing && existing.serverVersion > incomingServerVersion) {
    console.log(
      `SKIPPING TASK ${task._id}: LOCAL serverVersion ${existing.serverVersion} IS NEWER THAN INCOMING ${incomingServerVersion}`
    );

    return getTaskById(companyId, task._id);
  }

  /**
   * Server version is equal or newer.
   *
   * Accept the server record.
   */
  await run(
    `
    INSERT INTO tasks (
      companyId,
      _id,
      taskNumber,
      author,
      subject,
      message,
      priority,
      deadline,
      isResolved,
      resolutionNotes,
      resolvedBy,
      resolvedAt,
      submittedAt,
      createdAt,
      updatedAt,
      lastSyncedAt,
      synced,
      serverVersion,
      isDeleted
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
    ON CONFLICT(_id) DO UPDATE SET
      companyId = excluded.companyId,
      taskNumber = excluded.taskNumber,
      author = excluded.author,
      subject = excluded.subject,
      message = excluded.message,
      priority = excluded.priority,
      deadline = excluded.deadline,
      isResolved = excluded.isResolved,
      resolutionNotes = excluded.resolutionNotes,
      resolvedBy = excluded.resolvedBy,
      resolvedAt = excluded.resolvedAt,
      submittedAt = excluded.submittedAt,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      lastSyncedAt = excluded.lastSyncedAt,
      synced = 1,
      serverVersion = excluded.serverVersion,
      isDeleted = excluded.isDeleted
    `,
    [
      companyId,
      task._id,
      task.taskNumber,
      task.author,
      task.subject,
      task.message,
      task.priority,
      task.deadline,
      task.isResolved ?? 0,
      task.resolutionNotes ?? null,
      task.resolvedBy ?? null,
      task.resolvedAt ?? null,
      task.submittedAt ?? null,
      task.createdAt ?? null,
      task.updatedAt ?? null,
      new Date().toISOString(),
      1,
      incomingServerVersion,
      task.isDeleted ?? 0,
    ]
  );

  /*
   * Replace recipients with server recipients.
   */
  await run(
    `
    DELETE FROM task_recipients
    WHERE companyId = ?
      AND taskId = ?
    `,
    [companyId, task._id]
  );

  for (const recipient of task.recipients) {
    const recipientId =
      typeof recipient === "string" ? recipient : recipient._id;

    if (!recipientId) continue;

    await run(
      `
      INSERT INTO task_recipients (
        companyId,
        taskId,
        recipient
      )
      VALUES (?, ?, ?)
      `,
      [companyId, task._id, recipientId]
    );
  }

  return getTaskById(companyId, task._id);
}

/**
 * Map task priorities to single letters.
 */
function taskMapping(task_priority: string): string {
  if (task_priority === "HAUTE") return "H";
  if (task_priority === "MOYENNE") return "M";
  return "B";
}

/**
 * Generate task numbers.
 */
function generateTaskNumber(task_priority: string) {
  const now = new Date();

  const date =
    String(now.getDate()).padStart(2, "0") +
    String(now.getMonth() + 1).padStart(2, "0") +
    now.getFullYear();

  const time =
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  const priority_letter = taskMapping(task_priority);

  return `TACHE-${date}-${time}-${random}-${priority_letter}`;
}
