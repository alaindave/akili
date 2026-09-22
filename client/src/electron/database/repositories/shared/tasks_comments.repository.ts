import TaskComment from "../../../../common/types/task/TaskComment.js";
import PopulatedTaskComment from "../../../../common/types/task/PopulatedTaskComment.js";
import { randomUUID } from "crypto";
import { run, all, get } from "../../db.js";
import { addToSyncQueue } from "./sync.repository.js";

/**
 * Create task comment locally.
 */
export async function createTaskComment(
  companyId: string,
  comment: TaskComment
) {
  console.log("Comment to save:", {
    companyId,
    comment,
  });

  const _id = randomUUID();

  const today = new Date();
  const submittedAt = today.toISOString().split("T")[0];
  const time = today.toISOString();

  await run(
    `
    INSERT INTO task_comments (
      companyId,
      _id,
      taskId,
      author,
      comment,
      createdAt,
      updatedAt,
      serverVersion,
      synced,
      isDeleted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      companyId,
      _id,
      comment.taskId,
      comment.author,
      comment.comment,
      time,
      time,
      0,
      0,
      0,
    ]
  );

  const savedTaskComment = {
    ...comment,
    companyId,
    _id,
    submittedAt,
    createdAt: time,
    updatedAt: time,
    serverVersion: 0,
    isDeleted: 0,
  };

  console.log("TASK COMMENT TO SAVE TO SYNC QUEUE", savedTaskComment);

  await addToSyncQueue({
    companyId,
    entity: "task_comment",
    entityId: _id,
    operation: "create",
    payload: JSON.stringify(savedTaskComment),
  });

  return savedTaskComment;
}

/**
 * Get task comments.
 */
export async function getTaskComments(
  companyId: string,
  taskId: string
): Promise<TaskComment[]> {
  return all(
    `
    SELECT 
      tc.companyId,
      tc._id,
      tc.taskId,
      tc.comment,
      tc.createdAt,
      tc.updatedAt,
      tc.serverVersion,
      tc.isDeleted,

      a._id AS author,
      a.firstName,
      a.lastName,
      a.email,
      a.role

    FROM task_comments tc

    JOIN admin_users a
      ON a._id = tc.author
      AND a.companyId = tc.companyId

    WHERE tc.companyId = ?
      AND tc.taskId = ?
      AND tc.isDeleted = 0

    ORDER BY tc.createdAt ASC
    `,
    [companyId, taskId]
  );
}

/**
 * Formatted task comments with author.
 */
export async function getTaskCommentsWithAuthor(
  companyId: string,
  taskId: string
) {
  const rows = await getTaskComments(companyId, taskId);

  return rows.map((r: any) => ({
    companyId: r.companyId,

    _id: r._id,
    taskId: r.taskId,
    comment: r.comment,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,

    author: {
      companyId: r.companyId,
      _id: r.author,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      role: r.role,
    },
  }));
}

/**
 * Update task comment.
 */
export async function updateTaskComment(
  companyId: string,
  _id: string,
  comment: string
) {
  const today = new Date();
  const updatedAt = today.toISOString();

  await run(
    `
    UPDATE task_comments
    SET
      comment = ?,
      updatedAt = ?,
      synced = 0
    WHERE companyId = ?
      AND _id = ?
      AND isDeleted = 0
    `,
    [comment, updatedAt, companyId, _id]
  );

  const payload = {
    companyId,
    _id,
    comment,
    updatedAt,
  };

  console.log("TASK COMMENT TO SAVE TO SYNC QUEUE", payload);

  await addToSyncQueue({
    companyId,
    entity: "task_comment",
    entityId: _id,
    operation: "update",
    payload: JSON.stringify(payload),
  });

  return true;
}

/**
 * Delete task comment.
 *
 * Uses a soft delete so the deletion can be synchronized
 * to the server.
 */
export async function deleteTaskComment(companyId: string, _id: string) {
  const today = new Date();
  const updatedAt = today.toISOString();

  await run(
    `
    UPDATE task_comments
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

  const payload = {
    companyId,
    _id,
    isDeleted: 1,
    updatedAt,
  };

  console.log("TASK COMMENT TO DELETE FROM SYNC QUEUE", payload);

  await addToSyncQueue({
    companyId,
    entity: "task_comment",
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify(payload),
  });

  return true;
}

/**
 * Upsert task comment received from the server.
 */
export async function upsertTaskComment(comment: PopulatedTaskComment) {
  const companyId = comment.companyId;

  if (!companyId) {
    throw new Error("Cannot upsert task comment without companyId");
  }

  const incomingServerVersion = comment.serverVersion ?? 0;

  /*
   * Check existing local record.
   */
  const existing = await get<{
    serverVersion: number;
    synced: number;
  }>(
    `
    SELECT
      serverVersion,
      synced
    FROM task_comments
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, comment._id]
  );

  /*
   * Never overwrite a newer local server version.
   */
  if (existing && existing.serverVersion > incomingServerVersion) {
    console.log(
      `SKIPPING TASK COMMENT ${comment._id}: LOCAL serverVersion ${existing.serverVersion} IS NEWER THAN INCOMING ${incomingServerVersion}`
    );

    return;
  }

  /*
   * If the local record has unsynchronized changes,
   * do not overwrite them with the server copy.
   */
  if (existing && existing.synced === 0) {
    console.log(
      `SKIPPING TASK COMMENT ${comment._id}: LOCAL CHANGES ARE PENDING SYNC`
    );

    return;
  }

  await run(
    `
    INSERT INTO task_comments (
      companyId,
      _id,
      taskId,
      author,
      comment,
      serverVersion,
      createdAt,
      updatedAt,
      isDeleted,
      synced,
      lastSyncedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

    ON CONFLICT(_id)
    DO UPDATE SET
      companyId = excluded.companyId,
      taskId = excluded.taskId,
      author = excluded.author,
      comment = excluded.comment,
      serverVersion = excluded.serverVersion,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      isDeleted = excluded.isDeleted,
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    `,
    [
      companyId,
      comment._id,
      comment.taskId,
      comment.author,
      comment.comment,
      incomingServerVersion,
      comment.createdAt,
      comment.updatedAt,
      comment.isDeleted ?? 0,
      1,
    ]
  );

  console.log("COMMENT UPSERTED:", comment);

  return true;
}

/**
 * Mark task comment as synchronized.
 */
export async function markTaskCommentsSynced(companyId: string, _id: string) {
  await run(
    `
    UPDATE task_comments
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
