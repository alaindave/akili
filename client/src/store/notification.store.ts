import { create } from "zustand";
import { AppNotification } from "../common/types/AppNotification";

interface NotificationState {
  notifications: AppNotification[];

  addNotification: (notification: AppNotification) => void;

  removeNotification: (id: string) => void;

  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (notification) =>
    set((state) => {
      /*
       * Prevent duplicate notifications.
       */
      const alreadyExists = state.notifications.some(
        (item) => item._id === notification._id
      );

      if (alreadyExists) {
        return state;
      }

      return {
        notifications: [...state.notifications, notification],
      };
    }),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) => notification._id !== id
      ),
    })),

  clearNotifications: () =>
    set({
      notifications: [],
    }),
}));
