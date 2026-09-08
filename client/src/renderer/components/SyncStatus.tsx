import {
  Badge,
  Box,
  Button,
  HStack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { FaSyncAlt } from "react-icons/fa";
import { PiClockClockwiseBold } from "react-icons/pi";
import useSyncStore from "../../store/sync.store";

interface SyncStatusProps {
  onSync?: () => Promise<{
    success: boolean;
    message: string;
  }>;
}

const SyncStatus = ({ onSync }: SyncStatusProps) => {
  const toast = useToast();

  const { isOpen, onOpen, onClose } = useDisclosure();

  const status = useSyncStore((store) => store.status);
  const pendingChanges = useSyncStore((store) => store.pendingChanges);
  const lastSyncAt = useSyncStore((store) => store.lastSyncAt);

  const isSyncing = status === "SYNCING";

  const formatLastSync = () => {
    if (!lastSyncAt) {
      return "-";
    }

    const date = new Date(lastSyncAt);

    if (Number.isNaN(date.getTime())) {
      return "Inconnue";
    }

    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatus = () => {
    switch (status) {
      case "IDLE":
        return {
          text: `Synchronisé • ${formatLastSync()}`,
          color: "green.500",
        };

      case "SYNCING":
        return {
          text: "Synchronisation en cours...",
          color: "blue.500",
        };

      case "OFFLINE":
        return {
          text: "Hors ligne",
          color: "orange.500",
        };

      case "ERROR":
        return {
          text: "Échec de synchronisation",
          color: "red.500",
        };

      default:
        return {
          text: `Synchronisé • ${formatLastSync()}`,
          color: "green.500",
        };
    }
  };

  const currentStatus = getStatus();

  const handleSync = async () => {
    if (!onSync || isSyncing) return;

    try {
      await onSync();

      if (status !== "IDLE") {
        switch (status) {
          case "OFFLINE":
            toast({
              title: "Serveur indisponible",
              description:
                "Le serveur est actuellement indisponible. Vos modifications restent enregistrées localement.",
              status: "warning",
              duration: 4000,
              isClosable: true,
            });
            break;

          case "ERROR":
            toast({
              title: "Échec de synchronisation",
              description:
                "Une erreur est survenue pendant la synchronisation.",
              status: "error",
              duration: 4000,
              isClosable: true,
            });
            break;

          default:
            toast({
              title: "Synchronisation non terminée",
              description: "La synchronisation n'a pas pu être terminée.",
              status: "warning",
              duration: 4000,
              isClosable: true,
            });
        }

        return;
      }

      toast({
        title: "Synchronisation terminée",
        description: "Vos données sont à jour.",
        status: "success",
        duration: 2500,
        isClosable: true,
      });
    } catch (error) {
      console.error("SYNC FAILED:", error);

      toast({
        title: "Échec de synchronisation",
        description: "Impossible de synchroniser les données avec le serveur.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  // console.log("SYNC STORE", store);
  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      placement="top"
      closeOnBlur
    >
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="sm"
          px={2}
          borderRadius="md"
          _hover={{
            bg: "blackAlpha.100",
          }}
          color="gray.700"
        >
          <Box
            width="0.7rem"
            height="0.7rem"
            borderRadius="full"
            bg={currentStatus.color}
            mr={2}
          />

          <Text fontSize="1rem" fontWeight="500">
            {currentStatus.text}
          </Text>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        width="300px"
        height="120px"
        borderRadius="xl"
        bg="white"
        borderColor="gray.200"
        boxShadow="0 8px 40px rgba(0,0,0,0.18)"
        _focus={{
          outline: "none",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <PopoverArrow />

        <PopoverBody py={5} px={5}>
          <VStack align="stretch" spacing={4}>
            {/* PENDING CHANGES */}
            <HStack justify="space-between">
              <HStack spacing={2}>
                <Button
                  bg="transparent"
                  isLoading={isSyncing}
                  color="gray.700"
                  _hover={{ bg: "transparent" }}
                  fontSize="1rem"
                  position="relative"
                  top="0.3rem"
                  right="1rem"
                  onClick={handleSync}
                >
                  <FaSyncAlt />
                </Button>
                <Text
                  position="relative"
                  top="0.3rem"
                  right="1.5rem"
                  fontSize="0.9rem"
                  color="gray.700"
                >
                  Modifications en attente
                </Text>
              </HStack>

              <Badge
                colorScheme={pendingChanges > 0 ? "orange" : "green"}
                borderRadius="full"
                px={2}
                position="relative"
                top="0.3rem"
              >
                {pendingChanges}
              </Badge>
            </HStack>

            {/* LAST SYNC */}
            <HStack justify="space-between">
              <Box position="relative" fontSize="1.2rem">
                <PiClockClockwiseBold />
              </Box>
              <Text
                position="relative"
                right="0.5rem"
                fontSize="0.9rem"
                color="gray.700"
              >
                Dernière synchronisation
              </Text>
              <Text fontSize="0.85rem" fontWeight="600" color="gray.600">
                {formatLastSync()}
              </Text>
            </HStack>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default SyncStatus;
