import {
  Box,
  Flex,
  Icon,
  Input,
  Text,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  FiFileText,
  FiUpload,
  FiCreditCard,
  FiCheckCircle,
} from "react-icons/fi";
import { useRef, useState } from "react";
import { EmployeeDocumentType } from "../../../../../common/types/EmployeeDocuments";
import useAdminUser from "../../../../../store/auth.store";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface PdfUploadProps {
  employeeId: string;
  uploadedBy?: string;
  onUploaded?: (uploaded: boolean) => void;
}

export default function PdfUpload({
  employeeId,
  uploadedBy,
  onUploaded,
}: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [documentType, setDocumentType] = useState<EmployeeDocumentType>(
    "EMPLOYMENT_CONTRACT"
  );

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const user = useAdminUser((store) => store.adminUser);

  const uploadDocument = async (selectedFile: File) => {
    try {
      setUploading(true);

      const arrayBuffer = await selectedFile.arrayBuffer();

      await window.electron.hr.employees_documents.upload({
        companyId: user.companyId,
        employeeId,
        uploadedBy: uploadedBy ?? user._id,
        documentType,
        name: selectedFile.name,
        mimeType: selectedFile.type,
        buffer: new Uint8Array(arrayBuffer),
      });

      setFile(selectedFile);
      onUploaded?.(true);
    } catch (error) {
      console.error("DOCUMENT UPLOAD FAILED:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (selected: File | null) => {
    if (!selected) return;

    if (documentType === "EMPLOYMENT_CONTRACT") {
      if (selected.type !== "application/pdf") {
        alert("Veuillez sélectionner un document PDF.");
        return;
      }
    } else {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

      if (!allowedTypes.includes(selected.type)) {
        alert("Veuillez sélectionner un fichier PDF ou une image JPG/JPEG.");
        return;
      }
    }

    if (selected.size > MAX_FILE_SIZE) {
      alert("Taille maximale : 10 MB.");
      return;
    }

    await uploadDocument(selected);
  };

  return (
    <>
      <SimpleGrid columns={2} gap={4} mb={6}>
        <Box
          p={5}
          borderWidth="2px"
          borderRadius="xl"
          cursor="pointer"
          transition="all .2s"
          borderColor={
            documentType === "EMPLOYMENT_CONTRACT" ? "yellow.400" : "gray.600"
          }
          bg={
            documentType === "EMPLOYMENT_CONTRACT" ? "yellow.400" : "gray.800"
          }
          color={documentType === "EMPLOYMENT_CONTRACT" ? "black" : "white"}
          onClick={() => setDocumentType("EMPLOYMENT_CONTRACT")}
          _hover={{
            borderColor: "yellow.300",
            transform: "translateY(-2px)",
          }}
        >
          <VStack gap={2}>
            <Icon as={FiFileText} boxSize={8} />

            <Text fontWeight="bold">Contrat de travail</Text>

            {documentType === "EMPLOYMENT_CONTRACT" && (
              <Flex align="center" gap={1} mt={2}>
                <Icon as={FiCheckCircle} />
                <Text fontSize="sm" fontWeight="bold">
                  Sélectionné
                </Text>
              </Flex>
            )}
          </VStack>
        </Box>

        <Box
          p={5}
          borderWidth="2px"
          borderRadius="xl"
          cursor="pointer"
          transition="all .2s"
          borderColor={
            documentType === "NATIONAL_ID" ? "yellow.400" : "gray.600"
          }
          bg={documentType === "NATIONAL_ID" ? "yellow.400" : "gray.800"}
          color={documentType === "NATIONAL_ID" ? "black" : "white"}
          onClick={() => setDocumentType("NATIONAL_ID")}
          _hover={{
            borderColor: "yellow.300",
            transform: "translateY(-2px)",
          }}
        >
          <VStack gap={2}>
            <Icon as={FiCreditCard} boxSize={8} />
            <Text fontWeight="bold">Carte d'identité</Text>

            {documentType === "NATIONAL_ID" && (
              <Flex align="center" gap={1} mt={2}>
                <Icon as={FiCheckCircle} />
                <Text fontSize="sm" fontWeight="bold">
                  Sélectionné
                </Text>
              </Flex>
            )}
          </VStack>
        </Box>
      </SimpleGrid>

      <Input
        ref={inputRef}
        type="file"
        accept={
          documentType === "EMPLOYMENT_CONTRACT"
            ? "application/pdf"
            : "application/pdf,image/jpeg,image/jpg,image/png"
        }
        display="none"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {!file ? (
        <Box
          border="2px dashed"
          borderColor="gray.500"
          borderRadius="xl"
          p={10}
          cursor={uploading ? "default" : "pointer"}
          textAlign="center"
          onClick={() => !uploading && inputRef.current?.click()}
          _hover={{
            borderColor: "yellow.400",
            bg: "whiteAlpha.50",
          }}
        >
          <VStack gap={4}>
            <Icon as={FiUpload} boxSize={12} color="yellow.400" />

            <Text fontWeight="bold" fontSize="lg">
              {documentType === "EMPLOYMENT_CONTRACT"
                ? "Ajouter un contrat de travail"
                : "Ajouter une carte d'identité"}
            </Text>

            <Text color="gray.400" fontSize="sm">
              {documentType === "EMPLOYMENT_CONTRACT"
                ? "Cliquez ici pour sélectionner un document PDF"
                : "Cliquez ici pour sélectionner un document PDF ou JPG"}
            </Text>

            <Text fontSize="xs" color="gray.500">
              Taille maximale : 10 MB
            </Text>
          </VStack>
        </Box>
      ) : (
        <Flex
          borderWidth="1px"
          borderRadius="xl"
          p={5}
          bg="gray.800"
          align="center"
          gap={4}
        >
          <Icon as={FiFileText} color="yellow.400" boxSize={8} />

          <Box flex={1}>
            <Text fontWeight="bold" color="white">
              {file.name}
            </Text>

            <Text fontSize="sm" color="gray.400">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Text>
          </Box>

          <Text color="green.400" fontWeight="bold">
            Téléversé ✓
          </Text>
        </Flex>
      )}
    </>
  );
}
