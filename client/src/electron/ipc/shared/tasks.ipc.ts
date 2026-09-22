import { ipcMain, app } from "electron";
import {
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
  getTopTasks,
  getTaskById,
  getAllTasksForUser,
} from "../../database/repositories/shared/tasks.repository.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

export function registerTaskIPC() {
  console.log("REGISTERING TASKS IPC");
  console.log("TASKS API URL:", API_URL);

  //Create tasks
  ipcMain.handle("tasks:create", async (_, companyId, task) => {
    console.log("TASK CREATE CALLED: ", task);
    try {
      const result = await createTask(companyId, task);
      console.log("Created task: ", result);
      return result;
    } catch (error) {
      console.error("From Main: Error creating task: ", error);
      throw error;
    }
  });

  //Get all tasks
  ipcMain.handle("tasks:getAll", async (_, companyId) => {
    try {
      const tasks = await getAllTasks(companyId);
      console.log("From main: Tasks fetched: ", tasks);
      return tasks;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  });

  //Get  task by ID
  ipcMain.handle("tasks:getById", async (_, companyId, _id) => {
    try {
      const task = await getTaskById(companyId, _id);
      console.log(" TASK FETCHED: ", task);
      return task;
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE FETCHING TASK BY ID:", error);
      throw error;
    }
  });

  //Get tasks for user(eithr author or recipient )
  ipcMain.handle("tasks:getUserTasks", async (_, companyId, userId) => {
    try {
      const tasks = await getAllTasksForUser(companyId, userId);
      console.log("TASKS FETCHED: ", tasks);
      return tasks;
    } catch (error) {
      console.error("ERROR OCCURED WHILE FETCHING TASKS: ", error);
      throw error;
    }
  });

  //Get top tasks
  ipcMain.handle("tasks:getTopTasks", async (_, companyId, userId) => {
    try {
      const top_tasks = await getTopTasks(companyId, userId);
      console.log("From main: Tasks fetched: ", top_tasks);
      return top_tasks;
    } catch (error) {
      console.error("Error fetching top tasks:", error);
      throw error;
    }
  });

  //Update tasks
  ipcMain.handle("tasks:update", async (_, companyId, task) => {
    console.log("TASK UPDATE CALLED: ", task);
    try {
      const result = await updateTask(companyId, task);
      console.log("Updated task: ", result);
      return result;
    } catch (error) {
      console.error("From Main: Error updating task: ", error);
      throw error;
    }
  });

  //Delete tasks
  ipcMain.handle("tasks:delete", async (_, companyId, taskId) => {
    try {
      const task = await deleteTask(companyId, taskId);
      console.log("From main: Task deleted: ", task);
      return task;
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  });
}
