import {
  Badge,
  Box,
  Flex,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { IoSettings } from "react-icons/io5";
import { MdOutlineChevronRight } from "react-icons/md";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Employee from "../../../../../common/types/Employee";
import { PayrollRun } from "../../../../../common/types/payroll/Payroll";
import MonthDropDown from "../../../../components/MonthDropDown";
import PayrollStatusFilter from "../components/PayrollStatusFilter";
import { getPayrollPeriod } from "../../../../lib/date";

type EmployeeState = {
  employee?: Employee;
};

type PhotoState = {
  photo_url?: string;
};

const EmployeePayrollReport = () => {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const location = useLocation();
  const { employee } = (location.state as EmployeeState) || {};
  const { photo_url } = (location.state as PhotoState) || "";
  const [submissionMonth, setSubmissionMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const navigate = useNavigate();
  const statusColor = {
    BROUILLON: "#e6b800",
    VERIFICATION: "#1a53ff",
    APPROUVÉ: "green",
    PAYÉ: "purple",
    ANNULÉ: "red",
  } as const;

  useEffect(() => {
    loadPayrollRun();
  }, [employee, submissionMonth]);

  const loadPayrollRun = async () => {
    const [year, month] = submissionMonth.split("-");
    console.log("Selected year", year);
    console.log("Selected month", month);
    try {
      const payrollRuns = await window.electron.payrollRun.getPayrollRuns(
        Number(year),
        Number(month)
      );
      console.log("FETCHED PAYROLL RUNS", payrollRuns);
      setPayrollRuns(payrollRuns);
    } catch (e) {
      console.error("AN ERROR OCCURED WHILE LOADING PAYROLL RUNS", e);
    }
  };

  return (
    <Flex
      direction="column"
      bg="#F8FAFC"
      width="100%"
      height="93vh"
      alignItems="flex-start"
      justify="space-between"
    >
      {/* Header */}
      <Box>
        <Flex justify="space-between" width="100%">
          <HStack mt="1.4rem">
            <Link
              to={{
                pathname: `/employees_admin/employees_list/${employee?._id}`,
              }}
              state={{ photo_url }}
            >
              <Box
                ml="0.8rem"
                mb="2rem"
                p={2}
                border="1px solid #14376b"
                borderRadius="10px"
              >
                <FaArrowLeftLong color="black" />
              </Box>
            </Link>
            <Box mt="0.5rem">
              <HStack ml="0.3rem" position="relative" bottom="1rem">
                <Text fontSize="1.1rem" fontWeight="500">
                  Employés
                </Text>
                <Box>
                  <MdOutlineChevronRight fontSize="1.3rem" />
                </Box>
                <Text fontSize="1.1rem" fontWeight="500">
                  {" "}
                  {employee?.firstName} {employee?.lastName}
                </Text>
                <Box>
                  <MdOutlineChevronRight fontSize="1.3rem" />
                </Box>
                <Text fontSize="1.1rem" fontWeight="500">
                  Fiches de paye
                </Text>
              </HStack>
            </Box>
          </HStack>
          <Link
            to={{
              pathname: `/employees_admin/employees_list/${employee?._id}/payslips/settings`,
            }}
            state={{ employee, photo_url }}
          >
            <Box position="absolute" top="1rem " right="1.5rem">
              <IoSettings fontSize="1.7rem" />
            </Box>
          </Link>
        </Flex>
        {payrollRuns.length !== 0 ? (
          <>
            <Box mt="3rem" ml="5rem" mb="1rem">
              <PayrollStatusFilter onFilterClicked={setStatusFilter} />
            </Box>
            <TableContainer
              width="60vw"
              borderWidth="1px"
              borderRadius="lg"
              overflowX="auto"
              overflowY="auto"
              ml="5rem"
            >
              <Table variant="simple" size="md">
                <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                  <Tr>
                    <Th>Période</Th>
                    <Th>Statut</Th>
                    <Th>Créee par</Th>
                    <Th>Date de création</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {payrollRuns
                    .filter(
                      (run) => !statusFilter || run.status === statusFilter
                    )
                    .map((run) => (
                      <Tr
                        key={run._id}
                        cursor="pointer"
                        _hover={{ bg: "transparent" }}
                        transition="background 0.2s"
                        onClick={() =>
                          navigate(
                            `/employees_admin/employees_list/${employee?._id}/payslips/${run._id}`,
                            {
                              state: {
                                employee,
                                photo_url,
                              },
                            }
                          )
                        }
                      >
                        <Td>
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
                      </Tr>
                    ))}
                </Tbody>
              </Table>
            </TableContainer>
          </>
        ) : (
          <Flex
            ml="1rem"
            mt="10rem"
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
            <Text
              fontSize={{
                base: "1rem",
                md: "1.1rem",
              }}
              fontWeight="500"
              color="gray.500"
              textAlign="center"
            >
              Pas de bulletins de paye retrouvés
            </Text>
          </Flex>
        )}
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
};

export default EmployeePayrollReport;
