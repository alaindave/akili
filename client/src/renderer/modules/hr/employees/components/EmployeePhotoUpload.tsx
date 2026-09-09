import { Box, Image } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import defaultAvatar from "../../../../assets/default-avatar.jpeg";
import useAdminUser from "../../../../../store/auth.store";

interface Props {
  employeeId: string;
  currentPhoto?: string | null;
  onUploaded?: () => void;
}

export default function EmployeePhotoUpload({
  employeeId,
  currentPhoto,
  onUploaded,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    if (currentPhoto) {
      setPreview(null);
    }
  }, [currentPhoto]);

  async function upload(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    await window.electron.employees.uploadPhoto(user.companyId, employeeId, {
      name: file.name,
      buffer: arrayBuffer,
    });
    onUploaded?.();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    upload(file);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    upload(file);
  }

  return (
    <Box
      w="100px"
      h="100px"
      borderRadius="full"
      overflow="hidden"
      border="1px solid"
      borderColor={isDragging ? "blue.400" : "gray.300"}
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      position="relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
        onChange={handleSelect}
      />

      <Image
        src={preview || currentPhoto || defaultAvatar}
        boxSize="140px"
        objectFit="cover"
      />
    </Box>
  );
}
