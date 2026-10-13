import {
  Box, Button, FormControl, FormLabel, Input, Text, VStack, useColorModeValue,
} from "@chakra-ui/react";
import { FiUpload } from "react-icons/fi";
import { type FormEvent, useRef, useState } from "react";
import useAdminUser from "../../../../../store/auth.store";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface PdfUploadProps {
  employeeId: string;
  uploadedBy?: string;
  onUploaded?: (uploaded: boolean) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export default function PdfUpload({ employeeId, uploadedBy, onUploaded, onUploadingChange }: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const user = useAdminUser((store) => store.adminUser);
  const buttonBackground = useColorModeValue("gray.900", "gray.100");
  const buttonForeground = useColorModeValue("white", "gray.900");

  const handleFile = (selected: File | null) => {
    setUploaded(false);
    setError("");
    setFile(null);
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      setError("Taille maximale : 10 MB.");
      return;
    }
    setFile(selected);
  };

  const uploadDocument = async () => {
    if (uploading || uploaded) return;
    if (!documentType.trim() || !file) {
      setError("Saisissez le type de document et sélectionnez un fichier.");
      return;
    }
    setUploading(true);
    onUploadingChange?.(true);
    setError("");
    try {
      await window.electron.hr.employees_documents.upload({
        companyId: user.companyId,
        employeeId,
        uploadedBy: uploadedBy ?? user._id,
        documentType: documentType.trim(),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer: new Uint8Array(await file.arrayBuffer()),
      });
      setUploaded(true);
      onUploaded?.(true);
    } catch (error) {
      console.error("DOCUMENT UPLOAD FAILED:", error);
      setError("Le téléversement a échoué. Veuillez réessayer.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <Box as="form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void uploadDocument(); }}>
      <VStack spacing={6} align="stretch">
        <FormControl isRequired isDisabled={uploading || uploaded}>
          <FormLabel htmlFor="employee-document-type">Type de document</FormLabel>
          <Input id="employee-document-type" value={documentType} focusBorderColor="gray.500"
            placeholder="Ex. : Augmentation de salaire" onChange={(event) => setDocumentType(event.target.value)} />
        </FormControl>
        <Box borderWidth="1px" borderStyle="dashed" borderRadius="lg" p={8} textAlign="center">
          <Text fontWeight="semibold" mb={2}>Fichier à joindre</Text>
          <Text fontSize="sm" opacity={0.7} mb={4}>Tous les formats sont acceptés · 10 MB maximum</Text>
          <Input ref={inputRef} type="file" display="none" isDisabled={uploading || uploaded}
            onChange={(event) => { handleFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          <Button type="button" variant="outline" colorScheme="gray" leftIcon={<FiUpload />}
            isDisabled={uploading || uploaded} onClick={() => inputRef.current?.click()}>
            {file ? "Changer de fichier" : "Choisir un fichier"}
          </Button>
          {file && <Text mt={4} fontSize="sm" overflowWrap="anywhere">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</Text>}
        </Box>
        {error && <Text role="alert" fontWeight="medium">{error}</Text>}
        {uploaded && <Text role="status">Document enregistré. Il sera synchronisé dès que possible.</Text>}
        {uploaded ? (
          <Button type="button" colorScheme="gray" variant="outline" onClick={() => {
            setUploaded(false); setFile(null); setDocumentType(""); setError("");
          }}>Ajouter un autre document</Button>
        ) : (
          <Button type="submit" bg={buttonBackground} color={buttonForeground} _hover={{ opacity: 0.85 }}
            isLoading={uploading} loadingText="Téléversement…" isDisabled={!documentType.trim() || !file}>
            Téléverser le document
          </Button>
        )}
      </VStack>
    </Box>
  );
}
