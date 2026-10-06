import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import PdfUpload from "./EmployeePdfUpload";
import { EmployeeDocumentType } from "../../../../../common/types/hr/employees/EmployeeDocuments";
import { useState } from "react";

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  uploadedBy?: string;
  documentType: EmployeeDocumentType;
  onRefresh?: () => void;
}

export default function UploadDocumentModal({
  isOpen,
  onClose,
  employeeId,
  uploadedBy,
  documentType,
  onRefresh,
}: UploadDocumentModalProps) {
  const [uploaded, setUploaded] = useState<boolean>(false);
  const handleClose = () => {
    if (!uploaded) onClose();
    onRefresh?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered>
      <ModalOverlay backdropFilter="blur(0.5rem)">
        <ModalContent>
          <ModalHeader>Type de documents</ModalHeader>

          <ModalCloseButton />

          <ModalBody pb={6}>
            <PdfUpload
              employeeId={employeeId}
              uploadedBy={uploadedBy}
              onUploaded={(uploaded) => setUploaded(uploaded)}
            />
          </ModalBody>

          <ModalFooter>
            <Button
              color="#ffffff"
              bg="red.500"
              onClick={handleClose}
              _hover={{ bg: "red.500" }}
            >
              Fermer
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
}
