import { Box, Flex, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CiCalendarDate } from "react-icons/ci";
import { FaDollarSign, FaRegClock } from "react-icons/fa";
import { GoDotFill } from "react-icons/go";
import { Link, useLocation, useParams } from "react-router-dom";
import { Attendance } from "../../../../../common/types/Attendance";
import type Employee from "../../../../../common/types/Employee";
import useAdminUser from "../../../../../store/auth.store";
import ComponentErrorFallback from "../../../../components/ComponentErrorFallback";
import EmployeeDetailsTab from "./EmployeeDetailsTab";
import EmployeePhotoUpload from "./EmployeePhotoUpload";

type PhotoState = {
  photo_url?: string;
};

const EmployeeDetailsPage = () => {
  const [employee, setEmployee] = useState<Employee | null>({} as Employee);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const { _id } = useParams();
  const location = useLocation();
  const { photo_url } = (location.state as PhotoState) || "";
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    if (!_id) return;
    window.electron.employees
      .getById(user.companyId, _id)
      .then((employee) => {
        setEmployee(employee);
        console.log("EMPLOYEE FETCHED: ", employee);
        return window.electron.attendance.getAttendanceRecord(
          user.companyId,
          employee._id,
          new Date().toISOString().split("T")[0]
        );
      })
      .then((attendance) => {
        setAttendance(attendance);
        console.log("ATTENDANCE FETCHED: ", attendance);
      })
      .catch((error) => {
        console.error("ERROR FETCHING DATA:", error);
      });
  }, [_id]);

  const refreshEmployee = async () => {
    try {
      if (!employee?._id) return;
      const updatedEmployee = await window.electron.employees.getById(
        user.companyId,
        employee?._id
      );
      setEmployee(updatedEmployee);
      console.log("FETCHED UPDATED EMPLOYEE:", updatedEmployee);
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE FETCHING EMPLOYEE", error);
    }
  };

  if (!employee) return;
  return (
    <Box
      position="relative"
      bg="#F8F9FB"
      w="100%"
      maxW="1400px"
      mx="auto"
      ml="0.01rem"
      height="94vh"
    >
      <VStack spacing={4} align="stretch">
        {/* HEADER */}
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "flex-start", md: "center" }}
        >
          <HStack>
            <HStack ml="0.3rem" mt="0.5rem">
              {/* Profile photo */}
              <EmployeePhotoUpload
                employeeId={_id!}
                currentPhoto={photo_url}
                onUploaded={refreshEmployee}
              />
              {/* Name and role */}
              <VStack spacing={3}>
                <Text
                  fontSize="1.2rem"
                  fontWeight="700"
                  color="gray.700"
                  textAlign="center"
                >
                  {employee?.firstName} {employee?.lastName}
                </Text>
                <HStack position="relative" bottom="1rem">
                  <Text>{employee?.role}</Text>
                  <Box>
                    {" "}
                    <GoDotFill />
                  </Box>
                  <Text>{employee?.department}</Text>
                </HStack>
              </VStack>
            </HStack>
          </HStack>
          {/* ATTENDANCE,LEAVES,PAYSLIPS */}
          <HStack mr="1rem" mb="1rem">
            <Link
              to={{
                pathname: `/employees_admin/employees_list/${_id}/attendances`,
              }}
              state={{ employee, photo_url, attendance }}
            >
              <HStack
                cursor="pointer"
                bg="gray.100"
                border="1px solid rgba(255,255,255,0.12)"
                boxShadow="0 2px 8px rgba(0,0,0,0.5)"
                borderRadius="0.4rem"
                padding="0.4rem"
              >
                <FaRegClock size="1.2rem" color="blue" />
                <Text color="gray.900">Présence</Text>
              </HStack>
            </Link>
            <Link
              to={{
                pathname: `/employees_admin/employees_list/${_id}/leaves`,
              }}
              state={{ employee, photo_url }}
            >
              <HStack
                cursor="pointer"
                bg="gray.100"
                border="1px solid rgba(255,255,255,0.12)"
                boxShadow="0 2px 8px rgba(0,0,0,0.5)"
                borderRadius="0.4rem"
                padding="0.4rem"
              >
                <CiCalendarDate size="1.2rem" color="blue" />
                <Text>Congés</Text>
              </HStack>
            </Link>
            <Link
              to={{
                pathname: `/employees_admin/employees_list/${_id}/payslips`,
              }}
              state={{ employee, photo_url }}
            >
              <HStack
                cursor="pointer"
                bg="gray.100"
                border="1px solid rgba(255,255,255,0.12)"
                boxShadow="0 2px 8px rgba(0,0,0,0.5)"
                borderRadius="0.4rem"
                padding="0.4rem"
              >
                <FaDollarSign size="1.1rem" color="blue" />
                <Text>Fiche de paye</Text>
              </HStack>
            </Link>
          </HStack>
        </Flex>

        {/* MAIN CONTENT */}
        <Stack direction={{ base: "column", lg: "row" }} spacing={4}>
          {/* RIGHT PANEL */}
          <Box
            border="1px solid rgba(255,255,255,0.12)"
            boxShadow="0 2px 8px rgba(0,0,0,0.5)"
            borderRadius="0.4rem"
            overflowY="auto"
            height="70.6vh"
            ml="15rem"
          >
            <ErrorBoundary FallbackComponent={ComponentErrorFallback}>
              <EmployeeDetailsTab employee={employee} />
            </ErrorBoundary>
          </Box>
        </Stack>
      </VStack>
    </Box>
  );
};

export default EmployeeDetailsPage;
