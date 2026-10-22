import { Badge, Box, Flex, HStack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Employee from "../../../../../common/types/hr/employees/Employee";
import { MdOutlineChevronRight } from "react-icons/md";
import { FaArrowLeftLong } from "react-icons/fa6";
import useAdminUser from "../../../../../store/auth.store";
import DateRangePicker, {
  DateRange,
} from "../../../../components/common/DatePicker";
import { useTimeOffList } from "../hooks/useTimeOff";
import type { LocalTimeOff } from "../../../../../electron/database/repositories/modules/hr/timeOff.repository";
import type { PayrollTreatment } from "../../../../../common/types/hr/time-off/TimeOff";
import TimeOffStatusFilter from "../components/TimeOffStatusFilter";

const payrollTreatmentLabels: Record<PayrollTreatment, string> = {
  PAID: "Payé",
  UNPAID: "Non payé",
  PARTIALLY_PAID: "Partiellement payé",
};

const statusLabels: Record<LocalTimeOff["status"], string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
};

type EmployeeState = {
  employee?: Employee;
};

type PhotoState = {
  photo_url?: string;
};

const TimeOffEmployeeReport = () => {
  const location = useLocation();
  const { employee } = (location.state as EmployeeState) || {};
  const { photo_url } = (location.state as PhotoState) || "";
  const [statusFilter, setStatusFilter] = useState("");
  const [leaves, setLeaves] = useState<LocalTimeOff[]>([]);
  const user = useAdminUser((store) => store.adminUser);
  const { data: allTimeOff = [] } = useTimeOffList(
    user.companyId,
    employee?._id
  );

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    const filteredLeaves = allTimeOff
      .filter(
        (a) =>
          (!dateRange.startDate && !dateRange.endDate) ||
          (a.startDate >= dateRange.startDate! &&
            a.startDate <= dateRange.endDate!)
      )
      .filter((l) => !statusFilter || l.status === statusFilter);
    setLeaves(filteredLeaves);
  }, [allTimeOff, statusFilter, dateRange]);

  return (
    <Flex
      direction="column"
      bg="#F8FAFC"
      height="100%"
      minH={0}
      overflow="hidden"
      pb={{ base: "calc(46px + 0.3rem)", md: "calc(52px + 0.3rem)" }}
      width="100%"
      minW={0}
      px={{ base: 3, md: 6, lg: 8 }}
      alignItems="center"
      justify="space-between"
    >
      {/* Header */}
      <Box
        width="100%"
        maxW="1200px"
        minW={0}
        minH={0}
        flex={1}
        overflowY="auto"
      >
        <HStack mt="1.4rem">
          <Link
            to={{
              pathname: `/hr/employees_list/${employee?._id}`,
            }}
            state={{ photo_url }}
          >
            <Box
              ml="0.8rem"
              mb="2.2rem"
              p={2}
              border="1px solid #14376b"
              borderRadius="10px"
            >
              <FaArrowLeftLong color="black" />
            </Box>
          </Link>
          <Box>
            <HStack ml="0.3rem" position="relative" bottom="1rem">
              <Text fontSize="1.1rem" fontWeight="500">
                Employés
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.3rem" />
              </Box>
              <Text fontSize="1.05rem" fontWeight="500">
                {" "}
                {employee?.firstName} {employee?.lastName}
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.3rem" />
              </Box>
              <Text fontSize="1rem" fontWeight="500">
                Congés
              </Text>
            </HStack>
          </Box>
        </HStack>
        {leaves.length !== 0 ? (
          <Box
            mt="3rem"
            overflowX="auto"
            bg="white"
            borderWidth="1px"
            borderRadius="md"
            width="100%"
            mx="auto"
          >
            <Box
              as="table"
              width="100%"
              minW="640px"
              sx={{
                "th, td": { padding: { base: "12px 16px", md: "16px 24px" } },
                thead: { background: "#F8F9FB" },
                "tbody tr:not(:last-child) td": {
                  borderBottom: "1px solid",
                  borderColor: "gray.100",
                },
              }}
            >
              <Box as="thead">
                <Box as="tr">
                  <Box as="th" textAlign="left" p={2}>
                    Début de congé
                  </Box>
                  <Box as="th" textAlign="left" p={2}>
                    Fin de congé
                  </Box>
                  <Box as="th" textAlign="left" p={2}>
                    Motif
                  </Box>
                  <Box as="th" textAlign="left" p={2}>
                    Statut
                  </Box>
                  <Box as="th" textAlign="left" p={2}>
                    Paie
                  </Box>
                </Box>
              </Box>
              <Box as="tbody">
                {leaves.map((row) => (
                  <Box as="tr" key={row._id}>
                    <Box as="td" p={2}>
                      {new Date(row.startDate).toLocaleDateString("fr-FR")}
                    </Box>
                    <Box as="td" p={2}>
                      {new Date(row.endDate).toLocaleDateString("fr-FR")}
                    </Box>
                    <Box as="td" p={2}>
                      {row.motifSnapshot?.label ?? "Congé"}
                    </Box>
                    <Box as="td" p={2}>
                      <Badge
                        fontSize="0.8rem"
                        colorScheme={
                          row.status === "APPROVED"
                            ? "green"
                            : row.status === "PENDING"
                            ? "yellow"
                            : "gray"
                        }
                      >
                        {statusLabels[row.status]}
                      </Badge>
                    </Box>
                    <Box as="td" p={2}>
                      {row.motifSnapshot?.payrollTreatment
                        ? payrollTreatmentLabels[
                            row.motifSnapshot.payrollTreatment
                          ]
                        : "Payé"}
                      {row.balanceDaysDeducted
                        ? ` · ${row.balanceDaysDeducted} j.`
                        : ""}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Flex
            mx="auto"
            mt="5rem"
            width="100%"
            minHeight={{
              base: "180px",
              md: "220px",
            }}
            align="center"
            justify="center"
            bg="#ffffff"
            border="1px solid #E2E8F0"
            borderRadius="8px"
            px="20px"
            flexShrink={0}
          >
            <Text
              fontSize={{
                base: "1rem",
                md: "1.1rem",
              }}
              fontWeight="500"
              color="gray.500"
              textAlign="center"
            >
              Aucune demande de congé retrouvée
            </Text>
          </Flex>
        )}
      </Box>
      <Flex
        width="100%"
        maxW="1200px"
        flexShrink={0}
        mt={6}
        gap={{ base: 2, md: 8 }}
        wrap="nowrap"
        align="center"
      >
        <Box
          flex="2 1 0"
          minW={0}
          maxW="400px"
          sx={{
            "& > div > div": { flexWrap: "nowrap", gap: { base: 1, md: 2 } },
            ".chakra-form-control": { minWidth: 0, flex: "1 1 0" },
            ".react-datepicker-wrapper, .react-datepicker__input-container": {
              width: "100%",
              minWidth: 0,
            },
            ".date-range-picker-input": {
              width: "100%",
              minWidth: 0,
              fontSize: { base: "11px", sm: "13px", md: "16px" },
              paddingLeft: { base: "4px", md: "12px" },
              paddingRight: "20px",
            },
          }}
        >
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Box>
        <Box
          flex="1 1 0"
          minW={0}
          maxW="300px"
          sx={{
            ".chakra-menu__menu-button": {
              width: "100%",
              minWidth: 0,
              paddingX: { base: 1, md: 4 },
              fontSize: { base: "11px", sm: "13px", md: "16px" },
            },
            ".chakra-menu__menu-button p": {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }}
        >
          <TimeOffStatusFilter onFilterClicked={setStatusFilter} />
        </Box>
      </Flex>
    </Flex>
  );
};

export default TimeOffEmployeeReport;
