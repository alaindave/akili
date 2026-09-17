import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Spacer,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaCirclePlus } from "react-icons/fa6";
import { FaSyncAlt } from "react-icons/fa";
import EmployeeLeaveCard from "../components/LeaveCard";
import MonthDropDown from "../../../../components/MonthDropDown";
import LeaveSubmissionModal from "../components/LeaveSubmissionModal";
import DeletionDialog from "../../../../components/DeletionDialog";
import { useLeavesByMonth, useDeleteLeave } from "../hooks/useLeave";
import { useEmployees } from "../../employees/hooks/useEmployees";
import useSyncStore from "../../../../../store/sync.store";
import EmployeeFilterMenu from "../../employees/components/EmployeeFilterMenu";
import SearchBar from "../../../../components/SearchBar";
import useAdminUser from "../../../../../store/auth.store";
import type { LeaveWithEmployee } from "../../../../../common/types/leave/LeaveWithEmployee";
import LeaveStatusFilter from "../components/LeaveStatusFilter";

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -468px 0 }
  100% { background-position: 468px 0 }
}
`;

const Shimmer = ({
  width = "100%",
  height = "18px",
}: {
  width?: string;
  height?: string;
}) => (
  <Box
    borderRadius="6px"
    height={height}
    width={width}
    bg="gray.300"
    backgroundSize="400% 100%"
    animation="shimmer 1.4s ease infinite"
  />
);

const gridTemplate = `
1.8fr 1.6fr 1.6fr 1.5fr 1.5fr 1fr 1fr
`;

const EmployeeLeavePage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const {
    isOpen: isConfirmationOpen,
    onOpen: onConfirmationOpen,
    onClose: onConfirmationClose,
  } = useDisclosure();
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("");
  const user = useAdminUser((store) => store.adminUser);

  const syncVersion = useSyncStore((store) => store.syncVersion);

  const [submissionMonth, setSubmissionMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);

  /* =========================================================
     REACT QUERY
  ========================================================= */

  const {
    data: leaves = [],
    isLoading,
    isFetching,
    refetch,
  } = useLeavesByMonth(user.companyId, submissionMonth);

  const { data: employees = [] } = useEmployees();

  const deleteLeaveMutation = useDeleteLeave(user.companyId);

  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (syncVersion === undefined) return;
    refetch();
  }, [syncVersion, refetch, statusFilter]);

  /* =========================================================
     DELETE LEAVE
  ========================================================= */

  const handleLeaveDelete = async () => {
    if (!selectedLeave?._id) return;

    try {
      await deleteLeaveMutation.mutateAsync(selectedLeave._id);

      onConfirmationClose();
      setSelectedLeave(null);
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE DELETING LEAVE:", error);
    }
  };

  /* =========================================================
     DELETE CONFIRMATION
  ========================================================= */

  const handleDeleteConfirmation = (leave: any) => {
    setSelectedLeave(leave);
    onConfirmationOpen();
  };

  console.log("LEAVES ARRAY", leaves);
  /* =========================================================
     LOADING UI
  ========================================================= */

  if (isLoading) {
    return (
      <>
        <Box as="style">{shimmerKeyframes}</Box>

        <VStack>
          {/* HEADER */}
          <Box
            position="relative"
            top="0.5rem"
            ml="3px"
            bg="gray.300"
            height="200px"
            width="80vw"
            borderRadius="20px"
            p={4}
          >
            <Shimmer width="200px" height="28px" />

            <Box mt={2}>
              <Shimmer width="320px" height="16px" />
            </Box>

            <Box position="absolute" right="8px" top="8px">
              <Shimmer width="220px" height="40px" />
            </Box>
          </Box>

          {/* TABLE HEADER */}
          <Grid
            templateColumns={gridTemplate}
            bg="gray.300"
            mt="0.5rem"
            ml="0.3rem"
            mr="0.3rem"
            height="66px"
            width="80vw"
            borderRadius="12px"
            px={6}
            alignItems="center"
          >
            {[...Array(7)].map((_, i) => (
              <Shimmer key={i} width="90%" height="18px" />
            ))}
          </Grid>

          {/* ROWS */}
          <Box height="90vh" width="80vw" overflow="hidden">
            {[...Array(6)].map((_, i) => (
              <Grid
                key={i}
                templateColumns={gridTemplate}
                bg="gray.300"
                borderBottom="1px solid #1E355A"
                alignItems="center"
                px={6}
                py={4}
              >
                <Shimmer width="140px" />
                <Shimmer width="120px" />
                <Shimmer width="120px" />
                <Shimmer width="120px" />
                <Shimmer width="90px" />
                <Shimmer width="80px" />

                <HStack>
                  <Shimmer width="30px" height="30px" />
                  <Shimmer width="30px" height="30px" />
                </HStack>
              </Grid>
            ))}
          </Box>

          {/* FOOTER */}
          <Box bg="gray.300" height="80px" width="80vw" mb="1rem" />
        </VStack>
      </>
    );
  }

  return (
    <Flex
      position="relative"
      direction="column"
      bg="#F8FAFC"
      width="100%"
      height="100%"
      overflow="hidden"
    >
      {/* =====================================================
            HEADER
        ===================================================== */}
      <Flex ml="0.05rem" width="80vw">
        <Box>
          <HStack>
            <Text
              color="#03143B"
              fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
              fontWeight="700"
              ml="1rem"
              mt="1.3rem"
            >
              Congés
            </Text>

            <Button
              bg="transparent"
              isLoading={isFetching}
              color="gray.800"
              _hover={{ bg: "transparent" }}
              fontSize="1rem"
              position="relative"
              top="0.7rem"
              right="1rem"
              onClick={() => refetch()}
            >
              <FaSyncAlt />
            </Button>
          </HStack>

          <Text
            color="gray.500"
            fontWeight="500"
            fontSize="0.93rem"
            position="relative"
            left="1rem"
            bottom="0.5rem"
          >
            Gérez les demandes de congés
          </Text>
          <Box mt="2rem" ml="1rem">
            <EmployeeFilterMenu onFilterClicked={setFilter} />
          </Box>
        </Box>

        <Spacer />
        <Box mt="1.5rem">
          <Button
            position="absolute"
            right="3rem"
            colorScheme="blue"
            size="md"
            onClick={onOpen}
            _hover={{
              backgroundColor: "#4F46E5",
            }}
          >
            <Box mr="0.5rem">
              <FaCirclePlus size="1.2rem" />
            </Box>

            <Text>Soumettre une demande</Text>
          </Button>
          <Box mt="5rem">
            <SearchBar
              placeholderText="Rechercher un employé"
              onSearch={setSearchText}
            />
          </Box>
        </Box>
      </Flex>

      {/* =====================================================
            MAIN AREA
        ===================================================== */}

      {leaves.length === 0 ? (
        <Flex
          ml="1rem"
          mt="6rem"
          width="80vw"
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
              fontWeight="500"
              color="gray.500"
              textAlign="center"
            >
              Aucune demande de congé retrouvée
            </Text>
          </VStack>
        </Flex>
      ) : (
        <>
          {/* TABLE HEADER */}

          <Grid
            templateColumns={gridTemplate}
            fontWeight="600"
            bg="#F8F9FB"
            borderWidth="0.3px"
            border="1px solid #E2E8F0"
            boxShadow="0 2px 10px rgba(15,23,42,.06)"
            height="3.5rem"
            width="80vw"
            overflowY="hidden"
            overflowX="hidden"
            mt="2.1rem"
            ml="1rem"
          >
            <Text color="gray.800" fontSize="1rem" ml={8} mt={4}>
              Employé
            </Text>

            <Text color="gray.800" fontSize="1rem" mt={4}>
              Debut de congé
            </Text>

            <Text color="gray.800" fontSize="1rem" mt={4}>
              Fin de congé
            </Text>

            <Text mt={4} ml={2} color="gray.800" fontSize="1rem">
              Motif
            </Text>

            <Text color="gray.800" fontSize="1rem" mt={4}>
              Statut
            </Text>

            <Box mt="0.4rem" position="relative" right="1rem">
              <Text color="gray.800" fontSize="1rem">
                Congés
              </Text>

              <Text color="gray.800" fontSize="1rem">
                restants
              </Text>
            </Box>

            <Text color="gray.800" fontSize="1rem" mt={4}>
              Actions
            </Text>
          </Grid>

          {/* =================================================
                LEAVE ROWS
            ================================================= */}

          <Box height="57vh" overflowX="hidden" overflowY="auto">
            {leaves
              .filter((l) =>
                `${l.firstName} ${l.lastName}`
                  .toLowerCase()
                  .includes(searchText.toLowerCase())
              )
              .filter((l) => !filter || l.department === filter)
              .filter((l) => !statusFilter || l.status === statusFilter)
              .map((leave: LeaveWithEmployee) => (
                <EmployeeLeaveCard
                  key={leave._id}
                  leave={leave}
                  gridTemplate={gridTemplate}
                  onDelete={() => handleDeleteConfirmation(leave)}
                />
              ))}
          </Box>
        </>
      )}

      {/* =====================================================
            FOOTER
        ===================================================== */}

      <Flex
        position="absolute"
        bottom="2.3rem"
        height="4rem"
        width="80vw"
        justify="space-around"
      >
        <Box
          ml="1rem"
          fontSize="1.1rem"
          fontFamily="monospace"
          fontWeight="600"
        >
          <MonthDropDown onChange={(month) => setSubmissionMonth(month)} />
        </Box>
        <Box ml="2rem">
          <LeaveStatusFilter onFilterClicked={setStatusFilter} />
        </Box>
      </Flex>

      {/* =======================================================
          LEAVE SUBMISSION
      ======================================================= */}

      <LeaveSubmissionModal
        isOpen={isOpen}
        onClose={onClose}
        onRefresh={() => refetch()}
        employees={employees}
      />

      {/* =======================================================
          DELETE CONFIRMATION
      ======================================================= */}

      <DeletionDialog
        isOpen={isConfirmationOpen}
        onClose={onConfirmationClose}
        onConfirmation={handleLeaveDelete}
        header="Supprimer"
        body="Êtes vous sur de vouloir supprimer cette demande?"
      />
    </Flex>
  );
};

export default EmployeeLeavePage;
