import { ipcMain } from "electron";

import {
  createTaskComment,
  deleteTaskComment,
  getTaskCommentsWithAuthor,
} from "../../database/repositories/shared/tasks_comments.repository.js";

export function registerTaskCommentIPC() {
  // Create task comment
  ipcMain.handle(
    "task-comments:create",
    async (_, companyId: string, payload) => {
      return await createTaskComment(companyId, payload);
    }
  );

  // Get task comments
  ipcMain.handle(
    "task-comments:get",
    async (_, companyId: string, taskId: string) => {
      return await getTaskCommentsWithAuthor(companyId, taskId);
    }
  );

  // Delete task comment
  ipcMain.handle(
    "task-comments:delete",
    async (_, companyId: string, commentId: string) => {
      return await deleteTaskComment(companyId, commentId);
    }
  );
}
