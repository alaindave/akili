import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Attendance } from "../../../../../common/types/hr/attendance/Attendance";
import AttendanceNotesPopover from "./AttendanceNotesPopover";
import { formatLateMinutes } from "./ClockIn";

interface AttendanceTableProps {
  records: Attendance[];
}

export default function AttendanceTable({ records }: AttendanceTableProps) {
  return (
    <TableContainer
      borderWidth="1px"
      borderRadius="xl"
      bg="white"
      boxShadow="sm"
      overflowY="auto"
      width="100%"
      overflowX="auto"
      maxH={{ base: "max(242px, 45dvh)", md: "65vh" }}
    >
      <Table variant="simple" size="md" minW="560px" sx={{
        "th, td": { px: { base: 2, md: 6 }, py: { base: 1, md: 4 } },
        "th": { height: { base: "40px", md: "auto" }, fontSize: { base: "0.65rem", md: "0.75rem" } },
        "td": { height: { base: "40px", md: "auto" }, fontSize: { base: "0.8rem", md: "1rem" } },
      }}>
        <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
          <Tr>
            <Th>Date</Th>
            <Th>Pointage entrée</Th>
            <Th>Pointage sortie</Th>
            <Th>Statut</Th>
            <Th>Minutes de retard</Th>
          </Tr>
        </Thead>

        <Tbody>
          {records.map((record) => (
            <Tr key={record._id}>
              <Td>{new Date(record.date).toLocaleDateString("fr-FR")}</Td>

              <Td>
                {record.clockIn
                  ? new Date(record.clockIn).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null}
              </Td>

              <Td>
                {record.clockOut
                  ? new Date(record.clockOut).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null}
              </Td>
              <Td>
                <AttendanceNotesPopover attendance={record} />
              </Td>
              <Td>
                {record.lateMinutes
                  ? formatLateMinutes(record.lateMinutes)
                  : null}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
