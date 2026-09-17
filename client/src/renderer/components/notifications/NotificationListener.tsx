import { useEffect } from "react";
import { useNotificationStore } from "../../../store/notification.store";

const NotificationListener = () => {
  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );

  useEffect(() => {
    if (!window.electron?.notifications?.onNew) {
      return;
    }

    const unsubscribe = window.electron.notifications.onNew((notification) => {
      addNotification(notification);
    });

    return unsubscribe;
  }, [addNotification]);

  return null;
};

export default NotificationListener;
