import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { GoDotFill } from "react-icons/go";
import type Employee from "../../../../../common/types/hr/employees/Employee";
import useSyncStore from "../../../../../store/sync.store";
import defaultAvatar from "../../../../assets/default-avatar.jpeg";

type Props = {
  employee?: Employee;
  firstName?: string;
  lastName?: string;
  role?: string;
  department?: string;
};

export default function TimeOffEmployeeCell({ employee, firstName, lastName, role, department }: Props) {
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const photoPath = employee?.photo_path;
  const mimeType = employee?.photo_mime_type || "image/jpeg";
  const { data: photoUrl } = useQuery({
    queryKey: ["time-off-employee-photo", employee?.companyId, photoPath, mimeType, syncVersion],
    queryFn: async () => {
      if (!photoPath) return "";
      const base64 = await window.electron.hr.employees.getPhotoUrl(photoPath);
      return base64 ? `data:${mimeType};base64,${base64}` : "";
    },
    enabled: Boolean(photoPath),
    staleTime: Infinity,
    retry: false,
  });
  const name = [employee?.firstName ?? firstName, employee?.lastName ?? lastName].filter(Boolean).join(" ");
  role = employee?.role ?? role;
  department = employee?.department ?? department;

  return (
    <Flex align="center" gap={3} minW="220px" py={1}>
      <Image
        src={photoUrl || defaultAvatar}
        fallbackSrc={defaultAvatar}
        alt={name}
        boxSize="48px"
        flexShrink={0}
        borderRadius="full"
        objectFit="cover"
      />
      <Box minW={0}>
        <Text color="gray.900" fontWeight="600" fontSize="0.99rem" lineHeight="1.25" noOfLines={1}>
          {name}
        </Text>
        <Flex align="center" gap={1.5} mt={1} minW={0}>
          {role && <Text color="gray.700" fontSize="0.99rem" fontWeight="500" noOfLines={1}>{role}</Text>}
          {role && department && <Box color="green.500" fontSize="10px" flexShrink={0} aria-hidden="true"><GoDotFill /></Box>}
          {department && <Text color="gray.800" fontSize="0.99rem" fontWeight="500" noOfLines={1}>{department}</Text>}
        </Flex>
      </Box>
    </Flex>
  );
}
