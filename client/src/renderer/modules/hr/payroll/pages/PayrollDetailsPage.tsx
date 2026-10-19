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
      height="93dvh"
      minW={0}
      minH={0}
      overflow="hidden"
      p={{ base: 3, md: 6 }}
      gap={4}
      direction="column"
    >
      {/* Header */}
      <Flex align="center" gap={{ base: 2, md: 4 }} flexShrink={0} minW={0}>
        <Link
          to={{
            pathname: `/hr/payroll/`,
          }}
          aria-label="Retour à la liste des paies"
          style={{ flexShrink: 0 }}
        >
          <Box p={2} border="1px solid #14376b" borderRadius="10px">
            <FaArrowLeftLong color="black" />
          </Box>
        </Link>
        <HStack
          flex="1"
          minW={0}
          overflowX="auto"
          whiteSpace="nowrap"
          spacing={{ base: 1, md: 2 }}
        >
          <Text
            fontSize={{ base: "sm", md: "1.1rem" }}
            fontWeight="600"
            flexShrink={0}
          >
            Fiches de paye
          </Text>

          <Box flexShrink={0}>
            <MdOutlineChevronRight fontSize="1.3rem" />
          </Box>

          <Text
            fontSize={{ base: "xs", md: "md" }}
            fontWeight="600"
            color="gray.700"
            flexShrink={0}
          >
            Periode du{" "}
            {payrollRun?.month && payrollRun?.year
              ? getPayrollPeriod(payrollRun.month, payrollRun.year)
              : ""}
          </Text>
        </HStack>
        <PayrollAuditPopover payrollRun={payrollRun} />
      </Flex>

      <Flex mt="0.5rem" direction="column" flex="1" minH={0} minW={0} gap={4}>
        <Flex flexShrink={0}>
          {/* Filters and download button */}
          <Flex
            width="100%"
            justify="space-between"
            gap={3}
            flexWrap="wrap"
            align="end"
          >
            <FormControl
              flex="1 1 200px"
              maxW={{ base: "100%", md: "280px" }}
              minW={0}
            >
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
            <HStack
              flex="1 1 240px"
              maxW={{ base: "100%", md: "330px" }}
              minW={0}
              align="end"
            >
              <FormControl minW={0}>
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
              <Box flexShrink={0}>
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
              </Box>
            </HStack>
          </Flex>
        </Flex>
        <Flex mt="0.5rem" direction="column" flex="0 1 auto" minH={0} minW={0}>
          <PayrollResultsTable payrollResults={filteredResults} />
        </Flex>
        {filteredResults.length === 0 && (
          <Text flexShrink={0} color="gray.500" textAlign="center">
            Aucun résultat.
          </Text>
        )}
      </Flex>
    </Flex>
  );
};

export default PayrollDetailsPage;
