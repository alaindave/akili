import { Link, useLocation } from "react-router-dom";
import {
  Box,
  Flex,
  HStack,
  Text,
  VStack,
  Image,
  Spacer,
} from "@chakra-ui/react";
import type Employee from "../../../../../common/types/Employee";
import { FaArrowLeftLong } from "react-icons/fa6";
import { MdOutlineChevronRight } from "react-icons/md";
import { Attendance } from "../../../../../common/types/Attendance";
import { GoDotFill } from "react-icons/go";
import defaultAvatar from "../assets/default-avatar.jpeg";
import AttendanceTable from "../../attendance/components/AttendanceRecordTable";
import { useEffect, useState } from "react";
import useAdminUser from "../../../../../store/auth.store";

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
    <Flex bg="#ffffff" width="100%" direction="column" alignItems="flex-start">
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

      <Box ml="10rem" mt="5rem">
        <AttendanceTable records={attendances} />
      </Box>
    </Flex>
  );
};

export default EmployeeAttendanceReport;
