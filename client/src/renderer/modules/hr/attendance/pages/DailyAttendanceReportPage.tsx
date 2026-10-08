import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Box,
  Badge,
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
  Th,
  Thead,
  Tr,
  Text,
  useToast,
} from "@chakra-ui/react";
import DatePicker from "react-datepicker";
import { FaArrowLeftLong } from "react-icons/fa6";
import { fr } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";

function reportTime(value?: string | null) {
  if (!value) return "—";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "—" : time.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit",
  });
}

const statusColors: Record<string, string> = {
  PONCTUEL: "green", RETARD: "orange", ABSENT: "red", CONGÉ: "blue", CONGE: "blue",
};

export default function DailyAttendanceReportPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [date, setDate] = useState<Date | null>(() => new Date());
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const selectedDay = date && !Number.isNaN(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
  const { data: report, isFetching, isError, refetch } = useQuery({
    queryKey: ["daily-attendance-report", companyId, selectedDay, syncVersion],
    queryFn: () => window.electron.hr.attendance_reports.getDaily(companyId, selectedDay),
    enabled: Boolean(companyId && selectedDay),
  });

  const download = async () => {
    if (!selectedDay || !companyId || saving) return;
    setSaving(true);
    try {
      const result = await window.electron.hr.attendance_reports.savePdf(
        companyId,
        selectedDay
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
    <Box p={{ base: 3, lg: 6 }} pb="80px" bg="#F5F6F8" minH="93vh">
      <Flex width="100%" justify="space-between" gap={3} wrap="wrap">
        <HStack>
          <Button
            as={Link}
            to="/hr/reports"
            variant="outline"
            mb={5}
          >
            <FaArrowLeftLong color="black" />
          </Button>
          <Box>
            <Text as="h1" fontSize="1.1rem" fontWeight="bold" color="#03143B">
              Rapport de présence quotidien
            </Text>
            <Text fontSize="1rem" color="gray.600">
              Consultez les présences d’une journée et téléchargez le rapport
            </Text>
          </Box>
        </HStack>
        <Button
          colorScheme="yellow"
          onClick={download}
          isLoading={saving}
          isDisabled={!selectedDay || !companyId || isFetching || isError || !report}
        >
          Télécharger
        </Button>
      </Flex>
      <Flex gap={4} align="end" wrap="wrap" my={6}>
        <FormControl maxW="260px">
          <FormLabel htmlFor="attendance-day">Choisir une date</FormLabel>
          <DatePicker
            id="attendance-day"
            selected={date}
            onChange={(selected: Date | null) => setDate(selected)}
            dateFormat="dd-MM-yyyy"
            placeholderText="DD-MM-YYYY"
            locale={fr}
            disabled={saving}
            customInput={<Input bg="white" />}
            strictParsing
          />
        </FormControl>
      </Flex>
      {!companyId ? (
        <Text>Connectez-vous à une entreprise pour consulter le rapport.</Text>
      ) : !selectedDay ? (
        <Text>Choisissez une date pour consulter le rapport.</Text>
      ) : isFetching ? (
        <Text role="status">Chargement du rapport…</Text>
      ) : isError ? (
        <Box>
          <Text role="alert" color="red.600">Impossible de charger le rapport.</Text>
          <Button mt={3} variant="outline" onClick={() => { void refetch(); }}>Réessayer</Button>
        </Box>
      ) : report && (
        <>
          <Text mb={3} fontWeight="600">
            Présences du {date?.toLocaleDateString("fr-FR")} · {report.employees.length} employé(s)
          </Text>
          {report.employees.length === 0 ? (
            <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" p={8}>
              <Text textAlign="center">Aucun employé dans le rapport pour cette journée.</Text>
            </Box>
          ) : (
            <TableContainer bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" maxH="60vh" overflowY="auto">
              <Table size="sm" aria-label="Présences de la journée sélectionnée">
                <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                  <Tr>
                    <Th>Employé</Th><Th>Matricule</Th><Th>Département</Th><Th>Poste</Th>
                    <Th>Entrée</Th><Th>Sortie</Th><Th>Statut</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {report.employees.map((employee, index) => (
                    <Tr key={`${employee.employeeId}-${index}`}>
                      <Td py={4}>{[employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.employeeId}</Td>
                      <Td>{employee.matricule || "—"}</Td>
                      <Td>{employee.department || "—"}</Td>
                      <Td>{employee.role || "—"}</Td>
                      <Td>{reportTime(employee.clockIn)}</Td>
                      <Td>{reportTime(employee.clockOut)}</Td>
                      <Td><Badge colorScheme={statusColors[employee.status.toUpperCase()] ?? "gray"}>{employee.status}</Badge></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}
