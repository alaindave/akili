import {
  Badge,
  HStack,
  IconButton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { ViewIcon, DownloadIcon } from "@chakra-ui/icons";
import { LuPrinter } from "react-icons/lu";
import { PayrollResult } from "../../../../../common/types/payroll/Payroll";
import { usePayrollSettings } from "../hooks/payroll_settings.hook";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../../lib/formatter";

interface Props {
  payrollResults: PayrollResult[];
}

const statusColor = {
  BROUILLON: "yellow",
  VERIFICATION: "blue",
  APPROUVÉ: "green",
  PAYÉ: "purple",
  ANNULÉ: "red",
} as const;

export default function PayrollResultsTable({ payrollResults }: Props) {
  const payrollSettings = usePayrollSettings();
  const currency = payrollSettings?.currency ?? "BIF";
  const navigate = useNavigate();

  return (
    <TableContainer
      maxH="50vh"
      maxW="85vw"
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

              <Td isNumeric color="red.500">
                {formatCurrency(result.totalDeductions, currency)}
              </Td>

              <Td isNumeric fontWeight="bold" color="green.500">
                {formatCurrency(result.netSalary, currency)}
              </Td>

              <Td>
                <Badge colorScheme={statusColor[result.status]}>
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
                        `/employees_admin/employees_list/${result.employeeId}/payslips/${result.payrollRunId}`
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
      </Table>
    </TableContainer>
  );
}
