import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { FaArrowLeftLong } from "react-icons/fa6";
import DatePicker from "react-datepicker";
import { fr } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  lateReportDate,
  lateReportTime,
} from "../../../../../common/types/attendance/LateAttendanceReport";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";

function dateKey(date: Date | null): string {
  return date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`
    : "";
}

export default function LateAttendanceReportPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [start, setStart] = useState<Date | null>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [end, setEnd] = useState<Date | null>(() => new Date());
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const startDate = dateKey(start);
  const endDate = dateKey(end);
  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const {
    data: records,
    isFetching,
    isError,
  } = useQuery({
    queryKey: [
      "late-attendance-report",
      companyId,
      startDate,
      endDate,
      syncVersion,
    ],
    queryFn: () =>
      window.electron.hr.attendance_reports.getLate(
        companyId,
        startDate,
        endDate
      ),
    enabled: Boolean(companyId && validRange),
  });
  const download = async () => {
    if (!companyId || !validRange || saving) return;
    setSaving(true);
    try {
      const result = await window.electron.hr.attendance_reports.saveLatePdf(
        companyId,
        startDate,
        endDate
      );
      if (!result.canceled)
        toast({ title: "Rapport enregistré", status: "success" });
    } catch {
      toast({ title: "Impossible d'enregistrer le rapport", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box bg="#F5F6F8" p={{ base: 3, lg: 6 }} width="100%" height="100%">
      <Flex justify="space-between">
        <HStack>
          <Button
            as={Link}
            to="/employees_admin/reports"
            variant="outline"
            mb={5}
          >
            <FaArrowLeftLong color="black" />
          </Button>
          <Box>
            <Text as="h1" fontSize="1.1rem" fontWeight="bold" color="#03143B">
              Rapport des retards
            </Text>
            <Text fontSize="1rem" color="gray.600">
              Consultez les rapports de retard pour la période sélectionnée.
            </Text>
          </Box>
        </HStack>
        <Button
          colorScheme="yellow"
          onClick={download}
          isLoading={saving}
          isDisabled={
            !companyId ||
            !validRange ||
            isFetching ||
            isError ||
            !records?.length
          }
        >
          Télécharger
        </Button>
      </Flex>
      <Flex gap={4} align="end" wrap="wrap" my={6}>
        <FormControl maxW="240px">
          <FormLabel htmlFor="late-start">Date de début</FormLabel>
          <DatePicker
            id="late-start"
            selected={start}
            onChange={(value: Date | null) => setStart(value)}
            dateFormat="dd-MM-yyyy"
            placeholderText="DD-MM-YYYY"
            locale={fr}
            disabled={saving}
            strictParsing
            customInput={<Input bg="white" />}
          />
        </FormControl>
        <FormControl maxW="240px">
          <FormLabel htmlFor="late-end">Date de fin</FormLabel>
          <DatePicker
            id="late-end"
            selected={end}
            onChange={(value: Date | null) => setEnd(value)}
            dateFormat="dd-MM-yyyy"
            placeholderText="DD-MM-YYYY"
            locale={fr}
            disabled={saving}
            strictParsing
            customInput={<Input bg="white" />}
          />
        </FormControl>
      </Flex>
      {!startDate || !endDate ? (
        <Text>Choisissez les dates de début et de fin.</Text>
      ) : startDate > endDate ? (
        <Text role="alert" color="red.600">
          La date de fin doit être égale ou postérieure à la date de début.
        </Text>
      ) : null}
      {validRange && isFetching && (
        <Text role="status">Chargement du rapport…</Text>
      )}
      {validRange && isError && (
        <Text role="alert" color="red.600">
          Impossible de charger le rapport. Veuillez réessayer.
        </Text>
      )}
      {validRange && records && !isFetching && !isError && (
        <>
          <Text mb={3} fontWeight="semibold">
            Du {lateReportDate(startDate)} au {lateReportDate(endDate)} ·{" "}
            {records.length} retards
          </Text>
          <TableContainer
            bg="white"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.200"
            whiteSpace="normal"
            maxH="63vh"
            overflowY="auto"
          >
            <Table
              size="sm"
              w="100%"
              sx={{
                tableLayout: "fixed",
                "th, td": { px: 2, overflowWrap: "anywhere" },
              }}
            >
              <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                <Tr>
                  <Th>Date</Th>
                  <Th>Employé</Th>
                  <Th>Matricule</Th>
                  <Th>Département</Th>
                  <Th>Arrivée</Th>
                  <Th isNumeric>Retard (min)</Th>
                </Tr>
              </Thead>
              <Tbody>
                {records.map((record) => (
                  <Tr key={record._id}>
                    <Td py={4}>{lateReportDate(record.date)}</Td>
                    <Td>
                      {record.firstName} {record.lastName}
                    </Td>
                    <Td>{record.matricule}</Td>
                    <Td>{record.department}</Td>
                    <Td>{lateReportTime(record.clockIn)}</Td>
                    <Td isNumeric>{record.lateMinutes ?? "—"}</Td>
                  </Tr>
                ))}
                {!records.length && (
                  <Tr>
                    <Td colSpan={6} py={8} textAlign="center">
                      Aucun retard pour cette période.
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
