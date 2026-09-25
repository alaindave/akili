import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FaArrowLeftLong } from "react-icons/fa6";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
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
import DatePicker from "react-datepicker";
import { fr } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  attendanceWeekDates,
  formatAttendanceReportDate,
} from "../../../../../common/types/attendance/WeeklyAttendanceReport";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";

export default function WeeklyAttendanceReportPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [date, setDate] = useState(() => {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return attendanceWeekDates(localDate)[0];
  });
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const {
    data: report,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["weekly-attendance-report", companyId, date, syncVersion],
    queryFn: () =>
      window.electron.hr.attendance_reports.getWeekly(companyId, date),
    enabled: Boolean(companyId && date),
  });
  const departments = [
    ...new Set(
      report?.employees
        .map((employee) => employee.department)
        .filter(Boolean) ?? []
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const employees =
    report?.employees.filter(
      (employee) => !department || employee.department === department
    ) ?? [];
  const download = async () => {
    setSaving(true);
    try {
      const result = await window.electron.hr.attendance_reports.saveWeeklyPdf(
        companyId,
        date,
        department || undefined
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
    <Box p={{ base: 3, lg: 6 }} w="100%" minW={0} bg="#F5F6F8" minH="93vh">
      <Flex width="100%" justify="space-between">
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
              Rapport de présence hebdomadaire
            </Text>
            <Text fontSize="1rem" color="gray.600">
              Heure d'arrivée, absence ou congé du lundi au vendredi.
            </Text>
          </Box>
        </HStack>
        <Button
          colorScheme="yellow"
          onClick={download}
          isLoading={saving}
          isDisabled={
            !date || !report || isFetching || isError || !employees.length
          }
        >
          Télécharger
        </Button>
      </Flex>
      <Flex gap={4} align="end" wrap="wrap" my={6}>
        <FormControl maxW="260px">
          <FormLabel htmlFor="attendance-week">Choisir une date</FormLabel>
          <DatePicker
            id="attendance-week"
            selected={date ? new Date(`${date}T12:00:00`) : null}
            dateFormat="dd-MM-yyyy"
            placeholderText="DD-MM-YYYY"
            locale={fr}
            disabled={saving}
            customInput={<Input bg="white" />}
            strictParsing
            onChange={(selected: Date | null) =>
              setDate(
                selected
                  ? `${selected.getFullYear()}-${String(
                      selected.getMonth() + 1
                    ).padStart(2, "0")}-${String(selected.getDate()).padStart(
                      2,
                      "0"
                    )}`
                  : ""
              )
            }
          />
        </FormControl>
        <FormControl maxW="260px">
          <FormLabel htmlFor="attendance-department">Département</FormLabel>
          <Select
            id="attendance-department"
            bg="white"
            value={department}
            isDisabled={saving}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="">Tous les départements</option>
            {department && !departments.includes(department) && (
              <option value={department}>{department}</option>
            )}
            {departments.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>
      {!date && <Text>Choisissez une date pour afficher la semaine.</Text>}
      {isFetching && <Text role="status">Chargement du rapport…</Text>}
      {isError && (
        <Text role="alert" color="red.600">
          Impossible de charger le rapport. Veuillez réessayer.
        </Text>
      )}
      {date && report && !isFetching && !isError && (
        <>
          <Text mb={3} fontWeight="semibold">
            Du {formatAttendanceReportDate(report.dates[0])} au{" "}
            {formatAttendanceReportDate(report.dates[4])} · {employees.length}{" "}
            employés
          </Text>
          <TableContainer
            w="100%"
            whiteSpace="normal"
            bg="white"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.200"
          >
            <Table
              size="sm"
              w="100%"
              sx={{
                tableLayout: "fixed",
                "th, td": { px: { base: 1, lg: 2 }, overflowWrap: "anywhere" },
                th: { letterSpacing: "normal" },
              }}
            >
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "15%" }} />
                {report.dates.map((day) => (
                  <col key={day} style={{ width: "11%" }} />
                ))}
              </colgroup>
              <Thead bg="gray.50">
                <Tr>
                  <Th>Employé</Th>
                  <Th>Matricule</Th>
                  <Th>Département</Th>
                  {report.dates.map((day) => (
                    <Th key={day}>
                      {new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", {
                        weekday: "short",
                      })}
                      <Text as="span" display="block">
                        {formatAttendanceReportDate(day)}
                      </Text>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {employees.map((employee) => (
                  <Tr key={employee.employeeId}>
                    <Td py={4}>
                      {employee.firstName} {employee.lastName}
                    </Td>
                    <Td>{employee.matricule}</Td>
                    <Td>{employee.department}</Td>
                    {employee.days.map((value, index) => (
                      <Td
                        key={index}
                        color={
                          value === "Absent"
                            ? "red.600"
                            : value === "Congé"
                            ? "blue.600"
                            : "gray.700"
                        }
                      >
                        {value}
                      </Td>
                    ))}
                  </Tr>
                ))}
                {!employees.length && (
                  <Tr>
                    <Td colSpan={8} py={8} textAlign="center">
                      Aucun employé pour cette sélection.
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
