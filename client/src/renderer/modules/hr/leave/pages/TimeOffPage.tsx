import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { FaSyncAlt } from "react-icons/fa";
import { TimeOffStatus } from "../../../../../common/types/hr/time-off/TimeOff";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";
import defaultAvatar from "../../../../assets/default-avatar.jpeg";
import { useEmployees } from "../../employees/hooks/useEmployees";
import TimeOffSubmissionModal from "../components/TimeOffSubmissionModal";
import TimeOffEmployeeCell from "../components/TimeOffEmployeeCell";
import {
  useCreateTimeOff,
  useTimeOffList,
  useTimeOffMotifs,
  useTransitionTimeOff,
} from "../hooks/useTimeOff";
import PageSubtitle from "../../../../components/common/PageSubtitle";
import DeletionDialog from "../../../../components/common/DeletionDialog";
import TimeOffDetailsDrawer from "../components/TimeOffDetailsDrawer";
import SearchBar from "../../../../components/common/SearchBar";

const labels: Record<TimeOffStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};
const dateToday = () => new Date().toISOString().slice(0, 10);

export default function TimeOffPage() {
  const user = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const toast = useToast();
  const companyId = user.companyId;
  const { data: requests = [], isLoading, refetch } = useTimeOffList(companyId);
  const { data: motifs = [] } = useTimeOffMotifs(companyId);
  const { data: employees = [] } = useEmployees();
  const create = useCreateTimeOff(companyId);
  const transition = useTransitionTimeOff(companyId);
  const client = useQueryClient();
  const [month, setMonth] = useState(dateToday().slice(0, 7));
  const [motifId, setMotifId] = useState("");
  const [status, setStatus] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<
    (typeof requests)[number] | null
  >(null);
  const [selectedRequest, setSelectedRequest] = useState<
    (typeof requests)[number] | null
  >(null);

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee._id, employee])),
    [employees]
  );

  const selectedEmployee = selectedRequest
    ? employeesById.get(selectedRequest.employeeId)
    : undefined;
  const selectedPhotoPath = selectedEmployee?.photo_path;
  const selectedPhotoMime = selectedEmployee?.photo_mime_type || "image/jpeg";
  const { data: selectedPhotoUrl = "" } = useQuery({
    queryKey: [
      "time-off-details-photo",
      companyId,
      selectedPhotoPath,
      selectedPhotoMime,
      syncVersion,
    ],
    queryFn: async () => {
      if (!selectedPhotoPath) return defaultAvatar;
      const base64 = await window.electron.hr.employees.getPhotoUrl(
        selectedPhotoPath
      );
      return base64
        ? `data:${selectedPhotoMime};base64,${base64}`
        : defaultAvatar;
    },
    enabled: Boolean(selectedRequest),
  });
  const isManager = user.role === "MANAGER";

  const visibleRequests = useMemo(
    () =>
      requests
        .filter(
          (row) =>
            row.startDate.startsWith(month) ||
            row.endDate.startsWith(month) ||
            row.submittedAt.startsWith(month)
        )
        .filter((row) => !motifId || row.motifId === motifId)
        .filter((row) => !status || row.status === status),
    [requests, month, motifId, status]
  );
  const filteredRequests = useMemo(() => {
    const query = employeeSearch.trim().toLocaleLowerCase("fr");
    return visibleRequests.filter((row) => {
      if (!query) return true;
      const employee = employeesById.get(row.employeeId);
      return `${employee?.firstName ?? row.firstName} ${
        employee?.lastName ?? row.lastName
      }`
        .toLocaleLowerCase("fr")
        .includes(query);
    });
  }, [visibleRequests, employeeSearch, employeesById]);
  const showError = (error: unknown) =>
    toast({
      title: "Opération impossible",
      description: error instanceof Error ? error.message : String(error),
      status: "error",
      duration: 6000,
      isClosable: true,
    });
  const decide = async (
    row: (typeof requests)[number],
    action: "approve" | "reject" | "cancel" | "delete"
  ) => {
    const reason =
      action === "reject"
        ? window.prompt("Motif du refus (obligatoire)") ?? ""
        : undefined;
    if (action === "reject" && (!reason || !reason.trim())) return;
    try {
      await transition.mutateAsync({ id: row._id, action, reason });
    } catch (error) {
      showError(error);
    }
  };

  // Re-render lists after sync broadcasts without coupling UI to legacy Leave query keys.
  useEffect(() => {
    if (syncVersion !== undefined)
      void client.invalidateQueries({ queryKey: ["time-off", companyId] });
  }, [syncVersion, client, companyId]);

  return (
    <Flex
      direction="column"
      h="100%"
      minH={0}
      overflow="hidden"
      pt={{ base: 2, md: 5 }}
      px={{ base: 2, md: 5 }}
      pb={{ base: "calc(46px + 0.3rem)", md: "calc(52px + 0.3rem)" }}
      bg="#F8FAFC"
      gap={{ base: 2, md: 5 }}
    >
      <Flex
        justify="space-between"
        align="start"
        wrap="wrap"
        gap={3}
        flexShrink={0}
      >
        <Box position="relative" top="0.3rem">
          <HStack>
            <Heading
              fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
              fontWeight="700"
              color="#03143B"
            >
              Congés
            </Heading>
          </HStack>
          <PageSubtitle mt="0.2rem">Gérez les demandes de congés</PageSubtitle>
        </Box>
        <Button colorScheme="blue" onClick={() => setIsCreateModalOpen(true)}>
          Nouvelle demande
        </Button>
      </Flex>

      <TimeOffSubmissionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        employees={employees.filter((employee) => !employee.isDeleted)}
        onCreate={(input) => create.mutateAsync(input)}
        onRefresh={() => void refetch()}
      />
      {selectedRequest && (
        <TimeOffDetailsDrawer
          timeOff={selectedRequest}
          photoUrl={selectedPhotoUrl}
          remainingLeave={selectedRequest.remainingLeave ?? 0}
          isOpen
          onClose={() => setSelectedRequest(null)}
        />
      )}
      <DeletionDialog
        isOpen={!!requestToCancel}
        onClose={() => setRequestToCancel(null)}
        onConfirmation={async () => {
          if (!requestToCancel) return;
          await decide(requestToCancel, "cancel");
          setRequestToCancel(null);
        }}
        isDeleting={transition.isPending}
        header="Confirmer l’annulation de la demande"
        body={
          requestToCancel
            ? `Voulez-vous vraiment annuler la demande de congé de ${requestToCancel.firstName} ${requestToCancel.lastName} ? Cette action modifiera le statut de la demande.`
            : "Voulez-vous vraiment annuler cette demande de congé ?"
        }
        confirmLabel="Annuler la demande"
        cancelLabel="Retour"
        loadingText="Annulation…"
        confirmColorScheme="orange"
      />
      {/* Leaves table */}
      <Flex
        justify="space-between"
        gap={{ base: "0.1rem", sm: "0.5rem", md: "0.75rem" }}
        wrap="nowrap"
        align="end"
        flexShrink={0}
        width="100%"
        minW={0}
      >
        <Box flex="1 1 auto" minW={0}>
          <SearchBar
            placeholderText="Rechercher un employé..."
            onSearch={setEmployeeSearch}
          />
        </Box>
        <FormControl
          flex={{ base: "0 1 4.5rem", sm: "0 1 6rem", md: "0 1 10rem" }}
          minW={{ base: "4rem", sm: "5rem", md: "7rem" }}
          maxW={{ base: "6rem", md: "10rem" }}
        >
            <FormLabel>Mois</FormLabel>
            <Input
              type="month"
              lang="fr-FR"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
        </FormControl>
        <FormControl
          flex={{ base: "0 1 4.5rem", sm: "0 1 7rem", md: "0 1 14rem" }}
          minW={{ base: "4rem", sm: "5rem", md: "7rem" }}
          maxW={{ base: "6rem", md: "14rem" }}
        >
            <FormLabel>Motif</FormLabel>
            <Select
              value={motifId}
              onChange={(event) => setMotifId(event.target.value)}
            >
              <option value="">Tous les motifs</option>
              {motifs.map((motif) => (
                <option key={motif._id} value={motif._id}>
                  {motif.label}
                </option>
              ))}
            </Select>
        </FormControl>
        <FormControl
          flex={{ base: "0 1 4.5rem", sm: "0 1 7rem", md: "0 1 14rem" }}
          minW={{ base: "4rem", sm: "5rem", md: "7rem" }}
          maxW={{ base: "6rem", md: "14rem" }}
        >
            <FormLabel>Statut</FormLabel>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Tous</option>
              {Object.values(TimeOffStatus).map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </Select>
        </FormControl>
      </Flex>
      <Box
        flex="0 1 auto"
        maxH="100%"
        overflow="auto"
        mt={{ base: "0.1rem", lg: "0.1rem" }}
        mb="0.1rem"
        bg="white"
        borderWidth="1px"
        borderRadius="md"
      >
        <Table
          size={{ base: "sm", md: "md" }}
          sx={{
            "th, td": { fontSize: { base: "0.72rem", md: "0.8rem" } },
            th: { fontWeight: "600" },
          }}
        >
          <Thead position="sticky" top={0} zIndex={1} bg="white">
            <Tr>
              <Th>Employé</Th>
              <Th>Début de congé</Th>
              <Th>Fin de congé</Th>
              <Th>Motif</Th>
              <Th>Statut</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredRequests.map((row) => {
              const motif = motifs.find((value) => value._id === row.motifId);
              const policy =
                row.motifSnapshot ?? (motif ? { ...motif } : undefined);
              return (
                <Tr
                  key={row._id}
                  onClick={() => {
                    setSelectedRequest(row);
                  }}
                  cursor="pointer"
                  _hover={{ bg: "gray.50" }}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedRequest(row);
                    }
                  }}
                >
                  <Td>
                    <TimeOffEmployeeCell
                      employee={employeesById.get(row.employeeId)}
                      firstName={row.firstName}
                      lastName={row.lastName}
                      role={row.role}
                      department={row.department}
                    />
                  </Td>
                  <Td>
                    <Text fontSize={{ base: "0.85rem", md: "0.95rem" }}>
                      {new Date(row.startDate)
                        .toLocaleDateString("fr-FR")
                        .replace(/\//g, "-")}
                      {row.isPartialDay && row.startTime
                        ? ` (${row.startTime})`
                        : ""}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize={{ base: "0.85rem", md: "0.95rem" }}>
                      {new Date(row.endDate)
                        .toLocaleDateString("fr-FR")
                        .replace(/\//g, "-")}
                      {row.isPartialDay && row.endTime
                        ? ` (${row.endTime})`
                        : ""}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize={{ base: "0.85rem", md: "0.95rem" }}>
                      {row.motifId == null
                        ? "Congé"
                        : policy?.label ?? "Motif non vérifié"}
                    </Text>
                  </Td>
                  <Td>
                    <Badge
                      fontSize="0.8rem"
                      colorScheme={
                        row.status === "APPROVED"
                          ? "green"
                          : row.status === "PENDING"
                          ? "yellow"
                          : "gray"
                      }
                    >
                      {labels[row.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <Stack
                      direction="row"
                      flexWrap={{ base: "wrap", lg: "nowrap" }}
                      align="center"
                      spacing={2}
                    >
                      {row.status === "PENDING" && isManager ? (
                        <>
                          <Button
                            size="xs"
                            colorScheme="green"
                            onClick={(event) => {
                              event.stopPropagation();
                              void decide(row, "approve");
                            }}
                          >
                            Approuver
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={(event) => {
                              event.stopPropagation();
                              void decide(row, "reject");
                            }}
                          >
                            Refuser
                          </Button>
                        </>
                      ) : null}
                      {row.status !== "CANCELLED" &&
                        row.status !== "REJECTED" &&
                        (isManager || row.status === "PENDING") && (
                          <Button
                            size="xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setRequestToCancel(row);
                            }}
                          >
                            Annuler
                          </Button>
                        )}
                    </Stack>
                  </Td>
                </Tr>
              );
            })}
            {!filteredRequests.length && (
              <Tr>
                <Td colSpan={6}>
                  <Text py={6} textAlign="center" color="gray.500">
                    {isLoading
                      ? "Chargement…"
                      : "Aucun enregistrement pour ce filtre"}
                  </Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>
    </Flex>
  );
}
