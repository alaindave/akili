import { Box, Flex, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { ErrorBoundary } from "react-error-boundary";
import { CiCalendarDate } from "react-icons/ci";
import { FaDollarSign, FaRegClock } from "react-icons/fa";
import { GoDotFill } from "react-icons/go";
import { Link, useLocation, useParams } from "react-router-dom";
import ComponentErrorFallback from "../../../../components/ComponentErrorFallback";
import EmployeeDetailsTab from "./EmployeeDetailsTab";
import EmployeePhotoUpload from "./EmployeePhotoUpload";
import { useEmployee } from "../hooks/useEmployees";

type PhotoState = {
  photo_url?: string;
};

const EmployeeDetailsPage = () => {
  const { _id } = useParams();

  const location = useLocation();

  const { photo_url } = (location.state as PhotoState) || {};

  /*
   * ---------------------------------------------------------
   * EMPLOYEE
   * ---------------------------------------------------------
   */

  const {
    data: employee,
    isLoading: employeeLoading,
    isError: employeeError,
    error: employeeErrorObject,
    refetch: refetchEmployee,
  } = useEmployee(_id);

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (employeeLoading) {
    return (
      <Flex
        width="100%"
        height="94vh"
        align="center"
        justify="center"
        bg="#F8F9FB"
      >
        <Text color="gray.500">Chargement de l'employé...</Text>
      </Flex>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR
   * ---------------------------------------------------------
   */

  if (employeeError) {
    console.error("ERROR FETCHING EMPLOYEE:", employeeErrorObject);

    return (
      <Flex
        width="100%"
        height="94vh"
        align="center"
        justify="center"
        bg="#F8F9FB"
      >
        <Text color="red.500">Impossible de charger l'employé.</Text>
      </Flex>
    );
  }

  if (!employee) {
    return (
      <Flex
        width="100%"
        height="94vh"
        align="center"
        justify="center"
        bg="#F8F9FB"
      >
        <Text color="gray.500">Employé introuvable.</Text>
      </Flex>
    );
  }

  /*
   * ---------------------------------------------------------
   * PHOTO UPLOADED
   * ---------------------------------------------------------
   */

  const refreshEmployee = async () => {
    await refetchEmployee();
  };

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
        {/* =====================================================
            HEADER
        ====================================================== */}

        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{
            base: "flex-start",
            md: "center",
          }}
        >
          <HStack>
            <HStack ml="0.5rem" mt="0.7rem">
              {/* Profile photo */}

              <EmployeePhotoUpload
                employeeId={employee._id}
                currentPhoto={employee.photo_url ?? photo_url}
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
                  {employee.firstName} {employee.lastName}
                </Text>

                <HStack position="relative" bottom="1rem">
                  <Text>{employee.role}</Text>

                  <Box>
                    <GoDotFill />
                  </Box>

                  <Text>{employee.department}</Text>
                </HStack>
              </VStack>
            </HStack>
          </HStack>

          {/* =================================================
              ATTENDANCE / LEAVES / PAYSLIPS
          ================================================== */}

          <HStack mr="1rem" mb="1rem">
            {/* Attendance */}

            <Link
              to={{
                pathname: `/employees_admin/employees_list/${employee._id}/attendances`,
              }}
              state={{
                employee,
                photo_url: employee.photo_url ?? photo_url,
              }}
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

            {/* Leaves */}

            <Link
              to={{
                pathname: `/employees_admin/employees_list/${employee._id}/leaves`,
              }}
              state={{
                employee,
                photo_url: employee.photo_url ?? photo_url,
              }}
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

            {/* Payslips */}

            <Link
              to={{
                pathname: `/employees_admin/employees_list/${employee._id}/payslips`,
              }}
              state={{
                employee,
                photo_url: employee.photo_url ?? photo_url,
              }}
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

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <Stack
          direction={{
            base: "column",
            lg: "row",
          }}
          spacing={4}
        >
          {/* RIGHT PANEL */}

          <Box
            border="1px solid rgba(255,255,255,0.12)"
            boxShadow="0 2px 8px rgba(0,0,0,0.5)"
            borderRadius="0.4rem"
            overflowY="auto"
            height="70.6vh"
            ml="15rem"
            mt="2.5rem"
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
