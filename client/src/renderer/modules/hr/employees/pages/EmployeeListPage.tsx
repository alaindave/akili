import PageSubtitle from "../../../../components/common/PageSubtitle";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  List,
  ListItem,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaAddressBook } from "react-icons/fa6";
import { FaSyncAlt } from "react-icons/fa";

import useAdminUser from "../../../../../store/auth.store";
import AddEmployee from "../components/EmployeeAdd";
import EmployeeCard from "../components/EmployeeCard";
import DeferredEmployeeCard from "../components/DeferredEmployeeCard";
import { useAttendanceByDate } from "../../attendance/hooks/useAttendance";
import EmployeeFilterMenu from "../components/EmployeeFilterMenu";
import { useEmployees } from "../hooks/useEmployees";

import NotAuthorized from "../../../../components/common/NotAuthorized";
import SearchBar from "../../../../components/common/SearchBar";
import useSyncStore from "../../../../../store/sync.store";

const EmployeeListPage = () => {
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("");

  const user = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  const {
    data: employees = [],
    isLoading,
    isFetching,
    refetch,
  } = useEmployees();

  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const {
    data: attendance = [],
    isLoading: loadingAttendance,
    refetch: refetchAttendance,
  } = useAttendanceByDate(user.companyId, today);
  const attendanceByEmployee = useMemo(
    () => new Map(attendance.map((record) => [record.employeeId, record])),
    [attendance]
  );
  const previousSync = useRef(syncVersion);
  useEffect(() => {
    if (previousSync.current === syncVersion) return;
    previousSync.current = syncVersion;
    void refetch();
    void refetchAttendance();
  }, [syncVersion, refetch, refetchAttendance]);

  const loading = isLoading || isFetching;

  const filteredEmployees = employees
    .filter((employee) => !filter || employee.department === filter)
    .filter((employee) =>
      `${employee.firstName} ${employee.lastName}`
        .toLowerCase()
        .includes(searchText.toLowerCase())
    );

  const horizontalPadding = {
    base: "12px",
    sm: "16px",
    md: "20px",
    lg: "24px",
    xl: "28px",
  };

  return (
    <Flex
      direction="column"
      width="100%"
      height="100%"
      minHeight={0}
      bg="#F8FAFC"
      overflow="hidden"
    >
      {/* HEADER */}
      <Box
        width="100%"
        flexShrink={0}
        bg="#F8F9FB"
        pt={{ base: "12px", md: "14px", lg: "16px" }}
        pb={{ base: "14px", md: "16px" }}
      >
        <Box width="100%" px={horizontalPadding}>
          {/* TITLE AND ADD EMPLOYEE BUTTON */}
          <Flex
            width="100%"
            align="start"
            justify="space-between"
            gap={{ base: "12px", md: "20px" }}
          >
            {/* LEFT COLUMN */}
            <Box flex="1" minWidth={0}>
              <HStack mt="0.3rem" spacing="4px" align="center">
                <Heading size="md" color="#03143B">
                  Employés
                </Heading>

                <Button
                  variant="ghost"
                  size="md"
                  minWidth="32px"
                  height="32px"
                  p="0"
                  isLoading={loading}
                  color="gray.600"
                  _hover={{ bg: "gray.200" }}
                  _active={{ bg: "gray.300" }}
                  onClick={() => {
                    void refetch();
                    void refetchAttendance();
                  }}
                  aria-label="Actualiser les employés"
                >
                  <FaSyncAlt />
                </Button>
              </HStack>

              <PageSubtitle noOfLines={1}>
                Gérez les informations de vos employés
              </PageSubtitle>
            </Box>

            {/* RIGHT COLUMN: ADD EMPLOYEE */}
            <Box
              flex="0 0 auto"
              display="flex"
              justifyContent="flex-end"
              alignItems="flex-start"
            >
              {user?.role === "MANAGER" || user?.role === "ADMIN" ? (
                <AddEmployee />
              ) : (
                <NotAuthorized
                  buttonText="Ajouter un employé"
                  icon={FaAddressBook}
                  placement="left"
                  width="13rem"
                  color="#4F46E5"
                />
              )}
            </Box>
          </Flex>

          {/* FILTER AND SEARCH: SAME ROW AND MATCHING COLUMN EDGES */}
          <Flex
            width="100%"
            mt="3rem"
            align="center"
            justify="space-between"
            gap={{ base: "12px", md: "20px" }}
          >
            {/* FILTER: LEFT EDGE MATCHES TITLE */}
            <Box
              flex="1"
              minWidth={0}
              display="flex"
              justifyContent="flex-start"
              alignItems="center"
            >
              <EmployeeFilterMenu onFilterClicked={setFilter} />
            </Box>

            {/* SEARCH: RIGHT EDGE MATCHES ADD EMPLOYEE BUTTON */}
            <Box
              flex="0 1 32rem"
              width="32rem"
              maxWidth="50%"
              minWidth={0}
              display="flex"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Box width="100%" minWidth={0}>
                <SearchBar
                  placeholderText="Rechercher un employé"
                  onSearch={setSearchText}
                />
              </Box>
            </Box>
          </Flex>
        </Box>
      </Box>

      {/* EMPLOYEE LIST */}
      <Box
        flex="1"
        minHeight={0}
        width="100%"
        overflowY="auto"
        overflowX="hidden"
        px={horizontalPadding}
        py={{ base: "8px", md: "10px", lg: "12px" }}
        sx={{
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E1",
            borderRadius: "10px",
          },
          scrollPaddingBottom: "40px",
        }}
      >
        <Box width="100%" minWidth={0} minHeight="max-content" pb="40px">
          {isLoading ? (
            <VStack width="100%" spacing="8px" align="stretch">
              {[...Array(6)].map((_, index) => (
                <Flex
                  key={index}
                  width="100%"
                  minHeight={{ base: "90px", md: "100px" }}
                  bg="#FFFFFF"
                  border="1px solid #E2E8F0"
                  borderRadius="8px"
                  p={{ base: "12px", md: "16px" }}
                  align="center"
                  gap={{ base: "12px", md: "16px" }}
                  boxShadow="0 2px 8px rgba(15,23,42,.04)"
                >
                  <SkeletonCircle size={{ base: "10", md: "12" }} />

                  <Box flex="1" minWidth={0}>
                    <Skeleton
                      height="16px"
                      width={{
                        base: "75%",
                        sm: "60%",
                        md: "45%",
                      }}
                      mb="10px"
                      borderRadius="6px"
                      startColor="#132C68"
                      endColor="#1E3A7A"
                    />

                    <SkeletonText
                      noOfLines={2}
                      spacing="3"
                      skeletonHeight="10px"
                      startColor="#132C68"
                      endColor="#1E3A7A"
                    />
                  </Box>
                </Flex>
              ))}
            </VStack>
          ) : (
            <List
              width="100%"
              display="flex"
              flexDirection="column"
              gap={{ base: "2px", md: "3px" }}
              m="0"
              p="0"
              listStyleType="none"
              flexShrink={0}
              mt="0.3rem"
            >
              {filteredEmployees.map((employee) => (
                <ListItem
                  key={employee._id}
                  width="100%"
                  flexShrink={0}
                  bg="#FFFFFF"
                  border="1px solid #E2E8F0"
                  borderRadius="8px"
                  boxShadow="0 2px 10px rgba(15,23,42,.06)"
                  overflow="hidden"
                  transition="box-shadow 0.15s ease"
                  _hover={{
                    boxShadow: "0 4px 14px rgba(15,23,42,.09)",
                  }}
                  m="0"
                >
                  <DeferredEmployeeCard>
                    <EmployeeCard
                      employee={employee}
                      attendance={
                        attendanceByEmployee.get(employee._id) ?? null
                      }
                      loadingAttendance={loadingAttendance}
                      refetchAttendance={refetchAttendance}
                      formattedDate={today}
                    />
                  </DeferredEmployeeCard>
                </ListItem>
              ))}

              {filteredEmployees.length === 0 && (
                <Flex
                  mt="4rem"
                  width="100%"
                  minHeight={{ base: "180px", md: "220px" }}
                  align="center"
                  justify="center"
                  bg="#FFFFFF"
                  border="1px solid #A0AEC0"
                  borderRadius="8px"
                  px="20px"
                  flexShrink={0}
                >
                  <VStack spacing="6px">
                    <Text
                      fontSize={{ base: "1rem", md: "1.1rem" }}
                      fontWeight="600"
                      color="gray.700"
                      textAlign="center"
                    >
                      Aucun employé trouvé
                    </Text>

                    <Text
                      fontSize={{ base: "0.85rem", md: "0.9rem" }}
                      color="gray.500"
                      textAlign="center"
                    >
                      Essayez de modifier votre recherche ou votre filtre.
                    </Text>
                  </VStack>
                </Flex>
              )}
            </List>
          )}
        </Box>
      </Box>
    </Flex>
  );
};

export default EmployeeListPage;
