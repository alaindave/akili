import {
  Box,
  Button,
  Flex,
  HStack,
  FormControl,
  FormLabel,
  Select,
  IconButton,
  useToast,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { DownloadIcon } from "@chakra-ui/icons";
import { FaArrowLeftLong } from "react-icons/fa6";
import { MdOutlineCancel, MdOutlineChevronRight } from "react-icons/md";
import { Link, useParams } from "react-router-dom";

import { GiConfirmed } from "react-icons/gi";
import {
  PayrollResult,
  PayrollRun,
} from "../../../../../common/types/payroll/Payroll";
import User from "../../../../../common/types/User";
import useAdminUser from "../../../../../store/auth.store";
import DeletionDialog from "../../../../components/DeletionDialog";
import PayrollDashboard from "../components/PayrollDashboard";
import PayrollResultsTable from "../components/PayrollResultsTable";
import useSyncStore from "../../../../../store/sync.store";
import { getPayrollPeriod } from "../../../../lib/date";
import PayrollAuditPopover from "../components/PayrollAuditPopover";

const PayrollDetailsPage = () => {
  const { _id } = useParams();

  const user: Omit<User, "password" | "notes"> = useAdminUser(
    (store) => store.adminUser
  );

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(
    {} as PayrollRun
  );

  const [payrollResults, setPayrollResults] = useState<PayrollResult[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const toast = useToast();

  const downloadReport = async () => {
    if (!_id || isDownloading) return;
    setIsDownloading(true);
    try {
      const result = await window.electron.hr.payrollRun.saveMonthlyReport(user.companyId, _id, department);
      if (!result.canceled) {
        toast({ title: "Rapport de paie enregistré", status: "success", duration: 3000, isClosable: true });
      }
    } catch (error) {
      toast({
        title: "Impossible de télécharger le rapport",
        description: error instanceof Error ? error.message : "Veuillez réessayer.",
        status: "error", duration: 5000, isClosable: true,
      });
    } finally {
      setIsDownloading(false);
    }
  };
  const departments = Array.from(
    new Set(payrollResults.map((result) => result.department?.trim() ?? ""))
  ).sort((a, b) => a.localeCompare(b, "fr"));
  const filteredResults = payrollResults.filter(
    (result) => department === null || (result.department?.trim() ?? "") === department
  );
  const dashboardTotals = filteredResults.reduce(
    (totals, result) => ({
      employeeCount: totals.employeeCount + 1,
      totalBasicSalary: totals.totalBasicSalary + result.baseSalary,
      totalEarnings: totals.totalEarnings + result.totalEarnings,
      totalDeductions: totals.totalDeductions + result.totalDeductions,
      totalNetSalary: totals.totalNetSalary + result.netSalary,
    }),
    {
      employeeCount: 0,
      totalBasicSalary: 0,
      totalEarnings: 0,
      totalDeductions: 0,
      totalNetSalary: 0,
    }
  );
  const syncVersion = useSyncStore((store) => store.syncVersion);

  const {
    isOpen: isConfirmationOpen,
    onOpen: onConfirmationOpen,
    onClose: onConfirmationClose,
  } = useDisclosure();

  /*
   * ---------------------------------------------------------
   * GET PAYROLL STATUS / ACTION
   * ---------------------------------------------------------
   */

  const getStatus = () => {
    if (!payrollRun?.status) {
      return null;
    }

    switch (payrollRun.status) {
      case "VERIFICATION":
        return user.role === "MANAGER"
          ? {
              label: "Approuver",
              onClick: approve,
            }
          : null;

      case "APPROUVÉ":
        return user.role === "MANAGER"
          ? {
              label: "Payer",
              onClick: pay,
            }
          : null;

      case "BROUILLON":
        return {
          label: "Verifier",
          onClick: verify,
        };

      default:
        return null;
    }
  };

  /*
   * ---------------------------------------------------------
   * LOAD DATA
   * ---------------------------------------------------------
   */

  useEffect(() => {
    loadPayrollRun();
    loadPayrollResuts();
  }, [syncVersion, _id, user.companyId]);

  useEffect(() => {
    setDepartment(null);
  }, [_id, user.companyId]);

  const loadPayrollRun = async () => {
    if (!_id) return;

    const payrollRun = await window.electron.hr.payrollRun.getPayrollRunById(
      user.companyId,
      _id
    );

    setPayrollRun(payrollRun);
  };

  const loadPayrollResuts = async () => {
    if (!_id) return;

    try {
      const payrollResults =
        await window.electron.hr.payrollRun.getPayrollResults(
          user.companyId,
          _id
        );

      setPayrollResults(payrollResults);

      console.log("FETCHED PAYROLL RESULTS", payrollResults);
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE FETCHING PAYROLL RESULTS", e);
    }
  };

  /*
   * ---------------------------------------------------------
   * PAYROLL ACTIONS
   * ---------------------------------------------------------
   */

  const handlePayrollCancellation = async () => {
    onConfirmationClose();

    if (!_id) return;

    try {
      const results = await window.electron.hr.payrollRun.cancelPayroll(
        user.companyId,
        _id,
        user
      );

      console.log("CANCELLATION RESULTS", results);

      window.electron.sync.sync(user.companyId).catch((error: Error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });

      loadPayrollRun();
      loadPayrollResuts();
    } catch (e) {
      console.error("AN ERROR OCCURED DURING CANCELLATION", e);
    }
  };

  const verify = async () => {
    if (!_id) return;

    try {
      const results = await window.electron.hr.payrollRun.submitForVerification(
        user.companyId,
        "afritanleather@yahoo.fr",
        _id,
        user
      );

      console.log("VERIFICATION RESULTS", results);

      window.electron.sync.sync(user.companyId).catch((error: Error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });

      loadPayrollRun();
      loadPayrollResuts();
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE SUBMITTING FOR VERIFICATION", e);
    }
  };

  const approve = async () => {
    if (!_id) return;

    try {
      const results = await window.electron.hr.payrollRun.approvePayroll(
        user.companyId,
        _id,
        user
      );

      console.log("APPROVAL RESULTS", results);

      window.electron.sync.sync(user.companyId).catch((error: Error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });

      loadPayrollRun();
      loadPayrollResuts();
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE SUBMITTING FOR APPROVAL", e);
    }
  };

  const pay = async () => {
    if (!_id) return;

    try {
      const results = await window.electron.hr.payrollRun.markPayrollAsPaid(
        user.companyId,
        "afritanleather@yahoo.fr",
        _id,
        user
      );

      console.log("PAYMENT RESULTS", results);

      window.electron.sync.sync(user.companyId).catch((error: Error) => {
        console.error("IMMEDIATE SYNC FAILED:", error);
      });

      loadPayrollRun();
      loadPayrollResuts();
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE SUBMITTING FOR PAYMENT", e);
    }
  };

  /*
   * ---------------------------------------------------------
   * CURRENT STATUS ACTION
   * ---------------------------------------------------------
   */

  const statusAction = getStatus();

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <Flex
      bg="#ffffff"
      width="100%"
      height="93vh"
      direction="column"
      justify="space-between"
    >
      {/* Header */}
      <Flex>
        <Link
          to={{
            pathname: `/employees_admin/payroll/`,
          }}
        >
          <Box
            position="absolute"
            top="1rem"
            ml="0.2rem"
            mr="2rem"
            p={2}
            border="1px solid #14376b"
            borderRadius="10px"
          >
            <FaArrowLeftLong color="black" />
          </Box>
        </Link>
        <Box ml="2rem">
          <HStack>
            <Text mt="1rem" ml="1rem" fontSize="1.4rem" fontWeight="600">
              Fiches de paye
            </Text>

            <Box mt="1rem">
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>

            <Text mt="1.2rem" fontWeight="600" color="gray.700">
              Periode du{" "}
              {payrollRun?.month && payrollRun?.year
                ? getPayrollPeriod(payrollRun.month, payrollRun.year)
                : ""}
            </Text>
          </HStack>
          {/* Payroll dashboard */}
          <Box mt="5rem" ml="1.5rem">
            <PayrollDashboard
              {...dashboardTotals}
            />
          </Box>
          {/* Payroll results table */}

          <Box mt="3rem" ml="0.4rem">
            <HStack mb={4} align="flex-end" spacing={3}>
            <FormControl maxW="280px">
              <FormLabel htmlFor="payroll-department" fontSize="sm">
                Département
              </FormLabel>
              <Select
                id="payroll-department"
                isDisabled={isDownloading}
                value={department === null ? "" : JSON.stringify(department)}
                onChange={(event) => setDepartment(
                  event.target.value === "" ? null : JSON.parse(event.target.value)
                )}
                bg="white"
              >
                <option value="">Tous les départements</option>
                {departments.map((name) => (
                  <option key={name} value={JSON.stringify(name)}>
                    {name || "Sans département"}
                  </option>
                ))}
              </Select>
            </FormControl>
            <IconButton
              aria-label="Télécharger le rapport mensuel de paie"
              title="Télécharger le rapport mensuel de paie"
              icon={<DownloadIcon />}
              onClick={downloadReport}
              isLoading={isDownloading}
              isDisabled={!payrollRun?._id || filteredResults.length === 0}
              variant="outline"
              colorScheme="blue"
            />
            </HStack>
            <PayrollResultsTable payrollResults={filteredResults} />
            {filteredResults.length === 0 && (
              <Text mt={4} color="gray.500" textAlign="center">
                Aucun résultat pour ce département.
              </Text>
            )}
          </Box>
        </Box>
        <PayrollAuditPopover payrollRun={payrollRun} />
      </Flex>

      {/* Buttons */}

      {payrollRun?.status !== "ANNULÉ" && payrollRun?.status !== "PAYÉ" && (
        <Flex mb="1rem" mr="2rem" justify="flex-end">
          <Button
            onClick={onConfirmationOpen}
            width="8rem"
            bg="#ffffff"
            border="1px solid gray"
          >
            <Box color="red.400" fontSize="1.2rem" mr="0.7rem">
              <MdOutlineCancel />
            </Box>
            Annuler
          </Button>

          {statusAction && (
            <Button
              onClick={statusAction.onClick}
              width="8rem"
              bg="#ffffff"
              border="1px solid gray"
              ml="0.3rem"
            >
              <Box color="green.600" fontSize="1.2rem" mr="0.7rem">
                <GiConfirmed />
              </Box>

              {statusAction.label}
            </Button>
          )}
        </Flex>
      )}

      <DeletionDialog
        isOpen={isConfirmationOpen}
        onClose={onConfirmationClose}
        onConfirmation={handlePayrollCancellation}
        header="Annuler"
        body="Etes vous sur de vouloir annuler cette fiche de paye?"
      />
    </Flex>
  );
};

export default PayrollDetailsPage;
