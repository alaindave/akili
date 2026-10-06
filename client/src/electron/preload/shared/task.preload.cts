import { ipcRenderer } from "electron";
import { invoke } from "../../ipc/ipc.cjs";
type Task = import("../../../common/types/task/Task", {
  with: { "resolution-mode": "require" },
}).default;

type AppModule = Task["module"];

export const taskApi = {
  tasks: {
    create: (companyId: string, task: Omit<Task, "_id">) =>
      invoke("tasks:create", companyId, task),

    update: (companyId: string, task: Task) =>
      invoke("tasks:update", companyId, task),

    getAll: (companyId: string, module: AppModule) => invoke("tasks:getAll", companyId, module),

    getById: (companyId: string, _id: string, module: AppModule) =>
      invoke("tasks:getById", companyId, _id, module),

    getUserTasks: (companyId: string, userId: string, module: AppModule) =>
      invoke("tasks:getUserTasks", companyId, userId, module),

    getTopTasks: (companyId: string, userId: string, module: AppModule) =>
      invoke("tasks:getTopTasks", companyId, userId, module),

    delete: (companyId: string, taskId: string, module: AppModule) =>
      invoke("tasks:delete", companyId, taskId, module),

    onNew: (callback: (data: any) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => {
        callback(data);
      };

      ipcRenderer.on("task:new", handler);

      return () => {
        ipcRenderer.removeListener("task:new", handler);
      };
    },
  },

  taskComments: {
    create: (
      companyId: string,
      payload: {
        taskId: string;
        author: string;
        comment: string;
      }
    ) => invoke("task-comments:create", companyId, payload),

    getByTaskId: (companyId: string, taskId: string) =>
      invoke("task-comments:get", companyId, taskId),

    delete: (companyId: string, commentId: string) =>
      invoke("task-comments:delete", companyId, commentId),
  },
};
