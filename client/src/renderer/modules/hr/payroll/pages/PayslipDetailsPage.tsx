import {
  Box,
  Flex,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Tfoot,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaDollarSign } from "react-icons/fa";
import {
  FaArrowDownLong,
  FaArrowLeftLong,
  FaArrowTrendUp,
} from "react-icons/fa6";
import { IoWalletOutline } from "react-icons/io5";
import { MdOutlineChevronRight } from "react-icons/md";
import { PiCreditCardLight } from "react-icons/pi";
import { useNavigate, useParams } from "react-router-dom";
import {
  PayrollItem,
  PayrollResult,
} from "../../../../../common/types/payroll/Payroll";
import useSyncStore from "../../../../../store/sync.store";
import PayslipItemDisplay from "../components/PayslipItemDisplay";
import { usePayrollSettings } from "../hooks/payroll_settings.hook";
import { getPayrollPeriod } from "../../../../lib/date";
import { formatCurrency } from "../../../../lib/formatter";
import Employee from "../../../../../common/types/Employee";
import useAdminUser from "../../../../../store/auth.store";

const EmployeePayslipDetails = () => {
  const { _id: employeeId, payslipId } = useParams();
  const user = useAdminUser((store) => store.adminUser);
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrollResults, setPayrollResults] = useState<PayrollResult | null>(
    {} as PayrollResult
  );
  const [payrollItems, setPayrollItems] = useState<PayrollItem[] | null>([]);
  console.log("Employee ID:", employeeId);
  console.log("PAYROLL ID", payslipId);
  const earnings = payrollItems?.filter((p) => p.type === "EARNING") ?? [];
  const deductions = payrollItems?.filter((p) => p.type === "DEDUCTION") ?? [];
  const totalEarnings = earnings.reduce(
    (total, item) => total + item.amount,
    0
  );
  const totalDeductions = deductions.reduce(
    (total, item) => total + item.amount,
    0
  );
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const payrollSettings = usePayrollSettings();
  const currency = payrollSettings?.currency ?? "BIF";
  const statusColor = {
    BROUILLON: "#e6b800",
    VERIFICATION: "#1a53ff",
    APPROUVÉ: "green",
    PAYÉ: "pink.600",
    ANNULÉ: "red",
  } as const;
  const statusBgColor = {
    BROUILLON: "yellow.200",
    VERIFICATION: "blue.200",
    APPROUVÉ: "green.200",
    PAYÉ: "pink.200",
    ANNULÉ: "red.200",
  } as const;

  useEffect(() => {
    loadEmployee();
    loadPayroll();
  }, [employee?.photo_path, syncVersion]);

  const loadEmployee = async () => {
    if (!employeeId) return;

    try {
      const employee = await window.electron.hr.employees.getById(
        user.companyId,
        employeeId
      );
      console.log("FETCHED EMPLOYEE:", employee);
      setEmployee(employee);
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE FETCHING THE EMPLOYEE", e);
    }
  };

  const loadPayroll = async () => {
    if (!employeeId || !payslipId) return;

    try {
      const payrollResults =
        await window.electron.hr.payrollRun.getEmployeePayrollResults(
          user.companyId,
          employeeId,
          payslipId
        );
      console.log("FETCHED PAYROLL RESULTS", payrollResults);
      console.log("PAYSLIP ID", payslipId);

      setPayrollResults(payrollResults);

      const payrollItems = await window.electron.hr.payrollRun.getPayrollItems(
        user.companyId,
        payrollResults?._id!,
        employeeId
      );
      console.log("FETCHED PAYROLL ITEMS", payrollItems);
      setPayrollItems(payrollItems);
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE FETCHING PAYROLL DATA", e);
    }
  };

  return (
    <Flex bg="#ffffff" width="100%" direction="column">
      <Flex justify="space-between">
        {/* Header */}
        <HStack>
          <Box
            mt="1rem"
            p={3}
            border="1px solid #14376b"
            borderRadius="10px"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeftLong size="0.9rem" color="black" />
          </Box>
          <Box mt="1rem">
            <HStack>
              <Text ml="0.3rem" fontSize="1.1rem" fontWeight="500">
                Fiches de paye
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.3rem" />
              </Box>
              <Text fontWeight="500" fontSize="1rem">
                Periode du{" "}
                {payrollResults?.month && payrollResults?.year
                  ? getPayrollPeriod(payrollResults.month, payrollResults.year)
                  : ""}
              </Text>
              <Box>
                <MdOutlineChevronRight fontSize="1.3rem" />
              </Box>

              <Text fontWeight="500" fontSize="1rem">
                {employee?.firstName}
              </Text>
              <Text fontWeight="500" fontSize="1rem">
                {employee?.lastName}
              </Text>
            </HStack>
          </Box>
        </HStack>
        <VStack>
          {/* Creation date */}
          {payrollResults?.status === "BROUILLON" ? (
            <HStack mt="1rem" mr="2rem">
              <Box>
                <HStack>
                  <Text fontWeight="600">
                    {payrollResults?.createdAt &&
                      new Date(payrollResults?.createdAt).toLocaleDateString(
                        "fr-FR"
                      )}
                  </Text>
                  <Text>
                    {payrollResults?.createdAt &&
                      new Date(payrollResults?.createdAt).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                  </Text>
                </HStack>
              </Box>
            </HStack>
          ) : null}

          {/* Cancellation date */}
          {payrollResults?.status === "ANNULÉ" ? (
            <HStack mt="1rem" mr="1rem">
              <HStack>
                <Text fontWeight="600">
                  {payrollResults?.cancelledAt &&
                    new Date(payrollResults?.cancelledAt).toLocaleDateString(
                      "fr-FR"
                    )}
                </Text>
                <Text>
                  {payrollResults?.cancelledAt &&
                    new Date(payrollResults?.cancelledAt).toLocaleTimeString(
                      "fr-FR",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                </Text>
              </HStack>
            </HStack>
          ) : null}
          {/* Date de verification */}
          {payrollResults?.status === "VERIFICATION" ? (
            <HStack mt="1rem" mr="1rem">
              <Box>
                <HStack>
                  <Text fontWeight="600">
                    {payrollResults?.verifiedAt &&
                      new Date(payrollResults?.verifiedAt).toLocaleDateString(
                        "fr-FR"
                      )}
                  </Text>
                  <Text>
                    {payrollResults?.verifiedAt &&
                      new Date(payrollResults?.verifiedAt).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                  </Text>
                </HStack>
              </Box>
            </HStack>
          ) : null}
          {/* Approval date  */}
          {payrollResults?.status === "APPROUVÉ" ? (
            <HStack mt="1rem" mr="1rem">
              <Box>
                <HStack>
                  <Text fontWeight="600">
                    {payrollResults?.approvedAt &&
                      new Date(payrollResults?.approvedAt).toLocaleDateString(
                        "fr-FR"
                      )}
                  </Text>
                  <Text>
                    {payrollResults?.approvedAt &&
                      new Date(payrollResults?.approvedAt).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                  </Text>
                </HStack>
              </Box>
            </HStack>
          ) : null}
          {/* Payment date  */}
          {payrollResults?.status === "PAYÉ" ? (
            <HStack mt="1rem" mr="1rem">
              <Box>
                <HStack>
                  <Text fontWeight="600">
                    {payrollResults?.paidAt &&
                      new Date(payrollResults?.paidAt).toLocaleDateString(
                        "fr-FR"
                      )}
                  </Text>
                  <Text>
                    {payrollResults?.paidAt &&
                      new Date(payrollResults?.paidAt).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                  </Text>
                </HStack>
              </Box>
            </HStack>
          ) : null}
          <Box>
            <Text
              color={
                payrollResults?.status && statusColor[payrollResults?.status]
              }
              fontWeight="700"
            >
              {payrollResults?.status && payrollResults.status}
            </Text>
          </Box>
        </VStack>
      </Flex>

      {/* Salary breakdown */}
      <HStack
        bg="#F8F9FB"
        border="1px solid"
        borderColor="#D1D9E0"
        borderRadius="8px"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        height="15vh"
        width="78vw"
        mt="3rem"
        ml="1rem"
        gap={10}
        padding={10}
      >
        <PayslipItemDisplay
          itemName="Salaire de base"
          amount={payrollResults?.baseSalary ?? 0}
          icon={IoWalletOutline}
          color="green"
        />
        <PayslipItemDisplay
          itemName="Remunerations"
          amount={payrollResults?.totalEarnings ?? 0}
          icon={FaArrowTrendUp}
          color="purple"
        />
        <PayslipItemDisplay
          itemName="Salaire brut"
          amount={payrollResults?.grossSalary ?? 0}
          icon={FaDollarSign}
          color="blue"
        />
        <PayslipItemDisplay
          itemName="Deductions"
          amount={payrollResults?.totalDeductions ?? 0}
          icon={FaArrowDownLong}
          color="red"
        />
        <PayslipItemDisplay
          itemName="Salaire net"
          amount={payrollResults?.netSalary ?? 0}
          icon={PiCreditCardLight}
          color="green"
        />
      </HStack>
      {/* Earnings and deductions breakdown */}
      <HStack
        ml="1rem"
        mt="5rem"
        spacing="1rem"
        width="calc(100% - 4rem)"
        height="400px"
        align="stretch"
      >
        {/* Earnings */}
        <Box
          width="40vw"
          height="50vh"
          border="1px solid"
          bg="#ffffff"
          borderColor="#D1D9E0"
          borderRadius="8px"
          boxShadow="0 2px 8px rgba(0,0,0,0.5)"
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          {/* Fixed Header */}
          <Table variant="simple" sx={{ tableLayout: "fixed" }} flexShrink={0}>
            <Thead>
              <Tr>
                <Th color="purple.600" fontSize="0.8rem">
                  Rémunérations
                </Th>
                <Th isNumeric>Montant</Th>
              </Tr>
            </Thead>
          </Table>

          {/* ONLY THIS SECTION SCROLLS */}
          <Box
            flex="1"
            overflowY="auto"
            overflowX="hidden"
            sx={{
              "&::-webkit-scrollbar": {
                width: "6px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#CBD5E0",
                borderRadius: "10px",
              },
            }}
          >
            <Table
              variant="simple"
              sx={{
                tableLayout: "fixed",
              }}
            >
              <Tbody>
                {earnings.map((item) => (
                  <Tr key={item.componentId}>
                    <Td>{item.displayName}</Td>
                    <Td isNumeric>{formatCurrency(item.amount, currency)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Fixed Footer */}
          <Table variant="simple" sx={{ tableLayout: "fixed" }} flexShrink={0}>
            <Tfoot>
              <Tr>
                <Th
                  fontSize="0.9rem"
                  bg="purple.100"
                  color="purple.800"
                  fontWeight="800"
                >
                  Total
                </Th>
                <Th
                  fontSize="0.9rem"
                  bg="purple.100"
                  color="purple.800"
                  fontWeight="800"
                  isNumeric
                >
                  {formatCurrency(totalEarnings, currency)}
                </Th>
              </Tr>
            </Tfoot>
          </Table>
        </Box>
        {/* Deductions */}
        <Box
          width="40vw"
          height="50vh"
          border="1px solid"
          bg="#ffffff"
          borderColor="#D1D9E0"
          borderRadius="8px"
          boxShadow="0 2px 8px rgba(0,0,0,0.5)"
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          {/* Fixed Header */}
          <Table variant="simple" sx={{ tableLayout: "fixed" }} flexShrink={0}>
            <Thead>
              <Tr>
                <Th color="red.600" fontSize="0.8rem">
                  Déductions
                </Th>
                <Th isNumeric>Montant</Th>
              </Tr>
            </Thead>
          </Table>

          {/* ONLY THIS SECTION SCROLLS */}
          <Box
            flex="1"
            overflowY="auto"
            overflowX="hidden"
            sx={{
              "&::-webkit-scrollbar": {
                width: "6px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#CBD5E0",
                borderRadius: "10px",
              },
            }}
          >
            <Table
              variant="simple"
              sx={{
                tableLayout: "fixed",
              }}
            >
              <Tbody>
                {deductions.map((item) => (
                  <Tr key={item.componentId}>
                    <Td>{item.displayName}</Td>
                    <Td isNumeric>{formatCurrency(item.amount, currency)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Fixed Footer */}
          <Table variant="simple" sx={{ tableLayout: "fixed" }} flexShrink={0}>
            <Tfoot>
              <Tr>
                <Th
                  fontSize="0.9rem"
                  bg="red.100"
                  color="red.800"
                  fontWeight="800"
                >
                  Total
                </Th>
                <Th
                  fontSize="0.9rem"
                  bg="red.100"
                  color="red.800"
                  fontWeight="800"
                  isNumeric
                >
                  {formatCurrency(totalDeductions, currency)}
                </Th>
              </Tr>
            </Tfoot>
          </Table>
        </Box>
      </HStack>
    </Flex>
  );
};

export default EmployeePayslipDetails;
