import { create } from "zustand";

import User from "../common/types/User";
import Task from "../common/types/task/Task";
import PopulatedTaskComment from "../common/types/task/PopulatedTaskComment";

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  loadTopTasks: (companyId: string, userId: string) => Promise<void>;
  createTask: (companyId: string, task: Task) => Promise<void>;
  updateTask: (companyId: string, task: Task) => Promise<void>;
  deleteTask: (companyId: string, taskId: string) => void;
  addComment: (
    companyId: string,
    taskId: string,
    author: Omit<User, "password">,
    message: string
  ) => Promise<void>;

  setTasks: (tasks: Task[]) => void;
  clearTasks: () => void;
}

const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  setTasks: (tasks) => set({ tasks }),

  loadTopTasks: async (companyId: string, userId: string) => {
    set({ loading: true });

    try {
      const tasks = await window.electron.tasks.tasks.getTopTasks(
        companyId,
        userId
      );

      console.log("LOADED TOP TASKS IN STORE:", tasks);

      set({
        tasks,
        loading: false,
      });
    } catch (error) {
      console.error(
        "AN ERROR OCCURED WHILE LOADING TOP TASKS IN ZUSTAND.",
        error
      );

      set({ loading: false });
    }
  },

  createTask: async (companyId: string, taskData: Task) => {
    const optimisticTask: Task = {
      ...taskData,
      companyId,
      _id: crypto.randomUUID(),
      comments: [],
    } as Task;

    set((state) => ({
      tasks: [optimisticTask, ...state.tasks],
    }));

    try {
      const savedTask = await window.electron.tasks.tasks.create(companyId, taskData);

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t._id === optimisticTask._id ? savedTask : t
        ),
      }));
    } catch (error) {
      set((state) => ({
        tasks: state.tasks.filter((t) => t._id !== optimisticTask._id),
      }));

      console.error(
        "AN ERROR OCCURED WHILE CREATING THE TASK IN ZUSTAND.",
        error
      );
    }
  },

  updateTask: async (companyId: string, updatedTask: Task) => {
    const previous = get().tasks;

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t._id === updatedTask._id ? updatedTask : t
      ),
    }));

    try {
      await window.electron.tasks.tasks.update(companyId, updatedTask);
    } catch (error) {
      set({ tasks: previous });

      console.error(
        "AN ERROR OCCURED WHILE UPDATING THE TASK IN ZUSTAND.",
        error
      );
    }
  },

  deleteTask: (companyId: string, taskId: string) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task._id !== taskId),
    }));
  },

  clearTasks: () =>
    set({
      tasks: [],
      loading: false,
    }),

  addComment: async (companyId: string, taskId: string, author, comment) => {
    const tempId = crypto.randomUUID();
    const optimisticComment: PopulatedTaskComment = {
      companyId,
      _id: tempId,
      taskId,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      author: {
        _id: author._id,
        firstName: author.firstName ?? "",
        lastName: author.lastName ?? "",
      },
    };

    set((store) => ({
      tasks: store.tasks.map((task) =>
        task._id !== taskId
          ? task
          : {
              ...task,
              comments: [...(task.comments ?? []), optimisticComment],
            }
      ),
    }));

    try {
      await window.electron.tasks.taskComments.create(companyId, {
        taskId,
        author: author._id,
        comment,
      });
      const refreshedTask = await window.electron.tasks.tasks.getById(
        companyId,
        taskId
      );

      if (!refreshedTask) {
        throw new Error(
          `Task ${taskId} could not be reloaded after adding comment`
        );
      }
      set((store) => ({
        tasks: store.tasks.map((task) =>
          task._id === taskId ? refreshedTask : task
        ),
      }));
    } catch (error) {
      set((store) => ({
        tasks: store.tasks.map((task) =>
          task._id !== taskId
            ? task
            : {
                ...task,
                comments: task.comments?.filter((c) => c._id !== tempId),
              }
        ),
      }));
      console.error("AN ERROR OCCURED WHILE SAVING THE COMMENT", error);
      throw error;
    }
  },
}));

export default useTaskStore;
