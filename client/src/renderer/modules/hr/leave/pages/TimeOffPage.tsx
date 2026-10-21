import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useEmployees } from "../../employees/hooks/useEmployees";
import LeaveSubmissionModal from "../components/LeaveSubmissionModal";
import {
  useCreateTimeOff,
  useReviewLegacyTimeOff,
  useTimeOffList,
  useTimeOffMotifs,
  useTransitionTimeOff,
} from "../hooks/useTimeOff";

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
  const reviewLegacy = useReviewLegacyTimeOff(companyId);
  const client = useQueryClient();
  const [month, setMonth] = useState(dateToday().slice(0, 7));
  const [status, setStatus] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reviewMotif, setReviewMotif] = useState<Record<string, string>>({});
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
        .filter((row) => !status || row.status === status),
    [requests, month, status]
  );
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
    if (action === "delete" && !window.confirm("Archiver cette demande ?"))
      return;
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
      overflow="auto"
      p={5}
      bg="#F8FAFC"
      gap={5}
    >
      <Flex justify="space-between" align="start" wrap="wrap" gap={3}>
        <Box>
          <HStack>
            <Heading size="md" color="#03143B">
              Congés
            </Heading>
            <Button
              position="relative"
              right="0.5rem"
              size="sm"
              variant="ghost"
              minW={8}
              px={1}
              onClick={() => void refetch()}
              isLoading={isLoading}
            >
              <FaSyncAlt />
            </Button>
          </HStack>
          <Text color="gray.600">Gérez les demandes de congés </Text>
        </Box>
        <Button colorScheme="blue" onClick={() => setIsCreateModalOpen(true)}>
          Nouvelle demande
        </Button>
      </Flex>

      <LeaveSubmissionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        employees={employees.filter((employee) => !employee.isDeleted)}
        onCreate={(input) => create.mutateAsync(input)}
        onRefresh={() => void refetch()}
      />
      {/* Leaves table */}
      <Flex gap={3} wrap="wrap" align="end">
        <FormControl maxW="12rem">
          <FormLabel>Mois</FormLabel>
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </FormControl>
        <FormControl maxW="14rem">
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
      <Box overflowX="auto" bg="white" borderWidth="1px" borderRadius="md">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Employé</Th>
              <Th>Dates</Th>
              <Th>Motif</Th>
              <Th>Statut</Th>
              <Th>Actions / synchronisation</Th>
            </Tr>
          </Thead>
          <Tbody>
            {visibleRequests.map((row) => {
              const motif = motifs.find((value) => value._id === row.motifId);
              const legacy = row.legacyNeedsReview || !row.motifId;
              const policy =
                row.motifSnapshot ?? (motif ? { ...motif } : undefined);
              return (
                <Tr key={row._id}>
                  <Td>
                    {row.firstName} {row.lastName}
                  </Td>
                  <Td>
                    {new Date(row.startDate)
                      .toLocaleDateString("fr-FR")
                      .replace(/\//g, "-")}{" "}
                    →{" "}
                    {new Date(row.endDate)
                      .toLocaleDateString("fr-FR")
                      .replace(/\//g, "-")}
                    {row.isPartialDay
                      ? ` (${row.startTime ?? ""}–${row.endTime ?? ""})`
                      : ""}
                  </Td>
                  <Td>
                    {row.motifId == null
                      ? "Congé"
                      : policy?.label ?? "Motif non vérifié"}
                  </Td>
                  <Td>
                    <Badge
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
                    <Stack direction="row" wrap="wrap">
                      {row.status === "PENDING" && isManager ? (
                        <>
                          <Button
                            size="xs"
                            colorScheme="green"
                            onClick={() => void decide(row, "approve")}
                          >
                            Approuver
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={() => void decide(row, "reject")}
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
                            onClick={() => void decide(row, "cancel")}
                          >
                            Annuler
                          </Button>
                        )}
                    </Stack>
                  </Td>
                </Tr>
              );
            })}
            {!visibleRequests.length && (
              <Tr>
                <Td colSpan={5}>
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
