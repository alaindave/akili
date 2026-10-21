import PageSubtitle from "../../../../components/common/PageSubtitle";
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaCirclePlus } from "react-icons/fa6";
import { FaSyncAlt } from "react-icons/fa";
import EmployeeLeaveCard from "../components/LeaveCard";
import MonthDropDown from "../../../../components/common/MonthDropDown";
import LeaveSubmissionModal from "../components/LeaveSubmissionModal";
import { useLeavesByMonth, useDeleteLeave } from "../hooks/useLeave";
import { useEmployees } from "../../employees/hooks/useEmployees";
import useSyncStore from "../../../../../store/sync.store";
import EmployeeFilterMenu from "../../employees/components/EmployeeFilterMenu";
import SearchBar from "../../../../components/common/SearchBar";
import useAdminUser from "../../../../../store/auth.store";
import LeaveStatusFilter from "../components/LeaveStatusFilter";
import DeletionDialog from "../../../../components/common/DeletionDialog";
import { TimeOffWithEmployee } from "../../../../../common/types/hr/time-off/TimeOff";

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

const headerTextSx = {
  whiteSpace: "pre-line",
  overflowWrap: "anywhere",
  wordBreak: "normal",
  lineHeight: "1.15",
  height: "2.3em",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
} as const;

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

  const [selectedLeave, setSelectedLeave] =
    useState<TimeOffWithEmployee | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const {
    data: leaves = [],
    isLoading,
    isFetching,
    refetch,
  } = useLeavesByMonth(user.companyId, submissionMonth);

  const { data: employees = [] } = useEmployees();
  const deleteLeaveMutation = useDeleteLeave(user.companyId);

  useEffect(() => {
    if (syncVersion === undefined) return;
    refetch();
  }, [syncVersion, refetch, statusFilter]);

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

  const handleDeleteConfirmation = (leave: TimeOffWithEmployee) => {
    setSelectedLeave(leave);
    onConfirmationOpen();
  };

  const filteredLeaves = leaves
    .filter((leave) =>
      `${leave.firstName} ${leave.lastName}`
        .toLowerCase()
        .includes(searchText.toLowerCase())
    )
    .filter((leave) => !filter || leave.department === filter)
    .filter((leave) => !statusFilter || leave.status === statusFilter);

  return (
    <Flex
      direction="column"
      bg="#F8FAFC"
      w="100%"
      h="100%"
      minW={0}
      minH={0}
      overflow="hidden"
      p="1rem"
      pb={{ base: "calc(46px + 1rem)", md: "calc(52px + 1rem)" }}
    >
      {/* PAGE HEADER AND FILTERS */}
      <Grid
        templateColumns="repeat(2, minmax(0, 1fr))"
        templateAreas={'"heading submit" "department search"'}
        columnGap={{ base: 2, md: 3 }}
        rowGap={3}
        alignItems="start"
        mb={4}
        flexShrink={0}
        w="100%"
        minW={0}
      >
        <Box gridArea="heading" minW={0}>
          <HStack spacing={1}>
            <Text
              color="#03143B"
              fontSize={{ base: "1.1rem", md: "1.4rem" }}
              fontWeight="700"
            >
              Congés
            </Text>

            <Button
              aria-label="Actualiser les congés"
              variant="ghost"
              size="sm"
              minW={6}
              px={1}
              isLoading={isFetching}
              onClick={() => refetch()}
            >
              <FaSyncAlt />
            </Button>
          </HStack>

          <PageSubtitle fontSize={{ base: "0.75rem", md: "1rem" }}>
            Gérez les demandes de congés
          </PageSubtitle>
        </Box>

        {/* Submit button: aligned to the right edge of the search bar */}
        <Box
          gridArea="submit"
          justifySelf="stretch"
          minW={0}
          display="flex"
          justifyContent="flex-end"
        >
          <Button
            w="100%"
            maxW="22rem"
            minW={0}
            colorScheme="yellow"
            onClick={onOpen}
            leftIcon={<FaCirclePlus />}
            minH={{ base: "36px", md: "40px" }}
            h="auto"
            py={2}
            px={{ base: 2, md: 3 }}
            fontSize={{ base: "0.75rem", md: "0.875rem" }}
            whiteSpace="normal"
          >
            Soumettre une demande
          </Button>
        </Box>

        {/* Department filter: left aligned */}
        <Box
          gridArea="department"
          mt="1.5rem"
          minW={0}
          maxW="22rem"
          w="100%"
          sx={{
            ".chakra-menu__menu-button": {
              width: "100%",
              minWidth: 0,
              height: { base: "36px", md: "40px" },
              paddingInline: { base: 2, md: 4 },
              fontSize: { base: "0.75rem", md: "0.875rem" },
            },
            ".chakra-menu__menu-button p": {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            ".chakra-menu__menu-list": {
              marginLeft: 0,
              left: "auto",
              bottom: "auto",
              maxWidth: "calc(100vw - 2rem)",
            },
          }}
        >
          <EmployeeFilterMenu onFilterClicked={setFilter} />
        </Box>

        {/* Search bar: same right edge and maximum width as submit button */}
        <Box
          gridArea="search"
          mt="1.5rem"
          justifySelf="stretch"
          minW={0}
          w="100%"
          display="flex"
          justifyContent="flex-end"
          sx={{
            input: {
              minWidth: 0,
              height: { base: "36px", md: "40px" },
              fontSize: { base: "0.75rem", md: "0.875rem" },
              paddingLeft: { base: "2rem", md: "2.5rem" },
            },
            "input::placeholder": {
              fontSize: { base: "0.7rem", md: "0.85rem" },
            },
            ".chakra-input__left-element": {
              height: { base: "36px", md: "40px" },
              width: { base: "2rem", md: "2.5rem" },
            },
          }}
        >
          <Box w="100%" maxW="22rem" minW={0}>
            <SearchBar
              placeholderText="Rechercher un employé"
              onSearch={setSearchText}
            />
          </Box>
        </Box>
      </Grid>

      {/* LEAVE TABLE */}
      <Box
        flex="1"
        minH={0}
        minW={0}
        overflow="auto"
        overscrollBehavior="contain"
        borderRadius="md"
        mt={{ base: "0.2rem", md: "0.4rem" }}
      >
        <Box minW={isLoading || leaves.length ? "1000px" : 0}>
          {(isLoading || leaves.length > 0) && (
            <Grid
              templateColumns={gridTemplate}
              position="sticky"
              top={0}
              zIndex={1}
              alignItems="center"
              px={3}
              minH="3.5rem"
              fontWeight="600"
              color="gray.800"
              bg="#F8F9FB"
              border="1px solid #E2E8F0"
              boxShadow="0 2px 10px rgba(15,23,42,.06)"
            >
              <Text fontSize="0.99rem" sx={headerTextSx}>
                Employé
              </Text>

              <Text fontSize="0.99rem" sx={headerTextSx}>
                {"Début de\ncongé"}
              </Text>

              <Text fontSize="0.99rem" sx={headerTextSx}>
                {"Fin de\ncongé"}
              </Text>

              <Text fontSize="0.99rem" sx={headerTextSx}>
                Motif
              </Text>

              <Text fontSize="0.99rem" sx={headerTextSx}>
                Statut
              </Text>

              <Text fontSize="0.99rem" sx={headerTextSx}>
                {"Congés\nrestants"}
              </Text>

              <Text fontSize="0.99rem" sx={headerTextSx}>
                Actions
              </Text>
            </Grid>
          )}

          {isLoading ? (
            <VStack
              align="stretch"
              spacing={3}
              py={3}
              role="status"
              aria-label="Chargement des congés"
            >
              <Box as="style">{shimmerKeyframes}</Box>

              {Array.from({ length: 6 }, (_, index) => (
                <Shimmer key={index} height="72px" />
              ))}
            </VStack>
          ) : filteredLeaves.length === 0 ? (
            <Flex
              minH="12rem"
              align="center"
              justify="center"
              bg="white"
              border="1px solid #E2E8F0"
              p={4}
            >
              <Text color="gray.500" textAlign="center">
                Aucune demande de congé retrouvée
              </Text>
            </Flex>
          ) : (
            filteredLeaves.map((leave: TimeOffWithEmployee) => (
              <EmployeeLeaveCard
                key={leave._id}
                leave={leave}
                gridTemplate={gridTemplate}
                onDelete={() => handleDeleteConfirmation(leave)}
              />
            ))
          )}
        </Box>
      </Box>

      {/* BOTTOM FILTERS */}
      <Flex
        flexShrink={0}
        mt={4}
        gap={3}
        wrap="wrap"
        align="center"
        justify="space-between"
        minW={0}
      >
        <Box
          flex="1 1 180px"
          maxW={{ base: "100%", md: "22rem" }}
          minW={0}
          fontSize="0.875rem"
          fontWeight="600"
        >
          <MonthDropDown onChange={setSubmissionMonth} />
        </Box>

        <Box
          flex="1 1 180px"
          maxW={{ base: "100%", md: "22rem" }}
          minW={0}
          sx={{
            ".chakra-menu__menu-button": {
              width: "100%",
              minWidth: 0,
              fontSize: "0.875rem",
            },
            ".chakra-menu__menu-button p": {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }}
        >
          <LeaveStatusFilter onFilterClicked={setStatusFilter} />
        </Box>
      </Flex>

      {/* LEAVE SUBMISSION */}
      <LeaveSubmissionModal
        isOpen={isOpen}
        onClose={onClose}
        onRefresh={() => refetch()}
        employees={employees}
      />

      {/* DELETE CONFIRMATION */}
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
