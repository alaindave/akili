import { Box, Button, Heading, Text, useColorModeValue } from "@chakra-ui/react";
import { FiArrowLeft } from "react-icons/fi";
import { useState } from "react";
import PdfUpload from "./EmployeePdfUpload";

interface UploadDocumentPageProps {
  onClose: () => void;
  employeeId: string;
  uploadedBy?: string;
  onRefresh?: () => void;
}

export default function UploadDocumentPage({
  onClose, employeeId, uploadedBy, onRefresh,
}: UploadDocumentPageProps) {
  const [uploading, setUploading] = useState(false);
  const background = useColorModeValue("white", "gray.900");
  const foreground = useColorModeValue("gray.900", "gray.100");

  return (
    <Box as="section" bg={background} color={foreground} p={{ base: 5, md: 8 }} borderWidth="1px" borderRadius="lg">
      <Button leftIcon={<FiArrowLeft />} variant="ghost" colorScheme="gray" onClick={onClose} isDisabled={uploading} mb={6}>
        Retour aux documents
      </Button>
      <Box maxW="680px" mx="auto">
        <Heading size="lg" mb={2}>Ajouter un document</Heading>
        <Text opacity={0.7} mb={8}>Classez un document dans le dossier de cet employé.</Text>
        <PdfUpload
          employeeId={employeeId}
          uploadedBy={uploadedBy}
          onUploadingChange={setUploading}
          onUploaded={() => onRefresh?.()}
        />
      </Box>
    </Box>
  );
}
