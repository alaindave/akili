import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Attendance } from "../../../../../common/types/attendance/Attendance";
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
      maxH="65vh"
    >
      <Table variant="simple" size="md">
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
