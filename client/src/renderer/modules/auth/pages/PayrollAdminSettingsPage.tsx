import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Spinner,
  Table,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PayrollRun } from "../../../../common/types/hr/payroll/Payroll";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import { formatCurrency } from "../../../lib/formatter";
import { usePayrollSettings } from "../../hr/payroll/hooks/payroll_settings.hook";
import { getPayrollPeriod } from "../../../lib/date";
import DeletionDialog from "../../../components/common/DeletionDialog";

import PayrollComponentList from "../../hr/payroll/components/PayrollComponentList";
import PayrollDefaults from "../../hr/payroll/pages/PayrollDefaultsPage";

export default function PayrollAdminSettingsPage() {
  const user = useAdminUser((store) => store.adminUser);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const currency = usePayrollSettings()?.currency ?? "BIF";
  const toast = useToast();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<PayrollRun | null>(null);
  const [busy, setBusy] = useState(false);
  const canCancel = user.role === "ADMIN" || user.role === "MANAGER";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setSelected(null);
    window.electron.hr.payrollRun
      .getProcessedPayrollRuns(user.companyId)
      .then((values: PayrollRun[]) => {
        if (active) setRuns(values);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.companyId, syncVersion]);

  const cancel = async () => {
    if (!selected || busy || !canCancel) return;
    setBusy(true);
    try {
      await window.electron.hr.payrollRun.cancelProcessedPayroll(
        user.companyId,
        selected._id,
        user
      );
      setRuns((values) => values.filter((run) => run._id !== selected._id));
      setSelected(null);
      toast({
        title: "La paie et ses bulletins ont été annulés",
        status: "success",
        isClosable: true,
      });
      window.electron.sync.sync(user.companyId).catch((error: Error) => {
        console.error("PAYROLL CANCELLATION SYNC FAILED:", error);
      });
    } catch (error) {
      toast({
        title: "Impossible d’annuler cette paie",
        description:
          error instanceof Error ? error.message : "Veuillez réessayer.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 5, md: 10 }}>
      <Button as={Link} to="/admin/settings" variant="outline" mb={6}>
        Retour aux paramètres
      </Button>
      <Heading size="lg" mb={8}>
        Paramètres de paie
      </Heading>
      <Tabs
        colorScheme="yellow"
        bg="white"
        borderWidth="1px"
        borderRadius="lg"
        p={{ base: 3, md: 6 }}
      >
        <TabList overflowX="auto">
          <Tab>Rémunérations</Tab>
          <Tab>Déductions</Tab>
          <Tab>Paramètres</Tab>
          <Tab>Annulation des paies</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <PayrollComponentList type="EARNING" showTaxable />
          </TabPanel>
          <TabPanel px={0}>
            <PayrollComponentList type="DEDUCTION" showTaxable={false} />
          </TabPanel>
          <TabPanel px={0}>
            <PayrollDefaults />
          </TabPanel>
          <TabPanel px={0}>
            <Heading size="md" mb={4}>
              Annuler une paie approuvée ou payée
            </Heading>
            <Text color="gray.600" mb={6}>
              L’annulation concerne tous les bulletins de la période. Les
              montants et l’historique d’approbation et de paiement sont
              conservés. Elle ne rembourse pas les paiements déjà effectués.
            </Text>
            {!canCancel && (
              <Text mb={4}>
                Seuls les administrateurs et les responsables peuvent annuler
                une paie.
              </Text>
            )}
            {loading ? (
              <HStack>
                <Spinner size="sm" />
                <Text>Chargement des paies…</Text>
              </HStack>
            ) : loadError ? (
              <Text color="red.600">
                Impossible de charger les paies. Rouvrez cette page pour
                réessayer.
              </Text>
            ) : runs.length === 0 ? (
              <Text color="gray.600">Aucune paie approuvée ou payée.</Text>
            ) : (
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Période</Th>
                      <Th>Statut</Th>
                      <Th isNumeric>Employés</Th>
                      <Th isNumeric>Salaire net total</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {runs.map((run) => (
                      <Tr key={run._id}>
                        <Td>{getPayrollPeriod(run.month, run.year)}</Td>
                        <Td>
                          <Badge
                            colorScheme={
                              run.status === "PAYÉ" ? "blue" : "green"
                            }
                          >
                            {run.status}
                          </Badge>
                        </Td>
                        <Td isNumeric>{run.employeeCount}</Td>
                        <Td isNumeric>
                          {formatCurrency(run.totalNetSalary, currency)}
                        </Td>
                        <Td>
                          <Button
                            colorScheme="red"
                            variant="outline"
                            size="sm"
                            isDisabled={!canCancel || busy}
                            onClick={() => setSelected(run)}
                          >
                            Annuler la paie
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
      <DeletionDialog
        isOpen={!!selected}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        isDeleting={busy}
        onConfirmation={cancel}
        header="Annuler cette paie ?"
        body={
          selected
            ? `Annuler la paie de la période ${getPayrollPeriod(
                selected.month,
                selected.year
              )} et tous ses bulletins ? Les paiements déjà effectués ne seront pas remboursés.`
            : ""
        }
      />
    </Box>
  );
}
