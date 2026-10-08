import {
  matchesPayrollFilters,
  payrollPaymentLabels,
  PayrollPaymentFilter,
} from "../../../../../common/types/hr/payroll/payrollPayment";
import {
  Box,
  Flex,
  HStack,
  FormControl,
  FormLabel,
  Select,
  IconButton,
  useToast,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { DownloadIcon } from "@chakra-ui/icons";
import { FaArrowLeftLong } from "react-icons/fa6";
import { MdOutlineChevronRight } from "react-icons/md";
import { Link, useParams } from "react-router-dom";

import {
  PayrollResult,
  PayrollRun,
} from "../../../../../common/types/hr/payroll/Payroll";
import User from "../../../../../common/types/shared/User";
import useAdminUser from "../../../../../store/auth.store";
import useSyncStore from "../../../../../store/sync.store";
import { getPayrollPeriod } from "../../../../lib/date";
import PayrollAuditPopover from "../components/PayrollAuditPopover";
import PayrollResultsTable from "../components/PayrollResultsTable";

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
            pathname: `/hr/payroll/`,
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

          <Box mt="3rem">
            <Flex mb={4} justify="space-between" flexWrap="wrap">
              {/* Filters and download button */}
              <Flex width="78vw" justify="space-between">
                <FormControl maxW="280px">
                  <FormLabel htmlFor="payroll-department" fontSize="sm">
                    Département
                  </FormLabel>
                  <Select
                    id="payroll-department"
                    isDisabled={isDownloading}
                    value={
                      department === null ? "" : JSON.stringify(department)
                    }
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
                <HStack>
                  <FormControl maxW="280px">
                    <FormLabel htmlFor="payroll-payment-method" fontSize="sm">
                      Mode de paiement
                    </FormLabel>
                    <Select
                      id="payroll-payment-method"
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(
                          event.target.value as PayrollPaymentFilter
                        )
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
                  <Box mt="1.3rem">
                    <IconButton
                      aria-label="Télécharger le rapport mensuel de paie"
                      title="Télécharger le rapport mensuel de paie"
                      icon={<DownloadIcon />}
                      onClick={downloadReport}
                      isLoading={isDownloading}
                      isDisabled={
                        !payrollRun?._id || filteredResults.length === 0
                      }
                      variant="outline"
                      colorScheme="blue"
                    />
                  </Box>
                </HStack>
              </Flex>
            </Flex>
            <Box mt="2rem">
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
    </Flex>
  );
};

export default PayrollDetailsPage;
