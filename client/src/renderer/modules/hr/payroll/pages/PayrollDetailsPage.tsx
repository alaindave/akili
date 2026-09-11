import {
  Box,
  Button,
  Flex,
  HStack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
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
  }, [syncVersion]);

  const loadPayrollRun = async () => {
    if (!_id) return;

    const payrollRun = await window.electron.payrollRun.getPayrollRunById(
      user.companyId,
      _id
    );

    setPayrollRun(payrollRun);
  };

  const loadPayrollResuts = async () => {
    if (!_id) return;

    try {
      const payrollResults = await window.electron.payrollRun.getPayrollResults(
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
      const results = await window.electron.payrollRun.cancelPayroll(
        user.companyId,
        _id,
        user
      );

      console.log("CANCELLATION RESULTS", results);

      window.electron.sync(user.companyId).catch((error) => {
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
      const results = await window.electron.payrollRun.submitForVerification(
        user.companyId,
        _id,
        user
      );

      console.log("VERIFICATION RESULTS", results);

      window.electron.sync(user.companyId).catch((error) => {
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
      const results = await window.electron.payrollRun.approvePayroll(
        user.companyId,
        _id,
        user
      );

      console.log("APPROVAL RESULTS", results);

      window.electron.sync(user.companyId).catch((error) => {
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
      const results = await window.electron.payrollRun.markPayrollAsPaid(
        user.companyId,
        _id,
        user
      );

      console.log("PAYMENT RESULTS", results);

      window.electron.sync(user.companyId).catch((error) => {
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
              employeeCount={payrollRun?.employeeCount ?? 0}
              totalBasicSalary={payrollRun?.totalBasicSalary ?? 0}
              totalEarnings={payrollRun?.totalEarnings ?? 0}
              totalDeductions={payrollRun?.totalDeductions ?? 0}
              totalNetSalary={payrollRun?.totalNetSalary ?? 0}
            />
          </Box>
          {/* Payroll results table */}

          <Box mt="3rem" ml="1rem">
            <PayrollResultsTable payrollResults={payrollResults} />
          </Box>
        </Box>
        <PayrollAuditPopover payrollRun={payrollRun} />
      </Flex>

      {/* Buttons */}

      {payrollRun?.status !== "ANNULÉ" && payrollRun?.status !== "PAYÉ" && (
        <Flex mr="2rem" mt="3rem" justify="flex-end">
          <Button
            onClick={onConfirmationOpen}
            width="10rem"
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
              width="10rem"
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
