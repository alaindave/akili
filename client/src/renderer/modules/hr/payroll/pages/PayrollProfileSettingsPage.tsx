import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  HStack,
  Text,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { MdOutlineChevronRight } from "react-icons/md";
import { FaArrowLeftLong } from "react-icons/fa6";
import PayrollEmployeeProfileList from "../components/PayrollProfileList";
import { Link, useLocation, useParams } from "react-router-dom";
import Employee from "../../../../../common/types/Employee";
import {
  useEmployee,
  useUpdateEmployee,
} from "../../employees/hooks/useEmployees";

type PhotoState = {
  photo_url?: string;
};

type EmployeeState = {
  employee: Employee;
};

export default function PayrollEmployeeProfileSettingsPage() {
  const location = useLocation();
  const { _id } = useParams();
  const { employee: initialEmployee } = (location.state as EmployeeState) || {};
  const {
    data: employee,
    isLoading,
    isError,
  } = useEmployee(_id ?? initialEmployee?._id);
  const updateEmployee = useUpdateEmployee();
  const [accountNumber, setAccountNumber] = useState("cash");
  const toast = useToast();
  const { photo_url } = (location.state as PhotoState) || "";

  useEffect(() => {
    setAccountNumber(employee?.accountNumber?.trim() || "cash");
  }, [employee?._id, employee?.accountNumber]);

  const saveAccountNumber = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employee) return;

    try {
      await updateEmployee.mutateAsync({
        companyId: employee.companyId,
        _id: employee._id,
        data: { accountNumber: accountNumber.trim() || "cash" },
      });
      setAccountNumber(accountNumber.trim() || "cash");
      toast({ title: "Numéro de compte enregistré", status: "success" });
    } catch {
      toast({
        title: "Impossible d'enregistrer le numéro de compte",
        status: "error",
      });
    }
  };

  if (isLoading) return <Box p={6}>Chargement...</Box>;
  if (isError || !employee)
    return <Box p={6}>Impossible de charger cet employé.</Box>;

  return (
    <Box p={6}>
      <HStack>
        <Link
          to={{
            pathname: `/employees_admin/employees_list/${employee?._id}`,
          }}
          state={{ photo_url, employee }}
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
              Fiche de paye
            </Text>
            <Box>
              <MdOutlineChevronRight fontSize="1.3rem" />
            </Box>
            <Text fontSize="1.1rem" fontWeight="500">
              Paramètres
            </Text>
          </HStack>
        </Box>
      </HStack>

      <Tabs colorScheme="yellow">
        <TabList gap={{ base: 2, md: 8 }} flexWrap="wrap">
          <Tab>Remuneration</Tab>
          <Tab>Deductions</Tab>
          <Tab>Numéro de compte</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <PayrollEmployeeProfileList
              employeeID={employee._id}
              type="EARNING"
              showTaxable
            />
          </TabPanel>
          <TabPanel px={0}>
            <PayrollEmployeeProfileList
              employeeID={employee._id}
              type="DEDUCTION"
              showTaxable={false}
            />
          </TabPanel>
          <TabPanel px={0}>
            <Box as="form" onSubmit={saveAccountNumber} maxW="480px">
              <FormControl isDisabled={updateEmployee.isPending}>
                <FormLabel htmlFor="employee-account-number">
                  Numéro de compte
                </FormLabel>
                <Input
                  id="employee-account-number"
                  type="text"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  placeholder="cash"
                />
                <FormHelperText>
                  Laissez ce champ vide pour un paiement en espèces.
                </FormHelperText>
              </FormControl>
              <Button
                mt={4}
                type="submit"
                colorScheme="yellow"
                isLoading={updateEmployee.isPending}
              >
                Enregistrer
              </Button>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
