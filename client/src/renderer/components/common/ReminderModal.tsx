import {
  Box,
  Button,
  Flex,
  Text,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import ReminderDateControl from "./ReminderDateControl";
import ReminderTimeControl from "./ReminderTimeControl";
import { useState } from "react";
import { FaBell } from "react-icons/fa";

interface Props {
  isReminderOpen: boolean;
  onReminderClose: () => void;
  notes: string;
}

const ReminderModal = ({ isReminderOpen, onReminderClose, notes }: Props) => {
  const getDefaultReminderTime = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 5);

    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  };

  const toast = useToast();

  const [reminderDate, setReminderDate] = useState<Date>(new Date());

  const [reminderTime, setReminderTime] = useState<string>(
    getDefaultReminderTime()
  );

  const handleCreateReminder = async () => {
    if (!notes.trim()) {
      toast({
        title: "Note vide",
        description: "Écrivez une note avant de créer un rappel.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    const [hours, minutes] = reminderTime.split(":").map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      toast({
        title: "Heure invalide",
        description: "Veuillez sélectionner une heure valide.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    const remindAt = new Date(reminderDate);

    remindAt.setHours(hours);
    remindAt.setMinutes(minutes);
    remindAt.setSeconds(0);
    remindAt.setMilliseconds(0);

    if (remindAt.getTime() <= Date.now()) {
      toast({
        title: "Date invalide",
        description: "Le rappel doit être programmé dans le futur.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    try {
      const result = await window.electron.notifications.scheduleReminder(
        notes.trim(),
        remindAt.toISOString()
      );

      if (!result.success) {
        toast({
          title: "Erreur",
          description: result.message || "Impossible de créer le rappel.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });

        return;
      }

      toast({
        title: "Rappel créé",
        description: `Rappel programmé pour le ${remindAt.toLocaleDateString(
          "fr-FR"
        )} à ${remindAt.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });

      onReminderClose();
    } catch (error) {
      console.error("Failed to create reminder:", error);

      toast({
        title: "Erreur",
        description: "Impossible de créer le rappel.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isReminderOpen} onClose={onReminderClose} isCentered>
      <ModalOverlay backdropFilter="auto" backdropBlur="0.3rem" />

      <ModalContent
        borderRadius="12px"
        border="1px solid"
        borderColor="#D1D9E0"
        boxShadow="0 10px 30px rgba(0,0,0,0.15)"
        overflow="hidden"
      >
        <ModalHeader
          color="#1F2937"
          fontSize="1.2rem"
          fontWeight="700"
          borderBottom="1px solid"
          borderColor="#E5E7EB"
          pb={4}
        >
          Créer un rappel
        </ModalHeader>

        <ModalCloseButton
          color="#6B7280"
          top={4}
          _hover={{
            bg: "#F3F4F6",
            color: "#1F2937",
          }}
        />

        <ModalBody py={5}>
          <Text fontSize="0.85rem" fontWeight="600" color="#374151" mb={2}>
            Notes
          </Text>

          <Box
            bg="#091735"
            color="#FFFFFF"
            borderRadius="8px"
            border="1px solid"
            borderColor="rgba(255,255,255,0.1)"
            p={4}
            mb={5}
            maxH="8rem"
            overflowY="auto"
            fontSize="0.95rem"
            lineHeight="1.6"
            whiteSpace="pre-wrap"
          >
            {notes}
          </Box>

          <Flex gap={4} direction={{ base: "column", sm: "row" }}>
            <Box flex={1} minW={0}>
              <ReminderDateControl
                value={reminderDate}
                onChange={setReminderDate}
              />
            </Box>

            <Box flex={1} minW={0}>
              <ReminderTimeControl
                value={reminderTime}
                onChange={(time) => {
                  setReminderTime(
                    typeof time === "string"
                      ? time
                      : `${String(time.getHours()).padStart(2, "0")}:${String(
                          time.getMinutes()
                        ).padStart(2, "0")}`
                  );
                }}
              />
            </Box>
          </Flex>
        </ModalBody>

        <ModalFooter
          borderTop="1px solid"
          borderColor="#E5E7EB"
          bg="#F8F9FB"
          gap={3}
        >
          <Button
            variant="outline"
            borderColor="#D1D9E0"
            color="#374151"
            borderRadius="8px"
            onClick={onReminderClose}
            _hover={{
              bg: "#FFFFFF",
              borderColor: "#9CA3AF",
            }}
          >
            Annuler
          </Button>

          <Button
            colorScheme="blue"
            borderRadius="8px"
            px={6}
            leftIcon={<FaBell />}
            onClick={handleCreateReminder}
          >
            Rappeler
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReminderModal;
