import {
  Badge,
  HStack,
  IconButton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Tfoot,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { ViewIcon, DownloadIcon } from "@chakra-ui/icons";
import { LuPrinter } from "react-icons/lu";
import { PayrollResult } from "../../../../../common/types/hr/payroll/Payroll";
import { usePayrollSettings } from "../hooks/payroll_settings.hook";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../../lib/formatter";

interface Props {
  payrollResults: PayrollResult[];
}

const statusStyles = {
  BROUILLON: { colorScheme: "gray" },
  VERIFIÉ: { color: "#7C3AED", bg: "#EDE9FE" },
  APPROUVÉ: { color: "#0F766E", bg: "#CCFBF1" },
  PAYÉ: { color: "#15803D", bg: "#DCFCE7" },
  ANNULÉ: { colorScheme: "red" },
} as const;

export default function PayrollResultsTable({ payrollResults }: Props) {
  const payrollSettings = usePayrollSettings();
  const currency = payrollSettings?.currency ?? "BIF";
  const navigate = useNavigate();
  const totals = payrollResults.reduce(
    (sum, result) => ({
      earnings: sum.earnings + result.totalEarnings,
      deductions: sum.deductions + result.totalDeductions,
      netSalary: sum.netSalary + result.netSalary,
    }),
    { earnings: 0, deductions: 0, netSalary: 0 }
  );

  return (
    <TableContainer
      maxH="70vh"
      maxW="80vw"
      borderWidth="1px"
      borderRadius="lg"
      overflowY="auto"
      overflowX="hidden"
      mr="1rem"
    >
      <Table variant="simple" size="sm">
        <Thead bg="gray.50">
          <Tr>
            <Th position="sticky" bg="white" top={0} zIndex={1}>
              Employé
            </Th>
            <Th position="sticky" top={0} bg="white" zIndex={1}>
              Departement
            </Th>
            <Th position="sticky" top={0} bg="white" zIndex={1} isNumeric>
              Salaire de base
            </Th>
            <Th position="sticky" top={0} bg="white" zIndex={1} isNumeric>
              Remunérations
            </Th>
            <Th position="sticky" top={0} bg="white" zIndex={1} isNumeric>
              Deductions
            </Th>
            <Th position="sticky" top={0} bg="white" zIndex={1} isNumeric>
              Salaire net
            </Th>
            <Th position="sticky" top={0} bg="white" zIndex={1}>
              Statut
            </Th>
            <Th
              position="sticky"
              top={0}
              bg="white"
              zIndex={1}
              textAlign="center"
            >
              Actions
            </Th>
          </Tr>
        </Thead>

        <Tbody>
          {payrollResults.map((result) => (
            <Tr key={result._id}>
              <Td fontWeight="medium" fontSize="1rem">
                {result.firstName} {result.lastName}
              </Td>

              <Td fontSize="0.9rem">{result.department}</Td>

              <Td isNumeric>{formatCurrency(result.baseSalary, currency)}</Td>

              <Td isNumeric>
                {formatCurrency(result.totalEarnings, currency)}
              </Td>

              <Td isNumeric>
                {formatCurrency(result.totalDeductions, currency)}
              </Td>

              <Td isNumeric fontWeight="bold">
                {formatCurrency(result.netSalary, currency)}
              </Td>

              <Td>
                <Badge {...statusStyles[result.status]}>
                  {result.status}
                </Badge>
              </Td>

              <Td>
                <HStack justify="center" spacing={1}>
                  <IconButton
                    aria-label="View payroll"
                    icon={<ViewIcon />}
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        `/hr/employees_list/${result.employeeId}/payslips/${result.payrollRunId}`
                      )
                    }
                  />

                  <IconButton
                    aria-label="Print payslip"
                    icon={<LuPrinter />}
                    size="xs"
                    variant="ghost"
                  />

                  <IconButton
                    aria-label="Download PDF"
                    icon={<DownloadIcon />}
                    size="xs"
                    variant="ghost"
                  />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
        <Tfoot
          bg="gray.50"
          sx={{
            "& > tr > th, & > tr > td": {
              position: "sticky",
              bottom: 0,
              zIndex: 1,
              bg: "gray.50",
              boxShadow: "inset 0 1px 0 var(--chakra-colors-gray-200)",
            },
          }}
        >
          <Tr fontWeight="bold">
            <Th colSpan={3} scope="row">
              Total
            </Th>
            <Td isNumeric color="blue.500">
              {formatCurrency(totals.earnings, currency)}
            </Td>
            <Td isNumeric color="red.500">
              {formatCurrency(totals.deductions, currency)}
            </Td>
            <Td isNumeric color="green.500">
              {formatCurrency(totals.netSalary, currency)}
            </Td>
            <Td colSpan={2} />
          </Tr>
        </Tfoot>
      </Table>
    </TableContainer>
  );
}
