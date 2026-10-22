import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { MdOutlineChevronRight } from "react-icons/md";
import { Link, useLocation } from "react-router-dom";
import { Attendance } from "../../../../../common/types/hr/attendance/Attendance";
import type Employee from "../../../../../common/types/hr/employees/Employee";
import useAdminUser from "../../../../../store/auth.store";
import AttendanceTable from "../components/AttendanceRecordTable";
import DateRangePicker, {
  DateRange,
} from "../../../../components/common/DatePicker";
import AttendanceStatusFilter from "../components/AttendanceStatusFilter";

type EmployeeState = {
  employee?: Employee;
};

type PhotoState = {
  photo_url?: string;
};

const EmployeeAttendanceReport = () => {
  const location = useLocation();
  const { employee } = (location.state as EmployeeState) || {};
  const { photo_url } = (location.state as PhotoState) || "";
  const [statusFilter, setStatusFilter] = useState("");
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const user = useAdminUser((store) => store.adminUser);
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    getAttendanceHistory();
  }, [dateRange, statusFilter]);

  const getAttendanceHistory = async () => {
    if (!employee?._id) return;
    const attendances: Attendance[] =
      await window.electron.hr.attendance.getByEmployee(
        user.companyId,
        employee?._id
      );
    const filteredAttendances: Attendance[] = attendances
      .filter(
        (a) =>
          (!dateRange.startDate && !dateRange.endDate) ||
          (a.date >= dateRange.startDate! && a.date <= dateRange.endDate!)
      )
      .filter((a) => !statusFilter || a.status === statusFilter);
    setAttendances(filteredAttendances);
  };

  return (
    <Flex
      bg="#F8FAFC"
      width="100%"
      height="100%"
      minH={0}
      minW={0}
      overflow="hidden"
      px={{ base: 3, md: 6, lg: 8 }}
      pb={{ base: "calc(46px + 0.3rem)", md: "calc(52px + 0.3rem)" }}
      direction="column"
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
        <HStack
          mt={{ base: 2, md: 6 }}
          mb={{ base: 2, md: 4 }}
          spacing={{ base: 2, md: 4 }}
        >
          <Link
            to={{
              pathname: `/hr/employees_list/${employee?._id}`,
            }}
            state={{ photo_url }}
          >
            <Box p={2} border="1px solid #14376b" borderRadius="10px">
              <FaArrowLeftLong color="black" />
            </Box>
          </Link>
          <Box minW={0}>
            <HStack spacing={{ base: 1, md: 2 }} flexWrap="wrap">
              <Text
                fontWeight="600"
                fontSize={{ base: "0.85rem", md: "1.1rem" }}
              >
                Employés
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.1rem" />
              </Box>
              <Text
                fontWeight="500"
                fontSize={{ base: "0.85rem", md: "1.03rem" }}
                overflowWrap="anywhere"
              >
                {" "}
                {employee?.firstName} {employee?.lastName}
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.1rem" />
              </Box>
              <Text fontWeight="500" fontSize={{ base: "0.85rem", md: "1rem" }}>
                Présence
              </Text>
            </HStack>
          </Box>
        </HStack>
        {attendances.length > 0 ? (
          <Box width="100%">
            <Box
              mt={{ base: "2rem", md: "2rem", lg: "5rem" }}
              mx="auto"
              width="100%"
            >
              <AttendanceTable records={attendances} />
            </Box>
          </Box>
        ) : (
          <Flex
            mx="auto"
            mt={{ base: "0.3rem", md: "2rem" }}
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
              Pas d'historique de présence retrouvé
            </Text>
          </Flex>
        )}
      </Box>
      <Flex
        width="100%"
        maxW="1200px"
        flexShrink={0}
        mt={{ base: 2, md: 6 }}
        gap={{ base: 2, md: 8 }}
        align="center"
        wrap="nowrap"
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
          <AttendanceStatusFilter onFilterClicked={setStatusFilter} />
        </Box>
      </Flex>
    </Flex>
  );
};

export default EmployeeAttendanceReport;
