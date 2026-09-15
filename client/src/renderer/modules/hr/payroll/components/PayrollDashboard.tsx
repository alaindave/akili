import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { BsFillPeopleFill } from "react-icons/bs";
import { FaRegArrowAltCircleDown, FaRegCreditCard } from "react-icons/fa";
import { IoWalletOutline } from "react-icons/io5";
import { FaDollarSign } from "react-icons/fa";
import { usePayrollSettings } from "../hooks/payroll_settings.hook";
import { formatCurrency } from "../../../../lib/formatter";

interface Props {
  employeeCount: number;
  totalBasicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetSalary: number;
}

const PayrollDashboard = ({
  employeeCount,
  totalBasicSalary,
  totalEarnings,
  totalDeductions,
  totalNetSalary,
}: Props) => {
  const payrollSettings = usePayrollSettings();
  const currency = payrollSettings?.currency ?? "BIF";

  return (
    <HStack>
      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        border="1px solid rgba(255,255,255,0.12)"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        borderRadius="0.4rem"
        width="12rem"
        height="6rem"
      >
        <HStack>
          <Box
            width="0.5rem"
            height="0.5rem"
            backgroundColor="#000080"
            borderRadius="10px"
            padding="8px"
            ml="0.5rem"
            mt="1rem"
          ></Box>

          <Text
            color="gray.700"
            fontSize="1.1rem"
            fontWeight="600"
            position="relative"
            left="1rem"
            top="0.5rem"
          >
            Employés
          </Text>
        </HStack>

        <Text
          color="gray.600"
          fontSize="1.3rem"
          position="relative"
          top="0.3rem"
          left="5rem"
          fontWeight="700"
        >
          {employeeCount}
        </Text>
      </Box>

      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        border="1px solid rgba(255,255,255,0.12)"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        borderRadius="0.4rem"
        width="12rem"
        height="6rem"
      >
        <HStack>
          <Box
            width="0.5rem"
            height="0.5rem"
            backgroundColor="#000080"
            borderRadius="10px"
            padding="8px"
            mt="1rem"
            ml="0.5rem"
          ></Box>

          <Text
            color="gray.700"
            fontSize="1.1rem"
            fontWeight="600"
            position="relative"
            left="1rem"
            top="0.5rem"
          >
            Salaires
          </Text>
        </HStack>

        <Text
          color="gray.600"
          fontSize="1.15rem"
          position="relative"
          top="0.4rem"
          left="3rem"
          fontWeight="700"
        >
          {formatCurrency(totalBasicSalary, currency)}
        </Text>
      </Box>

      <Box
        bg="linear-gradient(
        135deg,
        rgba(255,255,255,0.08),
        rgba(255,255,255,0.03)
      )"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        padding="32px"
        borderRadius="0.4rem"
        width="15rem"
        height="6rem"
      >
        <HStack position="relative" bottom="1rem">
          <Box
            width="0.5rem"
            height="0.5rem"
            backgroundColor=" #16833e"
            borderRadius="10px"
            padding="8px"
            position="relative"
            right="1.3rem"
          ></Box>
          <Text color="gray.700" fontSize="1.1rem" fontWeight="600">
            Remunerations
          </Text>
        </HStack>
        <Text
          color="gray.600"
          fontSize="1.15rem"
          position="relative"
          bottom="1rem"
          left="2.5rem"
          fontWeight="700"
        >
          {formatCurrency(totalEarnings, currency)}
        </Text>
      </Box>
      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        padding="30px"
        borderRadius="0.4rem"
        width="13rem"
        height="6rem"
      >
        <HStack>
          <Box
            width="0.5rem"
            height="0.5rem"
            backgroundColor="red.500"
            borderRadius="10px"
            padding="8px"
            position="relative"
            right="1rem"
            bottom="1rem"
          ></Box>
          <Text
            color="gray.700"
            fontSize="1.1rem"
            fontWeight="600"
            marginLeft="0.8rem"
            position="relative"
            right="1.5rem"
            bottom="1rem"
          >
            Deductions
          </Text>
        </HStack>
        <Text
          color="gray.600"
          fontSize="1.15rem"
          position="relative"
          left="2rem"
          bottom="1rem"
          fontWeight="700"
        >
          {formatCurrency(totalDeductions, currency)}
        </Text>
      </Box>
      <Box
        bg="linear-gradient(
          135deg,
          rgba(255,255,255,0.08),
          rgba(255,255,255,0.03)
        )"
        boxShadow="0 2px 8px rgba(0,0,0,0.5)"
        padding="30px"
        borderRadius="0.4rem"
        width="13rem"
        height="6rem"
      >
        <HStack>
          <Box
            width="0.5rem"
            height="0.5rem"
            borderRadius="10px"
            padding="8px"
            backgroundColor="blue.500"
            position="relative"
            bottom="1rem"
          ></Box>
          <Text
            color="gray.700"
            fontSize="1.1rem"
            fontWeight="600"
            position="relative"
            bottom="0.9rem"
          >
            Net
          </Text>
        </HStack>
        <Text
          color="gray.600"
          fontSize="1.15rem"
          position="relative"
          left="1.5rem"
          bottom="0.9rem"
          fontWeight="700"
        >
          {formatCurrency(totalNetSalary, currency)}
        </Text>
      </Box>
    </HStack>
  );
};

export default PayrollDashboard;
