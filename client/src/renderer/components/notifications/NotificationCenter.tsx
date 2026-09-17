import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  CloseButton,
  VStack,
} from "@chakra-ui/react";
import { useNotificationStore } from "../../../store/notification.store";

const NotificationCenter = () => {
  const notifications = useNotificationStore((store) => store.notifications);

  const removeNotification = useNotificationStore(
    (state) => state.removeNotification
  );

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top="1.25rem"
      right="1.25rem"
      width="min(420px, calc(100vw - 2.5rem))"
      zIndex={9999}
    >
      <VStack spacing={3} align="stretch">
        {notifications.map((notification) => {
          let status: "info" | "success" | "warning" | "error" = "info";

          switch (notification.type) {
            case "SUCCESS":
              status = "success";
              break;

            case "WARNING":
              status = "warning";
              break;

            case "ERROR":
              status = "error";
              break;

            case "REMINDER":
              status = "info";
              break;

            default:
              status = "info";
          }

          return (
            <Alert
              key={notification._id}
              status={status}
              alignItems="flex-start"
              borderRadius="10px"
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              boxShadow="0 8px 30px rgba(0, 0, 0, 0.12)"
              py={4}
              px={4}
            >
              <AlertIcon mt="2px" />

              <Box flex="1" pr={2}>
                <AlertTitle
                  fontSize="0.95rem"
                  fontWeight="700"
                  color="red.600"
                  mb={1}
                >
                  {notification.title}
                </AlertTitle>

                <AlertDescription
                  fontSize="0.98rem"
                  fontWeight="400"
                  color="gray.700"
                  lineHeight="1.5"
                >
                  {notification.message}
                </AlertDescription>
              </Box>

              <CloseButton
                size="sm"
                onClick={() => removeNotification(notification._id)}
                aria-label="Fermer la notification"
              />
            </Alert>
          );
        })}
      </VStack>
    </Box>
  );
};

export default NotificationCenter;
