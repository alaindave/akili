import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  MenuButton,
  MenuItem,
  MenuList,
  Menu,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaSyncAlt } from "react-icons/fa";
import { IoSettings } from "react-icons/io5";
import { PiDotsThreeOutlineVerticalDuotone } from "react-icons/pi";
import { MdOutlineDeleteForever } from "react-icons/md";
import { IoIosRemoveCircleOutline } from "react-icons/io";
import { Link, useNavigate } from "react-router-dom";
import User from "../../../../../common/types/User";
import { PayrollRun } from "../../../../../common/types/payroll/Payroll";
import useAdminUser from "../../../../../store/auth.store";
import { useErrorToast } from "../../../../hooks/useErrorToast";
import useSyncStore from "../../../../../store/sync.store";
import MonthDropDown from "../../../../components/MonthDropDown";
import PayrollStatusFilter from "../components/PayrollStatusFilter";
import { getPayrollPeriod } from "../../../../lib/date";

const formatErrorMessage = (error: Error | string): string => {
  let message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Une erreur est survenue.";

  /*
   * ============================================================
   * 1. Remove Electron IPC wrapper
   * ============================================================
   *
   * Example:
   *
   * Error invoking remote method 'payroll:createDraft':
   * Error: SQLITE_CONSTRAINT: UNIQUE constraint failed...
   */
  message = message.replace(
    /^Error invoking remote method '[^']+':\s*Error:\s*/i,
    ""
  );

  /*
   * ============================================================
   * 2. Remove generic Error: prefix
   * ============================================================
   */
  message = message.replace(/^Error:\s*/i, "");

  /*
   * ============================================================
   * 3. Handle SQLite UNIQUE constraints
   * ============================================================
   */

  if (
    /SQLITE_CONSTRAINT:\s*UNIQUE constraint failed:\s*payroll_runs\.month,\s*payroll_runs\.year/i.test(
      message
    )
  ) {
    return "Une paie existe déjà pour ce mois et cette année.";
  }

  /*
   * ============================================================
   * 4. Handle other common SQLite errors
   * ============================================================
   */

  if (/SQLITE_CONSTRAINT.*UNIQUE constraint failed/i.test(message)) {
    return "Cette donnée existe déjà.";
  }

  if (/SQLITE_CONSTRAINT.*FOREIGN KEY constraint failed/i.test(message)) {
    return "Cette opération ne peut pas être effectuée car des données associées sont manquantes.";
  }

  if (/SQLITE_CONSTRAINT.*NOT NULL constraint failed/i.test(message)) {
    return "Certaines informations obligatoires sont manquantes.";
  }

  /*
   * ============================================================
   * 5. Remove raw SQLite prefix if still present
   * ============================================================
   */

  message = message.replace(/^SQLITE_CONSTRAINT:\s*/i, "");

  /*
   * ============================================================
   * 6. Fallback
   * ============================================================
   */

  return message.trim() || "Une erreur est survenue.";
};

export default function PayrollPage() {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const user: Omit<User, "password" | "notes"> = useAdminUser(
    (store) => store.adminUser
  );
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const navigate = useNavigate();
  const toast = useToast();
  const showErrorMessage = useErrorToast();
  const [submissionMonth, setSubmissionMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    console.log("PAYROLL PAGE: SYNC COMPLETED, RELOADING PAYROLL DATA");
    loadPayrollRun();
  }, [syncVersion, submissionMonth]);

  const showActionError = (
    title: string,
    error: unknown,
    fallbackMessage: string
  ) => {
    console.error(title, error);

    const message =
      error instanceof Error || typeof error === "string"
        ? formatErrorMessage(error)
        : fallbackMessage;

    toast({
      title,
      description: message,
      status: "error",
      duration: 3500,
      isClosable: true,
      position: "top-left",
    });
  };

  const loadPayrollRun = async () => {
    const [year, month] = submissionMonth.split("-");
    console.log("Selected year", year);
    console.log("Selected month", month);
    try {
      const payrollRuns = await window.electron.payrollRun.getPayrollRuns(
        user.companyId,
        Number(year),
        Number(month)
      );
      console.log("FETCHED PAYROLL RUNS", payrollRuns);
      setPayrollRuns(payrollRuns);
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE LOADING PAYROLL RUNS", e);
    }
  };

  //Payroll sync and refresh
  const handlePayrollSync = async () => {
    try {
      setLoading(true);
      const result = await window.electron.sync(user.companyId);
      if (result.success) {
        console.log("SYNC COMPLETED");
        loadPayrollRun();
      } else {
        console.error(result.message);
      }
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE SYNCING", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePayrollGeneration = async () => {
    const [year, month] = submissionMonth.split("-");
    console.log("Selected year", year);
    console.log("Selected month", month);
    console.log("GENERATED BY ADMIN USER:", user);

    try {
      const payroll_results =
        await window.electron.payrollRun.createPayrollDraft(
          user.companyId,
          user,
          Number(year),
          Number(month)
        );
      console.log("PAYROLL RESULTS", payroll_results);
      toast({
        title: "Paie générée",
        description: "Les bulletins de paie ont été généré avec succès.",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top-left",
      });
      await handlePayrollSync();
    } catch (error) {
      showActionError(
        "Échec de creation de bulletins de paie",
        error,
        "Impossible de creer les bulletins de paie."
      );
    }
  };

  const withdraw = async (_id: string) => {
    try {
      const results = await window.electron.payrollRun.returnToDraft(
        user.companyId,
        _id
      );
      console.log("WITHDRAW RESULTS", results);
      await handlePayrollSync();
    } catch (error) {
      showErrorMessage(
        "Échec de retrait de bulletins de paie",
        error,
        "Impossible de retirer le bulletin de paie."
      );
    }
  };

  const handlePayrollCancellation = async (_id: string) => {
    if (!_id) return;
    try {
      const results = await window.electron.payrollRun.cancelPayroll(
        user.companyId,
        _id,
        user
      );
      console.log("CANCELLATION RESULTS", results);
      await handlePayrollSync();
    } catch (error) {
      showErrorMessage(
        "Échec d'annulation de bulletins de paie",
        error,
        "Impossible d'annuler les bulletin de paie."
      );
    }
  };

  const handleDelete = async (_id: string) => {
    try {
      const results = await window.electron.payrollRun.deletePayrollRun(
        user.companyId,
        _id
      );
      console.log("DELETE RESULTS", results);
      await handlePayrollSync();
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE DELETING PAYROLL", e);
    }
  };

  const statusColor = {
    BROUILLON: "#e6b800",
    VERIFICATION: "#1a53ff",
    APPROUVÉ: "green",
    PAYÉ: "purple",
    ANNULÉ: "red",
  } as const;

  return (
    <Flex
      bg="#F8F9FB"
      direction="column"
      justify="space-between"
      height="93vh"
      width="100%"
    >
      <Box>
        <Flex width="100%" justify="space-between">
          <Box>
            <HStack>
              <Text
                color="#1F2937"
                fontSize="clamp(1.3rem, 1vw + 0.8rem, 1.4rem)"
                fontWeight="700"
                ml="1rem"
                mt="1.3rem"
              >
                Fiches de paye
              </Text>
              <Button
                bg="transparent"
                isLoading={loading}
                color="gray.800"
                _hover={{ bg: "transparent" }}
                fontSize="1rem"
                position="relative"
                top="0.8rem"
                right="1rem"
                onClick={handlePayrollSync}
              >
                <FaSyncAlt />
              </Button>
            </HStack>
            <Text
              fontWeight="500"
              fontSize="clamp(1rem, 1vw + 0.8rem, 1rem)"
              color="gray.500"
              position="relative"
              bottom="0.5rem"
              left="1rem"
            >
              Gérez les fiches de payes
            </Text>
          </Box>

          <Button
            colorScheme="blue"
            mr="2rem"
            mt="1.5rem"
            onClick={handlePayrollGeneration}
          >
            Générer fiches de paye
          </Button>

          <Box mt="1rem" mr="2rem">
            <Link to="/employees_admin/payroll/settings">
              <IoSettings fontSize="1.9rem" />
            </Link>
          </Box>
        </Flex>

        <Box mt="3rem" ml="1rem">
          {payrollRuns.length === 0 ? (
            <Flex
              ml="0.5rem"
              mt="7rem"
              width="78vw"
              minHeight={{
                base: "180px",
                md: "220px",
              }}
              align="center"
              justify="center"
              bg="#ffffff"
              border="1px solid #E2E8F0"
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
                  Pas de fiches de paye retrouvées.
                </Text>
              </VStack>
            </Flex>
          ) : (
            <Box mb="2rem" ml="2rem">
              <Box mb="0.7rem">
                <PayrollStatusFilter onFilterClicked={setStatusFilter} />
              </Box>
              <TableContainer
                maxW="70vw"
                maxH="50vh"
                borderWidth="1px"
                borderRadius="lg"
                overflowY="auto"
              >
                <Table mt="1rem" variant="simple" size="md">
                  <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                    <Tr>
                      <Th>Période</Th>
                      <Th>Statut</Th>
                      <Th>Créee par</Th>
                      <Th>Date de création</Th>
                      {user?.role === "MANAGER" ? <Th>Actions</Th> : null}
                    </Tr>
                  </Thead>

                  <Tbody>
                    {payrollRuns
                      .filter(
                        (run) => !statusFilter || run.status === statusFilter
                      )
                      .map((run) => (
                        <Tr key={run._id}>
                          <Td
                            cursor="pointer"
                            _hover={{ bg: "transparent" }}
                            transition="background 0.2s"
                            onClick={() =>
                              navigate(
                                `/employees_admin/payroll/details/${run._id}`
                              )
                            }
                          >
                            Du{" "}
                            {run?.month && run?.year
                              ? getPayrollPeriod(run.month, run.year)
                              : ""}
                          </Td>

                          <Td>
                            <Badge
                              bg={statusColor[run.status]}
                              color="#ffffff"
                              fontSize="14px"
                            >
                              {run.status}
                            </Badge>
                          </Td>

                          <Td>{run.generatedByName}</Td>

                          <Td>
                            {run.createdAt
                              ? new Date(run.createdAt).toLocaleDateString(
                                  "fr-FR"
                                )
                              : "-"}
                          </Td>
                          {user?.role === "MANAGER" ? (
                            <Td>
                              <Menu placement="bottom">
                                <MenuButton
                                  mb={10}
                                  as={IconButton}
                                  icon={
                                    <PiDotsThreeOutlineVerticalDuotone size="1.8rem" />
                                  }
                                  color="gray.700"
                                  variant="ghost"
                                  borderRadius="full"
                                  _hover={{
                                    bg: "transparent",
                                  }}
                                  _expanded={{
                                    bg: "transparent",
                                  }}
                                  aria-label="Actions"
                                  position="relative"
                                  top="1rem"
                                />

                                <MenuList
                                  bg="#ffffff"
                                  border="1px solid #2A3D70"
                                  borderRadius="14px"
                                  minW="170px"
                                  p="6px"
                                  boxShadow="0 8px 30px rgba(0,0,0,0.35)"
                                >
                                  {run.status !== "BROUILLON" &&
                                  run.status !== "ANNULÉ" ? (
                                    <MenuItem
                                      height="10px"
                                      ml="1rem"
                                      mb="0.2rem"
                                      pt={2}
                                      icon={
                                        <IoIosRemoveCircleOutline
                                          color="orange"
                                          size="1.2rem"
                                        />
                                      }
                                      bg="transparent"
                                      color="gray.800"
                                      borderRadius="10px"
                                      _hover={{
                                        bg: "transparent",
                                      }}
                                      onClick={() => withdraw(run._id)}
                                    >
                                      Retirer
                                    </MenuItem>
                                  ) : null}

                                  {run.status === "BROUILLON" ? (
                                    <MenuItem
                                      height="20px"
                                      mb={2}
                                      pt={3}
                                      icon={
                                        <MdOutlineDeleteForever
                                          color="red"
                                          size="1.5rem"
                                        />
                                      }
                                      bg="transparent"
                                      color="gray.800"
                                      borderRadius="10px"
                                      _hover={{
                                        bg: "transparent",
                                      }}
                                      onClick={() =>
                                        handlePayrollCancellation(run._id)
                                      }
                                    >
                                      Annuler
                                    </MenuItem>
                                  ) : null}

                                  {run.status === "ANNULÉ" ? (
                                    <MenuItem
                                      height="20px"
                                      mb={2}
                                      pt={3}
                                      icon={
                                        <MdOutlineDeleteForever
                                          color="red"
                                          size="1.5rem"
                                        />
                                      }
                                      bg="transparent"
                                      color="gray.800"
                                      borderRadius="10px"
                                      _hover={{
                                        bg: "transparent",
                                      }}
                                      onClick={() => handleDelete(run._id)}
                                    >
                                      Supprimer
                                    </MenuItem>
                                  ) : null}
                                </MenuList>
                              </Menu>
                            </Td>
                          ) : null}
                        </Tr>
                      ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Box>
      <Box
        ml="1rem"
        fontSize="1.2rem"
        fontFamily="monospace"
        fontWeight="600"
        width="250px"
      >
        <MonthDropDown onChange={(month) => setSubmissionMonth(month)} />
      </Box>
    </Flex>
  );
}
