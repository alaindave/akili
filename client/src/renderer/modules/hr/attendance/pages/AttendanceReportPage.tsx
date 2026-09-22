import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { MdOutlineChevronRight } from "react-icons/md";
import { Link, useLocation } from "react-router-dom";
import { Attendance } from "../../../../../common/types/attendance/Attendance";
import type Employee from "../../../../../common/types/Employee";
import useAdminUser from "../../../../../store/auth.store";
import AttendanceTable from "../components/AttendanceRecordTable";
import DateRangePicker, { DateRange } from "../../../../components/DatePicker";
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
      height="93vh"
      direction="column"
      alignItems="flex-start"
      justify="space-between"
    >
      {/* Header */}
      <Box>
        <HStack mt="1.5rem">
          <Link
            to={{
              pathname: `/employees_admin/employees_list/${employee?._id}`,
            }}
            state={{ photo_url }}
          >
            <Box
              ml="1rem"
              mb="2rem"
              p={2}
              border="1px solid #14376b"
              borderRadius="10px"
            >
              <FaArrowLeftLong color="black" />
            </Box>
          </Link>
          <Box mt="0.3rem">
            <HStack ml="1rem" position="relative" bottom="1rem">
              <Text fontWeight="600" fontSize="1.1rem">
                Employés
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.1rem" />
              </Box>
              <Text fontWeight="500" fontSize="1.03rem">
                {" "}
                {employee?.firstName} {employee?.lastName}
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.1rem" />
              </Box>
              <Text fontWeight="500" fontSize="1rem">
                Présence
              </Text>
            </HStack>
          </Box>
        </HStack>
        {attendances.length !== 0 ? (
          <Box>
            <Box mt="3rem" ml="4rem">
              <AttendanceTable records={attendances} />
            </Box>
          </Box>
        ) : (
          <Flex
            ml="1rem"
            mt="10rem"
            width="80vw"
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
      <Flex ml="6rem" mb="0.3rem">
        <Box>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Box>
        <Box ml="3.5rem">
          <AttendanceStatusFilter onFilterClicked={setStatusFilter} />
        </Box>
      </Flex>
    </Flex>
  );
};

export default EmployeeAttendanceReport;
