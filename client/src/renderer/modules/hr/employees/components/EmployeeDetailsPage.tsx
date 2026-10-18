import { Box, Flex, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { ErrorBoundary } from "react-error-boundary";
import { GoDotFill } from "react-icons/go";
import { Link, useLocation, useParams } from "react-router-dom";
import ComponentErrorFallback from "../../../../components/common/ComponentErrorFallback";
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
      minW={0}
      h="100%"
      minH={0}
      overflow="hidden"
      px={{ base: 4, md: 6 }}
      pt={4}
      pb={{ base: "calc(46px + 1rem)", md: "calc(52px + 1rem)" }}
    >
      <VStack spacing={4} align="stretch" h="100%" minH={0}>
        {/* =====================================================
            HEADER
        ====================================================== */}

        <Flex
          flexShrink={0}
          direction={{ base: "column", xl: "row" }}
          gap={4}
          minW={0}
          justify="space-between"
          align={{
            base: "flex-start",
            md: "center",
          }}
        >
          <HStack minW={0}>
            <HStack minW={0} align="center">
              {/* Profile photo */}

              <EmployeePhotoUpload
                employeeId={employee._id}
                currentPhoto={employee.photo_url ?? photo_url}
                onUploaded={refreshEmployee}
              />

              {/* Name and role */}

              <VStack spacing={2} minW={0}>
                <Text
                  fontSize="1.2rem"
                  fontWeight="700"
                  color="gray.700"
                  textAlign="center"
                  overflowWrap="anywhere"
                >
                  {employee.firstName} {employee.lastName}
                </Text>

                <HStack flexWrap="wrap" justify="center" spacing={2}>
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

          <HStack flexWrap="wrap" gap={2} spacing={0} minW={0}>
            {/* Attendance */}

            <Link
              to={{
                pathname: `/hr/employees_list/${employee._id}/attendances`,
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
                <Box
                  borderRadius="0.25rem"
                  borderWidth="0.1rem"
                  borderColor="blue"
                  h="0.5rem"
                  w="0.5rem"
                  bg="#ffffff"
                />

                <Text color="gray.900">Présence</Text>
              </HStack>
            </Link>

            {/* Leaves */}

            <Link
              to={{
                pathname: `/hr/employees_list/${employee._id}/leaves`,
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
                <Box
                  borderRadius="0.25rem"
                  borderWidth="0.1rem"
                  borderColor="blue"
                  h="0.5rem"
                  w="0.5rem"
                  bg="#ffffff"
                />{" "}
                <Text>Congés</Text>
              </HStack>
            </Link>

            {/* Payslips */}

            <Link
              to={{
                pathname: `/hr/employees_list/${employee._id}/payslips`,
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
                <Box
                  borderRadius="0.25rem"
                  borderWidth="0.1rem"
                  borderColor="blue"
                  h="0.5rem"
                  w="0.5rem"
                  bg="#ffffff"
                />
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
          flex="1"
          minH={0}
          minW={0}
          w="100%"
          pt={{ base: 2, md: 6, xl: 14 }}
        >
          {/* RIGHT PANEL */}

          <Box
            border="1px solid rgba(255,255,255,0.12)"
            boxShadow="0 2px 8px rgba(0,0,0,0.5)"
            borderRadius="0.4rem"
            overflow="hidden"
            flex="1"
            minH={0}
            w="100%"
            minW={0}
            mx="auto"
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
