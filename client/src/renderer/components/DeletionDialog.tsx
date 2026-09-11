import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from "@chakra-ui/react";
import Employee from "../../common/types/Employee";
import { AttendanceWithEmployee } from "../../common/types/Attendance";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDeleting?: boolean;
  onConfirmation: () => void;
  header: string;
  body?: string;
  employee?: Employee;
  attendance?: AttendanceWithEmployee;
}

const DeletionDialog = ({
  isOpen,
  onClose,
  isDeleting,
  onConfirmation,
  header,
  body,
  employee,
  attendance,
}: Props) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay
        bg="rgba(15, 23, 42, 0.25)"
        backdropFilter="blur(3px)"
      >
        <AlertDialogContent
          bg="white"
          color="#1F2937"
          borderRadius="10px"
          border="1px solid #CBD5E1"
          boxShadow="0 12px 35px rgba(15, 23, 42, 0.18)"
          overflow="hidden"
          mx={4}
        >
          {/* Header */}
          <AlertDialogHeader
            bg="#F8FAFC"
            borderBottom="1px solid #E2E8F0"
            color="#1F2937"
            fontSize="17px"
            fontWeight="700"
            py={4}
            px={5}
          >
            {header}
          </AlertDialogHeader>

          {/* Body */}
          {employee ? (
            <AlertDialogBody
              color="#374151"
              fontSize="15px"
              lineHeight="1.6"
              py={5}
              px={5}
            >
              Êtes-vous sûr de vouloir supprimer{" "}
              <Text as="span" color="#D39A00" fontWeight="700">
                {employee.firstName} {employee.lastName}
              </Text>{" "}
              de la liste des employés ?
            </AlertDialogBody>
          ) : attendance ? (
            <AlertDialogBody
              color="#374151"
              fontSize="15px"
              lineHeight="1.6"
              py={5}
              px={5}
            >
              Êtes-vous sûr de vouloir supprimer{" "}
              <Text as="span" color="#D39A00" fontWeight="700">
                {attendance.firstName} {attendance.lastName}
              </Text>{" "}
              de la liste de présence ?
            </AlertDialogBody>
          ) : (
            <AlertDialogBody
              color="#374151"
              fontSize="15px"
              lineHeight="1.6"
              py={5}
              px={5}
            >
              {body}
            </AlertDialogBody>
          )}

          {/* Footer */}
          <AlertDialogFooter
            bg="#F8FAFC"
            borderTop="1px solid #E2E8F0"
            px={5}
            py={3}
          >
            <Button
              ref={cancelRef}
              onClick={onClose}
              bg="white"
              color="#374151"
              border="1px solid #CBD5E1"
              borderRadius="6px"
              height="38px"
              px={5}
              fontWeight="600"
              _hover={{
                bg: "#F1F5F9",
                borderColor: "#94A3B8",
              }}
              _active={{
                bg: "#E2E8F0",
              }}
            >
              Non
            </Button>

            <Button
              colorScheme="red"
              onClick={onConfirmation}
              ml={3}
              isLoading={isDeleting}
              loadingText="Patientez..."
              spinnerPlacement="start"
              isDisabled={isDeleting}
              borderRadius="6px"
              height="38px"
              px={5}
              fontWeight="600"
              _hover={{
                bg: "#C53030",
              }}
            >
              Oui
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default DeletionDialog;
