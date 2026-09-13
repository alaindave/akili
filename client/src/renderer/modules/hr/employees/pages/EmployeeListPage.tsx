import {
  Box,
  Button,
  Flex,
  HStack,
  List,
  ListItem,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { FaAddressBook } from "react-icons/fa6";
import { FaSyncAlt } from "react-icons/fa";

import useAdminUser from "../../../../../store/auth.store";

import AddEmployee from "../components/EmployeeAdd";
import EmployeeCard from "../components/EmployeeCard";
import EmployeeFilterMenu from "../components/EmployeeFilterMenu";
import { useEmployees } from "../hooks/useEmployees";

import NotAuthorized from "../../../../components/NotAuthorized";
import SearchBar from "../../../../components/SearchBar";

const EmployeeListPage = () => {
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("");
  const user = useAdminUser((store) => store.adminUser);
  const adminStore = useAdminUser();

  console.log("CURRENT STORE", adminStore);
  const {
    data: employees = [],
    isLoading,
    isFetching,
    refetch,
  } = useEmployees();

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
      {/* =====================================================
          HEADER
      ===================================================== */}
      <Box
        width="100%"
        flexShrink={0}
        bg="#F8F9FB"
        pt={{
          base: "12px",
          md: "14px",
          lg: "16px",
        }}
        pb={{
          base: "14px",
          md: "16px",
        }}
      >
        {/* =================================================
            SHARED HEADER CONTAINER
        ================================================= */}
        <Box width="100%" px={horizontalPadding}>
          {/* =================================================
              TITLE + FILTER
          ================================================= */}
          <Flex width="100%" align="center" justify="space-between" gap="16px">
            {/* TITLE */}
            <Box minWidth={0} flex="1">
              <Box>
                <HStack mt="0.3rem" spacing="4px" align="center">
                  <Text
                    color="gray.800"
                    fontSize={{
                      base: "1.2rem",
                      sm: "1.3rem",
                      md: "1.4rem",
                      lg: "1.45rem",
                    }}
                    fontWeight="700"
                    lineHeight="1.2"
                    noOfLines={1}
                  >
                    Employés
                  </Text>

                  <Button
                    position="relative"
                    right="0.3rem"
                    variant="ghost"
                    size="md"
                    minWidth="32px"
                    height="32px"
                    p="0"
                    isLoading={loading}
                    color="gray.600"
                    _hover={{
                      bg: "gray.200",
                    }}
                    _active={{
                      bg: "gray.300",
                    }}
                    onClick={() => refetch()}
                    aria-label="Actualiser les employés"
                  >
                    <FaSyncAlt />
                  </Button>
                </HStack>

                <Text
                  color="gray.500"
                  fontWeight="500"
                  fontSize="0.93rem"
                  lineHeight="1.3"
                  noOfLines={1}
                  pos="relative"
                  bottom="0.3rem"
                >
                  Gérez les informations de vos employés
                </Text>
              </Box>

              <Box mt="4rem" flexShrink={0}>
                <EmployeeFilterMenu onFilterClicked={setFilter} />
              </Box>
            </Box>

            {/* =================================================
                ADD EMPLOYEE + SEARCH
            ================================================= */}
            <Box>
              {/* ADD EMPLOYEE */}
              <Box flexShrink={0} display="flex" justifyContent="flex-end">
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

              {/* SEARCH */}
              <Box
                flex={{
                  base: "1",
                  md: "0 1 32rem",
                }}
                minWidth={{
                  base: 0,
                  md: "20rem",
                }}
                mt="4.5rem"
              >
                <SearchBar
                  placeholderText="Rechercher un employé"
                  onSearch={setSearchText}
                />
              </Box>
            </Box>
          </Flex>
        </Box>
      </Box>

      {/* =====================================================
          LIST AREA
      ===================================================== */}
      <Box
        flex="1"
        minH={0}
        width="100%"
        overflowY="auto"
        overflowX="hidden"
        px={horizontalPadding}
        py={{
          base: "8px",
          md: "10px",
          lg: "12px",
        }}
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
          {/* =================================================
              LOADING
          ================================================= */}
          {isLoading ? (
            <VStack width="100%" spacing="8px" align="stretch">
              {[...Array(6)].map((_, index) => (
                <Flex
                  key={index}
                  width="100%"
                  minHeight={{
                    base: "90px",
                    md: "100px",
                  }}
                  bg="#ffffff"
                  border="1px solid #E2E8F0"
                  borderRadius="8px"
                  p={{
                    base: "12px",
                    md: "16px",
                  }}
                  align="center"
                  gap={{
                    base: "12px",
                    md: "16px",
                  }}
                  boxShadow="0 2px 8px rgba(15,23,42,.04)"
                >
                  <SkeletonCircle
                    size={{
                      base: "10",
                      md: "12",
                    }}
                  />

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
              gap={{
                base: "6px",
                md: "8px",
              }}
              m="0"
              p="0"
              listStyleType="none"
              flexShrink={0}
              mt="0.2rem"
            >
              {filteredEmployees.map((employee) => (
                <ListItem
                  key={employee._id}
                  width="100%"
                  flexShrink={0}
                  bg="#ffffff"
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
                  <EmployeeCard employeeId={employee._id} />
                </ListItem>
              ))}

              {/* =================================================
                  EMPTY STATE
              ================================================= */}
              {filteredEmployees.length === 0 && (
                <Flex
                  mt="4rem"
                  width="100%"
                  minHeight={{
                    base: "180px",
                    md: "220px",
                  }}
                  align="center"
                  justify="center"
                  bg="#ffffff"
                  border="1px solid #A0AEC0"
                  borderRadius="8px"
                  px="20px"
                  flexShrink={0}
                >
                  <VStack spacing="6px">
                    <Text
                      fontSize={{
                        base: "1rem",
                        md: "1.1rem",
                      }}
                      fontWeight="600"
                      color="gray.700"
                      textAlign="center"
                    >
                      Aucun employé trouvé
                    </Text>

                    <Text
                      fontSize={{
                        base: "0.85rem",
                        md: "0.9rem",
                      }}
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
