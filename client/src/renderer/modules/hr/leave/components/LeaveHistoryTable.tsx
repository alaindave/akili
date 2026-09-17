import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  Text,
} from "@chakra-ui/react";
import Leave from "../../../../../common/types/leave/Leave";

const statusColor = (status: string) => {
  switch (status) {
    case "APPROUVÉ":
      return "green";
    case "REFUSÉ":
      return "red";
    case "ATTENTE_APPROBATION":
      return "orange";
    case "ANNULÉ":
      return "blue";
    default:
      return "gray";
  }
};

interface Props {
  leaves: Leave[];
}

export default function LeaveHistoryTable({ leaves }: Props) {
  return (
    <TableContainer
      borderWidth="1px"
      borderRadius="lg"
      overflowX="auto"
      bg="white"
      shadow="sm"
      mt="2rem"
      ml="2rem"
    >
      <Table variant="simple" size="sm">
        <Thead bg="gray.50">
          <Tr>
            <Th>Soumis le</Th>
            <Th>Debut de congé</Th>
            <Th>Fin de congé</Th>
            <Th>Motif</Th>
            <Th>Notes</Th>
            <Th>Statut</Th>
          </Tr>
        </Thead>

        <Tbody>
          {leaves.map((leave) => (
            <Tr key={leave._id} h="4.5rem">
              <Td fontSize="1rem">
                {new Date(leave.submittedAt).toLocaleDateString("fr-FR")}
              </Td>

              <Td fontSize="1rem">
                {new Date(leave.startDate).toLocaleDateString("fr-FR")}
              </Td>

              <Td fontSize="1rem">
                {new Date(leave.endDate).toLocaleDateString("fr-FR")}
              </Td>

              <Td fontSize="1rem" fontWeight="medium">
                {leave.subject}
              </Td>

              <Td fontSize="1rem" maxW="15rem" py="1rem">
                <Text whiteSpace="normal" noOfLines={3}>
                  {leave.notes}
                </Text>
              </Td>

              <Td>
                <Badge
                  bg={statusColor(leave.status)}
                  color="#ffffff"
                  borderRadius="full"
                  px={3}
                  py={1}
                  textTransform="capitalize"
                >
                  {leave.status}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
