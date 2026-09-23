import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa6";
import { FiTrash2 } from "react-icons/fi";
import { MdOutlineDirectionsBus } from "react-icons/md";

import {
  TransportAllowanceWeeklyReport,
  TransportAllowanceEmployee,
  TransportAllowanceDay,
} from "../../../../../common/types/TransportAllowance";

interface LocationState {
  report?: TransportAllowanceWeeklyReport;
}

const BLUE = "#03143B";
const GOLD = "#F2B705";
const BG = "#F5F6F8";
const BORDER = "#E2E5E9";

const GRID_COLUMNS = "1fr repeat(9, 1fr) 64px";

export default function TransportAllowanceWeeklyReportPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as LocationState | null;
  const report = state?.report;

  const updateReport = (nextReport: TransportAllowanceWeeklyReport) => {
    navigate(location.pathname, {
      replace: true,
      state: { ...state, report: nextReport },
    });
  };

  const removeRow = (employeeId: string) => {
    if (!report) return;
    const employees = report.employees.filter((employee) => employee.employeeId !== employeeId);
    updateReport({
      ...report,
      employees,
      totalEmployees: employees.length,
      totalAllowance: employees.reduce((total, employee) => total + employee.weeklyAllowance, 0),
    });
  };

  if (!report) {
    return (
      <Box minH="100vh" bg={BG} p={{ base: 4, md: 6 }}>
        <Box
          maxW="1400px"
          mx="auto"
          bg="white"
          border="1px solid"
          borderColor={BORDER}
          borderRadius="12px"
          p={8}
          textAlign="center"
        >
          <VStack spacing={4}>
            <Box
              w="56px"
              h="56px"
              borderRadius="full"
              bg="gray.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <MdOutlineDirectionsBus size={28} color={BLUE} />
            </Box>

            <Text fontSize="20px" fontWeight="700" color={BLUE}>
              Rapport introuvable
            </Text>

            <Text fontSize="14px" color="gray.600">
              Le rapport hebdomadaire n'a pas été transmis à cette page.
              Veuillez générer le rapport à nouveau.
            </Text>

            <Button
              leftIcon={<FaArrowLeft />}
              bg={BLUE}
              color="white"
              _hover={{ bg: "#081d4f" }}
              onClick={() =>
                navigate("/employees_admin/reports/transport_allowance")
              }
            >
              Retour
            </Button>
          </VStack>
        </Box>
      </Box>
    );
  }

  const formatDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatShortDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat("fr-FR").format(amount)} FBU`;
  };

  const getStatusLabel = (status: TransportAllowanceDay["status"]) => {
    switch (status) {
      case "WORKED":
        return "Présent";

      case "LATE":
        return "Retard";

      case "ABSENT":
        return "Absent";

      case "LEAVE":
        return "Congé";

      case "NO_RECORD":
        return "-";

      default:
        return status;
    }
  };

  const getStatusColor = (status: TransportAllowanceDay["status"]) => {
    switch (status) {
      case "WORKED":
        return "green";

      case "LATE":
        return "orange";

      case "ABSENT":
        return "red";

      case "LEAVE":
        return "purple";

      case "NO_RECORD":
        return "gray";

      default:
        return "gray";
    }
  };

  const getRateLabel = (rate: number) => {
    if (rate === 3300) {
      return "Normal";
    }

    if (rate === 2500) {
      return "1 retard";
    }

    return "0 FBU";
  };

  const firstEmployee = report.employees[0];

  return (
    <Flex
      direction="column"
      height="93vh"
      width="100%"
      bg={BG}
      overflow="hidden"
    >
      {/* =========================================================
          WEEK INFORMATION
      ========================================================= */}
      <Flex
        direction="column"
        bg="white"
        border="1px solid"
        borderColor={BORDER}
        overflow="hidden"
        width="80vw"
        flexShrink={0}
        mt="1.2rem"
        ml="1rem"
      >
        {/* BLUE TITLE BAR */}
        <Box height="45px" bg={BLUE} px={{ base: 5, md: 6 }} py={2}>
          <Flex
            justify="space-between"
            align={{ base: "flex-start", md: "center" }}
            direction={{ base: "column", md: "row" }}
            gap={2}
          >
            <Box>
              <HStack spacing={2}>
                <Button
                  variant="ghost"
                  color="white"
                  size="sm"
                  onClick={() =>
                    navigate("/employees_admin/reports/transport_allowance")
                  }
                  _hover={{
                    bg: "whiteAlpha.200",
                  }}
                >
                  <FaArrowLeft />
                </Button>

                <Text
                  fontSize="1.1rem"
                  color="white"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.5px"
                >
                  Frais de déplacement
                </Text>
              </HStack>
            </Box>

            <Text fontSize="20px" fontWeight="800" color="white">
              {formatDate(report.weekStart)} — {formatDate(report.weekEnd)}
            </Text>
          </Flex>
        </Box>

      </Flex>

      {/* =========================================================
          EMPLOYEE GRID AREA
      ========================================================= */}
      <Box
        ml="1rem"
        minH={0}
        flex={1}
        display="flex"
        flexDirection="column"
        px={{ base: 2, md: 0 }}
      >
        <Box
          flex={1}
          minH={0}
          overflow="auto"
          border="1px solid"
          borderColor={BORDER}
          boxShadow="sm"
          bg="#ffffff"
          maxW="1150px"
        >
          {/* =====================================================
              STICKY HEADER
          ===================================================== */}
          <Box
            position="sticky"
            top={0}
            zIndex={20}
            bg="gray.50"
            borderBottom="2px solid"
            borderColor={BORDER}
          >
            <Box
              display="grid"
              gridTemplateColumns={GRID_COLUMNS}
              alignItems="stretch"
            >
              {/* EMPLOYEE */}
              <GridHeaderCell text="Employé" align="left" />

              {/* MONDAY */}
              <GridHeaderCell
                text="L"
                subText={formatShortDate(
                  firstEmployee?.monday.date ?? report.weekStart
                )}
              />

              {/* TUESDAY */}
              <GridHeaderCell
                text="M"
                subText={formatShortDate(
                  firstEmployee?.tuesday.date ?? report.weekStart
                )}
              />

              {/* WEDNESDAY */}
              <GridHeaderCell
                text="M"
                subText={formatShortDate(
                  firstEmployee?.wednesday.date ?? report.weekStart
                )}
              />

              {/* THURSDAY */}
              <GridHeaderCell
                text="J"
                subText={formatShortDate(
                  firstEmployee?.thursday.date ?? report.weekStart
                )}
              />

              {/* FRIDAY */}
              <GridHeaderCell
                text="V"
                subText={formatShortDate(
                  firstEmployee?.friday.date ?? report.weekStart
                )}
              />

              {/* DAYS */}
              <GridHeaderCell text="Jours" />

              {/* LATE */}
              <GridHeaderCell text="Retards" />

              {/* RATE */}
              <GridHeaderCell text="Montant" />

              {/* TOTAL */}
              <GridHeaderCell text="Total" />
              <GridHeaderCell text="Action" />
            </Box>
          </Box>

          {/* =====================================================
              EMPLOYEE ROWS
          ===================================================== */}
          <Box maxW="1150px">
            {report.employees.map((employee: TransportAllowanceEmployee) => (
              <Box
                key={employee.employeeId}
                display="grid"
                gridTemplateColumns={GRID_COLUMNS}
                alignItems="stretch"
                borderBottom="1px solid"
                borderColor="gray.100"
                _hover={{
                  bg: "gray.50",
                }}
              >
                {/* EMPLOYEE */}
                <GridBodyCell align="left">
                  <Box>
                    <Text
                      fontSize="13px"
                      fontWeight="700"
                      color={BLUE}
                      noOfLines={1}
                    >
                      {employee.firstName}
                    </Text>

                    <Text
                      fontSize="13px"
                      fontWeight="700"
                      color={BLUE}
                      noOfLines={1}
                    >
                      {employee.lastName}
                    </Text>

                    {employee.department && (
                      <Text fontSize="11px" color="gray.500" noOfLines={1}>
                        {employee.department}
                      </Text>
                    )}
                  </Box>
                </GridBodyCell>

                {/* MONDAY */}
                <GridBodyCell>
                  <AttendanceCell
                    day={employee.monday}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                  />
                </GridBodyCell>

                {/* TUESDAY */}
                <GridBodyCell>
                  <AttendanceCell
                    day={employee.tuesday}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                  />
                </GridBodyCell>

                {/* WEDNESDAY */}
                <GridBodyCell>
                  <AttendanceCell
                    day={employee.wednesday}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                  />
                </GridBodyCell>

                {/* THURSDAY */}
                <GridBodyCell>
                  <AttendanceCell
                    day={employee.thursday}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                  />
                </GridBodyCell>

                {/* FRIDAY */}
                <GridBodyCell>
                  <AttendanceCell
                    day={employee.friday}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                  />
                </GridBodyCell>

                {/* WORKED DAYS */}
                <GridBodyCell>
                  <Text fontWeight="700" color="gray.700" fontSize="13px">
                    {employee.workedDays}
                  </Text>
                </GridBodyCell>

                {/* LATE DAYS */}
                <GridBodyCell>
                  <Badge
                    colorScheme={
                      employee.lateDays === 0
                        ? "green"
                        : employee.lateDays === 1
                        ? "orange"
                        : "red"
                    }
                    borderRadius="full"
                    px={2.5}
                    fontSize="11px"
                  >
                    {employee.lateDays}
                  </Badge>
                </GridBodyCell>

                {/* RATE */}
                <GridBodyCell>
                  <Box>
                    <Text
                      fontSize="12px"
                      fontWeight="700"
                      color={BLUE}
                      whiteSpace="nowrap"
                    >
                      {formatCurrency(employee.ratePerDay)}
                    </Text>

                    <Text
                      fontSize="10px"
                      color="gray.500"
                      mt={0.5}
                      whiteSpace="nowrap"
                    >
                      {getRateLabel(employee.ratePerDay)}
                    </Text>
                  </Box>
                </GridBodyCell>

                {/* TOTAL */}
                <GridBodyCell>
                  <Text
                    fontSize="13px"
                    fontWeight="800"
                    color={BLUE}
                    whiteSpace="nowrap"
                  >
                    {formatCurrency(employee.weeklyAllowance)}
                  </Text>
                </GridBodyCell>
                <GridBodyCell>
                  <IconButton
                    aria-label={`Supprimer la ligne de ${employee.firstName} ${employee.lastName}`}
                    title="Supprimer la ligne" icon={<FiTrash2 />}
                    size="sm" colorScheme="red" variant="ghost"
                    onClick={() => removeRow(employee.employeeId)}
                  />
                </GridBodyCell>
              </Box>
            ))}
          </Box>

          {/* =====================================================
              STICKY FOOTER
          ===================================================== */}
          <Box
            position="sticky"
            bottom={0}
            zIndex={20}
            bg={BLUE}
            color="white"
            borderTop="2px solid"
            borderColor={BLUE}
            boxShadow="0 -3px 10px rgba(3, 20, 59, 0.18)"
            maxW="1150px"
          >
            <Box
              display="grid"
              gridTemplateColumns={GRID_COLUMNS}
              alignItems="center"
              minH="62px"
            >
              {/* TOTAL */}
              <GridFooterCell align="left">
                <Text
                  color="white"
                  fontSize="13px"
                  fontWeight="800"
                  textTransform="uppercase"
                >
                  TOTAL
                </Text>
              </GridFooterCell>
              {/* MONDAY */}
              <GridFooterCell />
              {/* TUESDAY */}
              <GridFooterCell />
              {/* WEDNESDAY */}
              <GridFooterCell />
              {/* THURSDAY */}
              <GridFooterCell />
              {/* FRIDAY */}
              <GridFooterCell />
              <GridFooterCell />
              {/* LATE DAYS */}
              <GridFooterCell />
              {/* RATE */}
              <GridFooterCell />
              {/* TOTAL ALLOWANCE */}
              <GridFooterCell align="right">
                <Text
                  color={GOLD}
                  fontSize="15px"
                  fontWeight="900"
                  whiteSpace="nowrap"
                >
                  {formatCurrency(report.totalAllowance)}
                </Text>
              </GridFooterCell>
              <GridFooterCell />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* =========================================================
          EMPTY STATE
      ========================================================= */}
      {report.employees.length === 0 && (
        <Box
          position="absolute"
          left="50%"
          top="50%"
          transform="translate(-50%, -50%)"
          py={12}
          textAlign="center"
          zIndex={10}
          pointerEvents="none"
        >
          <Text fontWeight="700" color={BLUE}>
            Aucune ligne dans le rapport
          </Text>

          <Text fontSize="13px" color="gray.500" mt={1}>
            Revenez à la sélection de la semaine pour générer un nouveau rapport.
          </Text>
        </Box>
      )}
    </Flex>
  );
}

/* =============================================================
   GRID HEADER CELL
============================================================= */

interface GridHeaderCellProps {
  text: string;
  subText?: string;
  align?: "left" | "center" | "right";
}

function GridHeaderCell({
  text,
  subText,
  align = "center",
}: GridHeaderCellProps) {
  return (
    <Box
      minW={0}
      minH="58px"
      px={3}
      py={2}
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems={
        align === "left"
          ? "flex-start"
          : align === "right"
          ? "flex-end"
          : "center"
      }
      textAlign={align}
      borderRight="1px solid"
      borderColor="gray.200"
      _last={{
        borderRight: "none",
      }}
    >
      <Text
        color={BLUE}
        fontSize="11px"
        fontWeight="800"
        textTransform="uppercase"
        whiteSpace="nowrap"
      >
        {text}
      </Text>

      {subText && (
        <Text
          fontSize="10px"
          fontWeight="500"
          color="gray.500"
          mt={0.5}
          whiteSpace="nowrap"
        >
          {subText}
        </Text>
      )}
    </Box>
  );
}

/* =============================================================
   GRID BODY CELL
============================================================= */

interface GridBodyCellProps {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
}

function GridBodyCell({ children, align = "center" }: GridBodyCellProps) {
  return (
    <Box
      minW={0}
      minH="72px"
      px={3}
      py={3}
      display="flex"
      alignItems="center"
      justifyContent={
        align === "left"
          ? "flex-start"
          : align === "right"
          ? "flex-end"
          : "center"
      }
      textAlign={align}
      borderRight="1px solid"
      borderColor="gray.100"
      _last={{
        borderRight: "none",
      }}
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

/* =============================================================
   GRID FOOTER CELL
============================================================= */

interface GridFooterCellProps {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
}

function GridFooterCell({ children, align = "center" }: GridFooterCellProps) {
  return (
    <Box
      minW={0}
      minH="62px"
      px={3}
      py={3}
      display="flex"
      alignItems="center"
      justifyContent={
        align === "left"
          ? "flex-start"
          : align === "right"
          ? "flex-end"
          : "center"
      }
      textAlign={align}
      borderRight="1px solid"
      borderColor="whiteAlpha.200"
      _last={{
        borderRight: "none",
      }}
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

/* =============================================================
   ATTENDANCE CELL
============================================================= */

interface AttendanceCellProps {
  day: TransportAllowanceDay;
  getStatusLabel: (status: TransportAllowanceDay["status"]) => string;
  getStatusColor: (status: TransportAllowanceDay["status"]) => string;
}

function AttendanceCell({
  day,
  getStatusLabel,
  getStatusColor,
}: AttendanceCellProps) {
  return (
    <VStack spacing={1} width="100%" minW={0}>
      <Badge
        colorScheme={getStatusColor(day.status)}
        borderRadius="full"
        px={2}
        fontSize="10px"
        maxW="100%"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {getStatusLabel(day.status)}
      </Badge>

      {day.amount > 0 && (
        <Text
          fontSize="10px"
          fontWeight="600"
          color="gray.500"
          whiteSpace="nowrap"
        >
          {new Intl.NumberFormat("fr-FR").format(day.amount)}
        </Text>
      )}
    </VStack>
  );
}
