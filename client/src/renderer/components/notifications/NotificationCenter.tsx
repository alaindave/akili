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
      bottom="1.25rem"
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
              borderRadius="12px"
              bg="#03143B"
              border="1px solid"
              borderColor="whiteAlpha.200"
              boxShadow="0 8px 30px rgba(3, 20, 59, 0.28)"
              py={4}
              px={4}
            >
              <AlertIcon
                mt="2px"
                color={{ info: "#93C5FD", success: "#86EFAC", warning: "#FCD34D", error: "#FCA5A5" }[status]}
              />

              <Box flex="1" minW={0} pr={2} overflowWrap="anywhere">
                <AlertTitle
                  fontSize="0.95rem"
                  fontWeight="700"
                  color="#FFFFFF"
                  mb={1}
                >
                  {notification.title}
                </AlertTitle>

                <AlertDescription
                  fontSize="0.98rem"
                  fontWeight="400"
                  color="#CBD5E1"
                  lineHeight="1.5"
                >
                  {notification.message}
                </AlertDescription>
              </Box>

              <CloseButton
                size="sm"
                flexShrink={0}
                color="#CBD5E1"
                _hover={{ bg: "whiteAlpha.200", color: "#FFFFFF" }}
                _focusVisible={{ outline: "2px solid #93C5FD", outlineOffset: "2px" }}
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
