import {
  matchesPayrollFilters,
  payrollPaymentLabels,
  PayrollPaymentFilter,
} from "../../../../../common/types/payroll/payrollPayment";
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
  const [paymentMethod, setPaymentMethod] =
    useState<PayrollPaymentFilter>("all");
  const [isDownloading, setIsDownloading] = useState(false);
  const toast = useToast();

  const downloadReport = async () => {
    if (!_id || isDownloading) return;
    setIsDownloading(true);
    try {
      const result = await window.electron.hr.payrollRun.saveMonthlyReport(
        user.companyId,
        _id,
        department,
        paymentMethod
      );
      if (!result.canceled) {
        toast({
          title: "Rapport de paie enregistré",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: "Impossible de télécharger le rapport",
        description:
          error instanceof Error ? error.message : "Veuillez réessayer.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDownloading(false);
    }
  };
  const departments = Array.from(
    new Set(payrollResults.map((result) => result.department?.trim() ?? ""))
  ).sort((a, b) => a.localeCompare(b, "fr"));
  const filteredResults = payrollResults.filter((result) =>
    matchesPayrollFilters(result, department, paymentMethod)
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
    setPaymentMethod("all");
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
      toast({
        title: "Impossible d’annuler cette paie",
        description: e instanceof Error ? e.message : "Veuillez réessayer.",
        status: "error",
        isClosable: true,
      });
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
            top="1.5rem"
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
            <Text mt="1.5rem" ml="1rem" fontSize="1.4rem" fontWeight="600">
              Fiches de paye
            </Text>

            <Box mt="1.5rem">
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>

            <Text mt="1.5rem" fontWeight="600" color="gray.700">
              Periode du{" "}
              {payrollRun?.month && payrollRun?.year
                ? getPayrollPeriod(payrollRun.month, payrollRun.year)
                : ""}
            </Text>
          </HStack>
          {/* Payroll results table */}

          <Box mt="3rem">
            <HStack mb={4} align="flex-end" spacing={3} flexWrap="wrap">
              <FormControl maxW="280px">
                <FormLabel htmlFor="payroll-department" fontSize="sm">
                  Département
                </FormLabel>
                <Select
                  id="payroll-department"
                  isDisabled={isDownloading}
                  value={department === null ? "" : JSON.stringify(department)}
                  onChange={(event) =>
                    setDepartment(
                      event.target.value === ""
                        ? null
                        : JSON.parse(event.target.value)
                    )
                  }
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
              <FormControl maxW="280px">
                <FormLabel htmlFor="payroll-payment-method" fontSize="sm">
                  Mode de paiement
                </FormLabel>
                <Select
                  id="payroll-payment-method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as PayrollPaymentFilter)
                  }
                  isDisabled={isDownloading}
                  bg="white"
                >
                  {Object.entries(payrollPaymentLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
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
            <Box mt="2.5rem">
              <PayrollResultsTable payrollResults={filteredResults} />
            </Box>
            {filteredResults.length === 0 && (
              <Text mt={4} color="gray.500" textAlign="center">
                Aucun résultat.
              </Text>
            )}
          </Box>
        </Box>
        <PayrollAuditPopover payrollRun={payrollRun} />
      </Flex>

      {/* Buttons */}

      {payrollRun?.status !== "ANNULÉ" &&
        payrollRun?.status !== "PAYÉ" &&
        !payrollResults.some(
          (result) => result.status === "APPROUVÉ" || result.status === "PAYÉ"
        ) && (
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
