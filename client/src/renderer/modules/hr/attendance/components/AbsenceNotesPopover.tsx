import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Textarea,
  Button,
  useDisclosure,
  Portal,
  useToast,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  onSubmit: (notes?: string | undefined) => Promise<boolean>;
  employeeId: string;
  attendanceId: string;
  existingNotes?: string | undefined;
}

const AbsenceNotesPopover = ({
  onSubmit,
  employeeId,
  attendanceId,
  existingNotes,
}: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [absenceNote, setAbsenceNote] = useState(existingNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    setAbsenceNote(existingNotes);
  }, [existingNotes]);

  const close = () => {
    setAbsenceNote("");
    onClose();
  };

  const handleSave = async () => {
    setAbsenceNote("");
    setIsSubmitting(true);

    try {
      console.log("NOTES TO SAVE:", absenceNote);
      const success = await onSubmit(absenceNote);
      if (success) {
        setIsSubmitting(false);
        onSubmit(absenceNote);
        onClose();
      }
    } catch (error) {
      console.error("FAILED TO SAVE NOTES:", error);
    }
  };

  const handleLeave = async () => {
    setAbsenceNote("");
    setIsSubmitting(true);

    try {
      const employee = await window.electron.hr.employees.getById(user.companyId, employeeId);

      if (!employee) {
        toast({
          title: "Employé introuvable",
          description:
            "Impossible de trouver l'employé pour vérifier son solde de congé.",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "top-right",
        });

        return;
      }

      const remainingLeave = employee.remainingLeave ?? 0;

      const leaveDays = 1;

      if (remainingLeave < leaveDays) {
        toast({
          title: "Solde de congé insuffisant",
          description:
            "L'employé ne dispose d'aucun jour de congé restant. L'absence ne peut pas être convertie en congé.",
          status: "info",
          duration: 5000,
          isClosable: true,
          position: "top-right",
        });

        return;
      }

      const today = new Date();
      const date = today.toISOString().split("T")[0];

      const leave = {
        managerEmail: user.email,
        employeeFirstName: employee.firstName,
        employeeLastName: employee.lastName,
        employeeId,
        startDate: date,
        endDate: date,
        subject: "Absence approuvée",
        notes: absenceNote ?? "",
        status: "APPROUVÉ" as const,
      };

      // Create leave
      const savedLeave = await window.electron.hr.leave.create(user.companyId, leave);

      console.log("LEAVE SUCCESSFULLY SAVED:", savedLeave);

      // Deduct one leave day
      const updatedEmployee = await window.electron.hr.employees.update(
        user.companyId,
        employeeId,
        {
          remainingLeave: remainingLeave - leaveDays,
        }
      );

      console.log("EMPLOYEE LEAVE BALANCE UPDATED:", updatedEmployee);

      // Change attendance from ABSENT → CONGÉ
      const attendanceChange = await window.electron.hr.attendance.update(
        user.companyId,
        attendanceId,
        new Date().toISOString(),
        {
          notes: absenceNote ?? "",
          status: "CONGÉ",
        }
      );

      console.log("ATTENDANCE CHANGE:", attendanceChange);

      toast({
        title: "Congé enregistré",
        description: "L'absence a été convertie en congé avec succès.",
        status: "success",
        duration: 4000,
        isClosable: true,
        position: "top-right",
      });

      onSubmit();
      onClose();
    } catch (error) {
      console.error("UNABLE TO SAVE LEAVE:", error);

      toast({
        title: "Erreur",
        description: "Impossible de convertir l'absence en congé.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const flashLate = keyframes`
  0% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.2;
    transform: scale(1.08);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={close}
      placement="right"
      closeOnBlur={false}
      initialFocusRef={textareaRef}
    >
      <PopoverTrigger>
        <Badge
          animation={`${flashLate} 1.5s ease-in-out 2`}
          bg="red.500"
          color="gray.200"
          fontSize="14px"
          cursor="pointer"
        >
          ABSENT
        </Badge>
      </PopoverTrigger>
      <Portal>
        <PopoverContent
          bg="#0E1E47"
          borderColor="#22345F"
          color="white"
          w="320px"
        >
          <PopoverArrow />

          <PopoverBody>
            <Textarea
              ref={textareaRef}
              value={absenceNote ?? ""}
              onChange={(e) => setAbsenceNote(e.target.value)}
              placeholder="Raison de l'absence..."
              bg="#08162b"
              color="white"
              resize="none"
              minH="100px"
            />

            <Button
              mt={3}
              size="sm"
              colorScheme="yellow"
              onClick={handleSave}
              isLoading={isSubmitting}
              loadingText="Patientez..."
              spinnerPlacement="start"
              isDisabled={isSubmitting}
            >
              Sauvegarder
            </Button>
            <Button
              mt={3}
              ml={10}
              size="sm"
              colorScheme="green"
              onClick={handleLeave}
              isLoading={isSubmitting}
              loadingText="Patientez..."
              spinnerPlacement="start"
              isDisabled={isSubmitting}
            >
              Congé
            </Button>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

export default AbsenceNotesPopover;
