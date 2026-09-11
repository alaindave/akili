import {
  Box,
  Flex,
  HStack,
  Text
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { MdOutlineChevronRight } from "react-icons/md";
import { Link, useLocation } from "react-router-dom";
import { Attendance } from "../../../../../common/types/Attendance";
import type Employee from "../../../../../common/types/Employee";
import useAdminUser from "../../../../../store/auth.store";
import AttendanceTable from "../../attendance/components/AttendanceRecordTable";

type EmployeeState = {
  employee?: Employee;
};

type PhotoState = {
  photo_url?: string;
};

type AttendanceState = {
  attendance?: Attendance;
};

const EmployeeAttendanceReport = () => {
  const location = useLocation();
  const { employee } = (location.state as EmployeeState) || {};
  const { photo_url } = (location.state as PhotoState) || "";
  const { attendance } = (location.state as AttendanceState) || {};
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const user = useAdminUser((store) => store.adminUser);

  const statusColor = {
    PONCTUEL: "green",
    RETARD: "orange",
    ABSENT: "red",
    CONGÉ: "blue",
  } as const;

  useEffect(() => {
    async function getAttendanceHistory() {
      if (!employee?._id) return;
      const attendances = await window.electron.attendance.getByEmployee(
        user.companyId,
        employee?._id
      );
      setAttendances(attendances);
    }
    getAttendanceHistory();
  }, []);

  return (
    <Flex
      bg="#F8FAFC"
      width="100%"
      height="100%"
      direction="column"
      alignItems="flex-start"
    >
      {/* Header */}
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
            <Text>Employés</Text>
            <Box>
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>
            <Text>
              {" "}
              {employee?.firstName} {employee?.lastName}
            </Text>
            <Box>
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>
            <Text>Présence</Text>
          </HStack>
        </Box>
      </HStack>
      {/* Employee bio */}

      {attendances.length !== 0 ? (
        <Box ml="10rem" mt="5rem">
          <AttendanceTable records={attendances} />
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
    </Flex>
  );
};

export default EmployeeAttendanceReport;
